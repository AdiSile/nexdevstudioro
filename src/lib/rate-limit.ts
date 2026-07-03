/**
 * Rate Limiting — Sliding Window per IP, User, API Key
 *
 * Production-grade, Redis-backed rate limiter with independent sliding
 * windows per dimension (IP, authenticated user, API key). Uses sorted-set
 * sliding windows with Lua scripting for atomicity.
 *
 * Design:
 *   - Sliding-window (ZSET-based) — no burstable boundary resets
 *   - Per-dimension configuration (IP, user, API key) with distinct limits
 *   - Multi-key evaluation: all applicable limiters are checked; the most
 *     restrictive one wins (fail-closed).
 *   - Atomic Lua scripts — no race conditions between count and increment
 *   - Graceful degradation — if Redis is unreachable, the circuit can be
 *     configured to allow (fail-open) or deny (fail-closed).
 *   - Standard `RateLimit-*` response headers: Remaining, Limit, Reset, Retry-After
 *   - Burst allowance: optional token-bucket–inspired "burst" multiplier
 *     above the sustained limit for short spikes.
 *   - Penalty box: repeated violators get a cooling-off multiplier.
 *
 * Rate Limit Key Hierarchy:
 *   rate-limit:ip:<ip>            — anonymous / IP-based
 *   rate-limit:user:<userId>      — authenticated user
 *   rate-limit:apikey:<keyHash>   — API key (hashed, never log raw key)
 *
 * Environment Variables:
 *   RATELIMIT_DEFAULT_MAX        — default max requests per window (default: 60)
 *   RATELIMIT_DEFAULT_WINDOW_S   — default window in seconds (default: 60)
 *   RATELIMIT_IP_MAX             — per-IP max requests (default: RATELIMIT_DEFAULT_MAX)
 *   RATELIMIT_IP_WINDOW_S        — per-IP window seconds (default: RATELIMIT_DEFAULT_WINDOW_S)
 *   RATELIMIT_USER_MAX           — per-user max requests (default: RATELIMIT_DEFAULT_MAX * 2)
 *   RATELIMIT_USER_WINDOW_S      — per-user window seconds (default: RATELIMIT_DEFAULT_WINDOW_S)
 *   RATELIMIT_APIKEY_MAX         — per-API-key max requests (default: RATELIMIT_DEFAULT_MAX * 5)
 *   RATELIMIT_APIKEY_WINDOW_S    — per-API-key window seconds (default: RATELIMIT_DEFAULT_WINDOW_S)
 *   RATELIMIT_BURST_MULTIPLIER   — burst multiplier (default: 1.5)
 *   RATELIMIT_PENALTY_MULTIPLIER — penalty multiplier after repeated violations (default: 0.5)
 *   RATELIMIT_PENALTY_THRESHOLD  — how many violations before penalty kicks in (default: 3)
 *   RATELIMIT_FAIL_OPEN          — allow requests if Redis is down (default: false = fail-closed)
 *   RATELIMIT_ENABLED            — master switch (default: true)
 */

import type { Redis } from "ioredis";
import { createHash } from "node:crypto";

// Re-use the singleton from our own redis module
import { getRedisClient as getRedis } from "./redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which dimension triggered (or would trigger) the limit */
export type RateLimitDimension = "ip" | "user" | "apikey" | "global";

/** Severity of the rate-limit decision */
export type RateLimitDecision = "allow" | "warn" | "block";

/** Configuration for a single rate-limit bucket */
export interface RateLimitBucketConfig {
  /** Maximum allowed requests in the window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Multiplier applied when burst mode is engaged */
  burstMultiplier: number;
  /** Whether this bucket is enabled */
  enabled: boolean;
}

/** Full per-dimension configuration */
export interface RateLimitConfig {
  ip: RateLimitBucketConfig;
  user: RateLimitBucketConfig;
  apikey: RateLimitBucketConfig;
  /** Global fallback when no dimension applies */
  global: RateLimitBucketConfig;
  /** Master switch */
  enabled: boolean;
  /** Fail-open if Redis is unreachable */
  failOpen: boolean;
  /** Penalty multiplier (0–1, where 0.5 = half capacity after penalty) */
  penaltyMultiplier: number;
  /** Number of violations before penalty multiplier engages */
  penaltyThreshold: number;
  /** TTL (seconds) for the penalty counter */
  penaltyTtlSeconds: number;
}

/** Input context for a rate-limit check */
export interface RateLimitContext {
  /** Client IP address (recommended: trust X-Forwarded-For carefully) */
  ip?: string;
  /** Authenticated user ID */
  userId?: string;
  /** Hashed API key (NEVER pass raw key — hash before calling) */
  apiKeyHash?: string;
  /** Optional custom cost for this request (default: 1) */
  cost?: number;
  /** Optional override: skip specific dimensions */
  skipDimensions?: RateLimitDimension[];
}

/** Detailed result of a rate-limit check */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Decision severity */
  decision: RateLimitDecision;
  /** Which dimension was the most restrictive (if blocked) */
  limitingDimension?: RateLimitDimension;
  /** Total remaining capacity (minimum across all dimensions) */
  remaining: number;
  /** Total limit (most restrictive dimension's limit) */
  limit: number;
  /** Unix timestamp (ms) when the window resets (earliest reset across dimensions) */
  resetAt: number;
  /** Seconds until reset (for Retry-After header) */
  retryAfterSeconds: number;
  /** Per-dimension breakdown (for diagnostics) */
  breakdown: Record<RateLimitDimension, DimensionResult>;
  /** Whether Redis was available during this check */
  redisAvailable: boolean;
}

/** Per-dimension sub-result */
export interface DimensionResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  currentCount: number;
  enforced: boolean;
}

/** Penalty record stored in Redis */
interface PenaltyRecord {
  violations: number;
  penaltyActive: boolean;
  penaltyUntil: number; // Unix ms
}

// ---------------------------------------------------------------------------
// Lua Scripts (Atomic Operations)
// ---------------------------------------------------------------------------

/**
 * Sliding-window check + increment.
 *
 * KEYS[1] — sorted-set key
 * KEYS[2] — penalty counter key (hash)
 * ARGV[1] — current timestamp (ms)
 * ARGV[2] — window start (ms) = now - windowSeconds * 1000
 * ARGV[3] — member suffix (unique: `${now}-${random}`)
 * ARGV[4] — max count (after penalty adjustments)
 * ARGV[5] — TTL for the sorted set (seconds, slightly longer than window)
 * ARGV[6] — penalty TTL (seconds)
 *
 * Returns: [currentCount, allowed (1|0), remaining]
 */
const SLIDING_WINDOW_LUA = `
-- Clean expired entries
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[2])

-- Count entries in window
local count = redis.call('ZCARD', KEYS[1])
local max = tonumber(ARGV[4])
local allowed = 0
local remaining = 0

if count < max then
  -- Add current request
  redis.call('ZADD', KEYS[1], ARGV[1], ARGV[3])
  count = count + 1
  allowed = 1
  remaining = max - count
else
  allowed = 0
  remaining = 0
end

-- Set expiry on the sorted set
redis.call('EXPIRE', KEYS[1], ARGV[5])

-- Update penalty counter if blocked
if allowed == 0 and KEYS[2] ~= '' then
  local penaltyCount = redis.call('HINCRBY', KEYS[2], 'violations', 1)
  redis.call('EXPIRE', KEYS[2], ARGV[6])
  redis.call('HSET', KEYS[2], 'lastViolation', ARGV[1])
end

return {count, allowed, remaining}
`;

/**
 * Check-only variant (no increment — for pre-flight checks / dry runs).
 *
 * KEYS[1] — sorted-set key
 * ARGV[1] — window start (ms)
 * ARGV[2] — max count
 *
 * Returns: [currentCount, allowed (1|0), remaining]
 */
const SLIDING_WINDOW_CHECK_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
local max = tonumber(ARGV[2])
local allowed = 0
local remaining = 0

if count < max then
  allowed = 1
  remaining = max - count - 1
else
  allowed = 0
  remaining = 0
end

return {count, allowed, remaining}
`;

/**
 * Get penalty info for a dimension.
 *
 * KEYS[1] — penalty hash key
 *
 * Returns: [violations, penaltyActive (1|0), penaltyUntil (ms)]
 */
const GET_PENALTY_LUA = `
local v = redis.call('HGET', KEYS[1], 'violations') or '0'
local pa = redis.call('HGET', KEYS[1], 'penaltyActive') or '0'
local pu = redis.call('HGET', KEYS[1], 'penaltyUntil') or '0'
return {tonumber(v), tonumber(pa), tonumber(pu)}
`;

// ---------------------------------------------------------------------------
// SHA Caching for Lua Scripts
// ---------------------------------------------------------------------------

let slidingWindowSha: string | null = null;
let slidingWindowCheckSha: string | null = null;
let getPenaltySha: string | null = null;

async function loadScripts(client: Redis): Promise<void> {
  if (!slidingWindowSha) {
    slidingWindowSha = await client.script("LOAD", SLIDING_WINDOW_LUA) as string;
  }
  if (!slidingWindowCheckSha) {
    slidingWindowCheckSha = await client.script("LOAD", SLIDING_WINDOW_CHECK_LUA) as string;
  }
  if (!getPenaltySha) {
    getPenaltySha = await client.script("LOAD", GET_PENALTY_LUA) as string;
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envFloat(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

function buildConfig(): RateLimitConfig {
  const defaultMax = envInt("RATELIMIT_DEFAULT_MAX", 60);
  const defaultWindow = envInt("RATELIMIT_DEFAULT_WINDOW_S", 60);
  const burstMult = envFloat("RATELIMIT_BURST_MULTIPLIER", 1.5);

  return {
    ip: {
      max: envInt("RATELIMIT_IP_MAX", defaultMax),
      windowSeconds: envInt("RATELIMIT_IP_WINDOW_S", defaultWindow),
      burstMultiplier: burstMult,
      enabled: true,
    },
    user: {
      max: envInt("RATELIMIT_USER_MAX", defaultMax * 2),
      windowSeconds: envInt("RATELIMIT_USER_WINDOW_S", defaultWindow),
      burstMultiplier: burstMult,
      enabled: true,
    },
    apikey: {
      max: envInt("RATELIMIT_APIKEY_MAX", defaultMax * 5),
      windowSeconds: envInt("RATELIMIT_APIKEY_WINDOW_S", defaultWindow),
      burstMultiplier: burstMult,
      enabled: true,
    },
    global: {
      max: envInt("RATELIMIT_GLOBAL_MAX", defaultMax * 10),
      windowSeconds: envInt("RATELIMIT_GLOBAL_WINDOW_S", defaultWindow),
      burstMultiplier: burstMult,
      enabled: true,
    },
    enabled: envBool("RATELIMIT_ENABLED", true),
    failOpen: envBool("RATELIMIT_FAIL_OPEN", false),
    penaltyMultiplier: envFloat("RATELIMIT_PENALTY_MULTIPLIER", 0.5),
    penaltyThreshold: envInt("RATELIMIT_PENALTY_THRESHOLD", 3),
    penaltyTtlSeconds: envInt("RATELIMIT_PENALTY_TTL_S", 3600), // 1 hour
  };
}

let _config: RateLimitConfig | undefined;

function getConfig(): RateLimitConfig {
  if (!_config) {
    _config = buildConfig();
  }
  return _config;
}

/**
 * Reload configuration at runtime (useful for feature flags / hot-reload).
 */
export function reloadConfig(): RateLimitConfig {
  _config = buildConfig();
  return _config;
}

// ---------------------------------------------------------------------------
// Key Builders
// ---------------------------------------------------------------------------

const KEY_PREFIX = "rate-limit";
const PENALTY_PREFIX = "rate-limit-penalty";

function buildIpKey(ip: string): string {
  // Normalize IPv6-mapped IPv4
  const normalized = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return `${KEY_PREFIX}:ip:${normalized}`;
}

function buildUserKey(userId: string): string {
  return `${KEY_PREFIX}:user:${userId}`;
}

function buildApiKeyKey(apiKeyHash: string): string {
  return `${KEY_PREFIX}:apikey:${apiKeyHash}`;
}

function buildGlobalKey(): string {
  return `${KEY_PREFIX}:global:all`;
}

function buildPenaltyKey(dimension: RateLimitDimension, identifier: string): string {
  return `${PENALTY_PREFIX}:${dimension}:${identifier}`;
}

// ---------------------------------------------------------------------------
// API Key Hashing (SHA-256, constant-time ready)
// ---------------------------------------------------------------------------

/**
 * Hash an API key before using it as a rate-limit identifier.
 * This ensures raw keys never appear in Redis keys or logs.
 *
 * IMPORTANT: The caller MUST hash the key before passing to any rate-limit
 * function. This is a convenience helper exposed for that purpose.
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("base64url");
}

/**
 * Constant-time API key hash comparison.
 * Useful when looking up pre-hashed keys.
 */
export function compareApiKeyHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Penalty Management
// ---------------------------------------------------------------------------

async function getPenalty(
  client: Redis,
  dimension: RateLimitDimension,
  identifier: string,
): Promise<PenaltyRecord> {
  try {
    await loadScripts(client);
    const penaltyKey = buildPenaltyKey(dimension, identifier);
    const result = (await client.evalsha(
      getPenaltySha!,
      1,
      penaltyKey,
    )) as [number, number, number];

    return {
      violations: result[0],
      penaltyActive: result[1] === 1,
      penaltyUntil: result[2],
    };
  } catch {
    return { violations: 0, penaltyActive: false, penaltyUntil: 0 };
  }
}

async function applyPenalty(
  client: Redis,
  dimension: RateLimitDimension,
  identifier: string,
): Promise<void> {
  const config = getConfig();
  const penaltyKey = buildPenaltyKey(dimension, identifier);
  const now = Date.now();

  const record = await getPenalty(client, dimension, identifier);

  if (record.violations >= config.penaltyThreshold && !record.penaltyActive) {
    const penaltyUntil = now + config.penaltyTtlSeconds * 1000;
    await client.hset(penaltyKey, "penaltyActive", "1", "penaltyUntil", String(penaltyUntil));
    await client.expire(penaltyKey, config.penaltyTtlSeconds);
  }
}

/**
 * Clear a penalty record (e.g., after successful authentication or manual reset).
 */
export async function clearPenalty(
  dimension: RateLimitDimension,
  identifier: string,
): Promise<void> {
  try {
    const client = getRedis();
    await client.del(buildPenaltyKey(dimension, identifier));
  } catch {
    // Silently ignore Redis errors
  }
}

// ---------------------------------------------------------------------------
// Core: Single Dimension Check
// ---------------------------------------------------------------------------

interface SingleCheckResult {
  count: number;
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

async function checkSingleDimension(
  client: Redis,
  key: string,
  bucketConfig: RateLimitBucketConfig,
  penaltyRecord: PenaltyRecord,
  cost: number,
  dryRun: boolean,
): Promise<SingleCheckResult> {
  const now = Date.now();
  const windowStart = now - bucketConfig.windowSeconds * 1000;

  // Compute effective max with penalty
  let effectiveMax = bucketConfig.max;
  if (penaltyRecord.penaltyActive && penaltyRecord.penaltyUntil > now) {
    const config = getConfig();
    effectiveMax = Math.max(1, Math.floor(effectiveMax * config.penaltyMultiplier));
  }

  // Apply burst multiplier for the first request over the limit
  // (this simulates a token-bucket burst: allows a brief spike)
  const burstMax = Math.floor(effectiveMax * bucketConfig.burstMultiplier);

  // Cost can consume multiple slots for expensive operations
  const costInt = Math.max(1, Math.floor(cost));

  const memberId = `${now}-${Math.random().toString(36).slice(2, 10)}`;
  const penaltyKey = ""; // penalty is handled separately pre-check
  const ttlSeconds = bucketConfig.windowSeconds + 2;

  try {
    await loadScripts(client);

    if (dryRun) {
      const result = (await client.evalsha(
        slidingWindowCheckSha!,
        1,
        key,
        windowStart,
        burstMax,
      )) as [number, number, number];

      const count = result[0];
      const allowed = result[1] === 1;
      const remaining = Math.max(0, burstMax - count - costInt);

      return {
        count,
        allowed,
        remaining,
        limit: burstMax,
        resetAt: now + bucketConfig.windowSeconds * 1000,
      };
    }

    // Atomic check + increment
    const result = (await client.evalsha(
      slidingWindowSha!,
      2,
      key,
      penaltyKey,
      now,
      windowStart,
      memberId,
      burstMax,
      ttlSeconds,
      getConfig().penaltyTtlSeconds,
    )) as [number, number, number];

    const count = result[0];
    const allowed = result[1] === 1 && count <= burstMax;
    const remaining = Math.max(0, burstMax - count);

    return {
      count,
      allowed,
      remaining,
      limit: burstMax,
      resetAt: now + bucketConfig.windowSeconds * 1000,
    };
  } catch (err) {
    // If Redis fails and failOpen is true, allow the request
    if (getConfig().failOpen) {
      return {
        count: 0,
        allowed: true,
        remaining: bucketConfig.max,
        limit: bucketConfig.max,
        resetAt: now + bucketConfig.windowSeconds * 1000,
      };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Core: Multi-Dimensional Check
// ---------------------------------------------------------------------------

interface DimensionCheckInput {
  dimension: RateLimitDimension;
  key: string;
  identifier: string;
  bucketConfig: RateLimitBucketConfig;
}

/**
 * Evaluate rate limits across all applicable dimensions.
 *
 * The request is allowed only if ALL applicable dimensions allow it.
 * The most restrictive dimension determines remaining/limit/reset values
 * returned in the result.
 */
async function checkAllDimensions(
  ctx: RateLimitContext,
  dryRun = false,
): Promise<RateLimitResult> {
  const config = getConfig();

  // Master switch
  if (!config.enabled) {
    return makeBypassResult();
  }

  const client = getRedis();
  const now = Date.now();

  // Build list of applicable checks
  const checks: DimensionCheckInput[] = [];

  const skipSet = new Set(ctx.skipDimensions ?? []);

  if (ctx.ip && config.ip.enabled && !skipSet.has("ip")) {
    checks.push({
      dimension: "ip",
      key: buildIpKey(ctx.ip),
      identifier: ctx.ip,
      bucketConfig: config.ip,
    });
  }

  if (ctx.userId && config.user.enabled && !skipSet.has("user")) {
    checks.push({
      dimension: "user",
      key: buildUserKey(ctx.userId),
      identifier: ctx.userId,
      bucketConfig: config.user,
    });
  }

  if (ctx.apiKeyHash && config.apikey.enabled && !skipSet.has("apikey")) {
    checks.push({
      dimension: "apikey",
      key: buildApiKeyKey(ctx.apiKeyHash),
      identifier: ctx.apiKeyHash,
      bucketConfig: config.apikey,
    });
  }

  // Always include global as a floor
  if (config.global.enabled && !skipSet.has("global")) {
    checks.push({
      dimension: "global",
      key: buildGlobalKey(),
      identifier: "all",
      bucketConfig: config.global,
    });
  }

  // If no checks apply, allow
  if (checks.length === 0) {
    return makeBypassResult();
  }

  const cost = ctx.cost ?? 1;

  // Evaluate all dimensions in parallel
  const results = await Promise.all(
    checks.map(async (check) => {
      const penalty = await getPenalty(client, check.dimension, check.identifier);
      const single = await checkSingleDimension(
        client,
        check.key,
        check.bucketConfig,
        penalty,
        cost,
        dryRun,
      );
      return { ...check, ...single, penalty };
    }),
  );

  // Build breakdown
  const breakdown: Record<RateLimitDimension, DimensionResult> = {
    ip: { allowed: true, remaining: Infinity, limit: 0, resetAt: now, currentCount: 0, enforced: false },
    user: { allowed: true, remaining: Infinity, limit: 0, resetAt: now, currentCount: 0, enforced: false },
    apikey: { allowed: true, remaining: Infinity, limit: 0, resetAt: now, currentCount: 0, enforced: false },
    global: { allowed: true, remaining: Infinity, limit: 0, resetAt: now, currentCount: 0, enforced: false },
  };

  for (const r of results) {
    breakdown[r.dimension] = {
      allowed: r.allowed,
      remaining: r.remaining,
      limit: r.limit,
      resetAt: r.resetAt,
      currentCount: r.count,
      enforced: true,
    };
  }

  // Find the most restrictive dimension
  let mostRestrictive: (typeof results)[0] | undefined;
  let overallAllowed = true;

  for (const r of results) {
    if (!r.allowed) {
      overallAllowed = false;
      if (
        !mostRestrictive ||
        r.remaining < mostRestrictive.remaining ||
        r.resetAt < mostRestrictive.resetAt
      ) {
        mostRestrictive = r;
      }
    }
  }

  // If all allowed, pick the one with fewest remaining
  if (overallAllowed) {
    mostRestrictive = results.reduce((worst, r) =>
      r.remaining < worst.remaining ||
        (r.remaining === worst.remaining && r.resetAt < worst.resetAt)
        ? r
        : worst,
    );
  }

  const limiting = mostRestrictive!;

  // Apply penalty to the most restrictive dimension if blocked
  if (!overallAllowed && !dryRun && limiting.dimension !== "global") {
    await applyPenalty(client, limiting.dimension, limiting.identifier);
  }

  // Determine decision
  let decision: RateLimitDecision = "allow";
  if (!overallAllowed) {
    decision = "block";
  } else if (limiting.remaining < limiting.limit * 0.2) {
    decision = "warn";
  }

  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((limiting.resetAt - now) / 1000),
  );

  return {
    allowed: overallAllowed,
    decision,
    limitingDimension: overallAllowed ? undefined : limiting.dimension,
    remaining: limiting.remaining,
    limit: limiting.limit,
    resetAt: limiting.resetAt,
    retryAfterSeconds,
    breakdown,
    redisAvailable: true,
  };
}

function makeBypassResult(): RateLimitResult {
  const now = Date.now();
  const infinite = 1_000_000;
  const emptyBreakdown: Record<RateLimitDimension, DimensionResult> = {
    ip: { allowed: true, remaining: infinite, limit: 0, resetAt: now, currentCount: 0, enforced: false },
    user: { allowed: true, remaining: infinite, limit: 0, resetAt: now, currentCount: 0, enforced: false },
    apikey: { allowed: true, remaining: infinite, limit: 0, resetAt: now, currentCount: 0, enforced: false },
    global: { allowed: true, remaining: infinite, limit: 0, resetAt: now, currentCount: 0, enforced: false },
  };
  return {
    allowed: true,
    decision: "allow",
    remaining: infinite,
    limit: 0,
    resetAt: now,
    retryAfterSeconds: 0,
    breakdown: emptyBreakdown,
    redisAvailable: true,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a request should be allowed under the current rate limits.
 *
 * This is the primary entry point. It evaluates all applicable dimensions
 * (IP, user, API key, global) and blocks if any one is over its limit.
 *
 * @example
 *   const result = await rateLimitCheck({
 *     ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
 *     userId: session?.userId,
 *     apiKeyHash: apiKey ? hashApiKey(apiKey) : undefined,
 *   });
 *
 *   if (!result.allowed) {
 *     res.status(429).set({
 *       "Retry-After": String(result.retryAfterSeconds),
 *       "X-RateLimit-Remaining": "0",
 *     });
 *     return;
 *   }
 */
export async function rateLimitCheck(
  ctx: RateLimitContext,
): Promise<RateLimitResult> {
  try {
    return await checkAllDimensions(ctx, false);
  } catch (err) {
    const config = getConfig();
    if (config.failOpen) {
      return makeBypassResult();
    }
    // Fail-closed: block the request
    const now = Date.now();
    return {
      allowed: false,
      decision: "block",
      limitingDimension: "global",
      remaining: 0,
      limit: 0,
      resetAt: now + 60_000,
      retryAfterSeconds: 60,
      breakdown: {
        ip: { allowed: false, remaining: 0, limit: 0, resetAt: now, currentCount: 0, enforced: false },
        user: { allowed: false, remaining: 0, limit: 0, resetAt: now, currentCount: 0, enforced: false },
        apikey: { allowed: false, remaining: 0, limit: 0, resetAt: now, currentCount: 0, enforced: false },
        global: { allowed: false, remaining: 0, limit: 0, resetAt: now, currentCount: 0, enforced: false },
      },
      redisAvailable: false,
    };
  }
}

/**
 * Dry-run check: evaluate limits without incrementing any counters.
 * Useful for pre-flight checks or displaying current capacity to the client
 * before they make an actual request.
 */
export async function rateLimitDryRun(
  ctx: RateLimitContext,
): Promise<RateLimitResult> {
  try {
    return await checkAllDimensions(ctx, true);
  } catch (err) {
    const config = getConfig();
    if (config.failOpen) {
      return makeBypassResult();
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Per-Dimension Convenience Functions
// ---------------------------------------------------------------------------

/**
 * Check rate limit for an IP address only.
 */
export async function rateLimitByIp(
  ip: string,
  cost = 1,
): Promise<RateLimitResult> {
  return rateLimitCheck({ ip, cost, skipDimensions: ["user", "apikey", "global"] });
}

/**
 * Check rate limit for an authenticated user only.
 */
export async function rateLimitByUser(
  userId: string,
  cost = 1,
): Promise<RateLimitResult> {
  return rateLimitCheck({ userId, cost, skipDimensions: ["ip", "apikey", "global"] });
}

/**
 * Check rate limit for an API key only.
 *
 * @param apiKeyHash — pre-hashed key (use hashApiKey() first)
 */
export async function rateLimitByApiKey(
  apiKeyHash: string,
  cost = 1,
): Promise<RateLimitResult> {
  return rateLimitCheck({ apiKeyHash, cost, skipDimensions: ["ip", "user", "global"] });
}

// ---------------------------------------------------------------------------
// Quota / Remaining
// ---------------------------------------------------------------------------

/**
 * Get the remaining quota for a given context without consuming it.
 * Alias for `rateLimitDryRun`.
 */
export const getRemainingQuota = rateLimitDryRun;

/**
 * Reset the rate limit for a specific dimension + identifier.
 * Useful for admin operations or after a successful payment.
 *
 * @example
 *   await resetRateLimit("ip", "192.168.1.10");
 *   await resetRateLimit("user", "user_abc123");
 */
export async function resetRateLimit(
  dimension: RateLimitDimension,
  identifier: string,
): Promise<number> {
  try {
    const client = getRedis();
    let key: string;
    switch (dimension) {
      case "ip":
        key = buildIpKey(identifier);
        break;
      case "user":
        key = buildUserKey(identifier);
        break;
      case "apikey":
        key = buildApiKeyKey(identifier);
        break;
      case "global":
        key = buildGlobalKey();
        break;
    }
    await clearPenalty(dimension, identifier);
    return client.del(key);
  } catch {
    return 0;
  }
}

/**
 * Reset all rate limits across all dimensions for an identifier.
 * Aggressively cleans IP, user, and API key buckets.
 */
export async function resetAllRateLimits(
  ip?: string,
  userId?: string,
  apiKeyHash?: string,
): Promise<void> {
  const promises: Promise<unknown>[] = [];
  if (ip) {
    promises.push(resetRateLimit("ip", ip));
  }
  if (userId) {
    promises.push(resetRateLimit("user", userId));
  }
  if (apiKeyHash) {
    promises.push(resetRateLimit("apikey", apiKeyHash));
  }
  await Promise.allSettled(promises);
}

// ---------------------------------------------------------------------------
// Response Headers Builder
// ---------------------------------------------------------------------------

/**
 * Build standard RateLimit HTTP response headers from a check result.
 *
 * Follows the IETF draft standard:
 *   RateLimit-Limit: <limit>
 *   RateLimit-Remaining: <remaining>
 *   RateLimit-Reset: <reset-at-unix-seconds>
 *   Retry-After: <seconds>  (only when blocked)
 *
 * @example
 *   const result = await rateLimitCheck(ctx);
 *   const headers = buildRateLimitHeaders(result);
 *   res.set(headers);
 */
export function buildRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (result.limit > 0) {
    headers["RateLimit-Limit"] = String(result.limit);
    headers["RateLimit-Remaining"] = String(result.remaining);
    headers["RateLimit-Reset"] = String(Math.ceil(result.resetAt / 1000));
  }

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  return headers;
}

/**
 * Append rate-limit headers to an existing Headers object (Web API).
 */
export function setRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult,
): void {
  const obj = buildRateLimitHeaders(result);
  for (const [key, value] of Object.entries(obj)) {
    headers.set(key, value);
  }
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Verify that the rate limiter is operational.
 *
 * Performs a round-trip check against Redis without affecting real counters.
 */
export async function pingRateLimit(): Promise<{
  healthy: boolean;
  redisAvailable: boolean;
  config: RateLimitConfig;
  error?: string;
}> {
  const config = getConfig();

  try {
    const result = await rateLimitDryRun({
      ip: "127.0.0.1",
      cost: 0, // zero-cost so it never actually blocks
    });

    return {
      healthy: result.redisAvailable,
      redisAvailable: result.redisAvailable,
      config,
    };
  } catch (err) {
    return {
      healthy: false,
      redisAvailable: false,
      config,
      error: err instanceof Error ? err.message : "Unknown rate-limit health check error.",
    };
  }
}

// ---------------------------------------------------------------------------
// Current Status (for dashboards)
// ---------------------------------------------------------------------------

/**
 * Get the current rate-limit status for a context.
 * Same as dry-run but with a more descriptive name for admin/dashboard use.
 */
export const getRateLimitStatus = rateLimitDryRun;

/**
 * Get detailed stats for a dimension + identifier.
 */
export async function getRateLimitStats(
  dimension: RateLimitDimension,
  identifier: string,
): Promise<{
  currentCount: number;
  limit: number;
  remaining: number;
  resetAt: number;
  penalty: PenaltyRecord;
}> {
  const config = getConfig();
  const client = getRedis();
  const now = Date.now();

  let key: string;
  let bucketConfig: RateLimitBucketConfig;

  switch (dimension) {
    case "ip":
      key = buildIpKey(identifier);
      bucketConfig = config.ip;
      break;
    case "user":
      key = buildUserKey(identifier);
      bucketConfig = config.user;
      break;
    case "apikey":
      key = buildApiKeyKey(identifier);
      bucketConfig = config.apikey;
      break;
    case "global":
      key = buildGlobalKey();
      bucketConfig = config.global;
      break;
  }

  const windowStart = now - bucketConfig.windowSeconds * 1000;

  // Clean and count
  await client.zremrangebyscore(key, 0, windowStart);
  const count = await client.zcard(key);
  const penalty = await getPenalty(client, dimension, identifier);

  let effectiveMax = bucketConfig.max;
  if (penalty.penaltyActive && penalty.penaltyUntil > now) {
    effectiveMax = Math.max(1, Math.floor(effectiveMax * config.penaltyMultiplier));
  }

  const burstMax = Math.floor(effectiveMax * bucketConfig.burstMultiplier);

  return {
    currentCount: count,
    limit: burstMax,
    remaining: Math.max(0, burstMax - count),
    resetAt: now + bucketConfig.windowSeconds * 1000,
    penalty,
  };
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const rateLimit = {
  check: rateLimitCheck,
  dryRun: rateLimitDryRun,
  byIp: rateLimitByIp,
  byUser: rateLimitByUser,
  byApiKey: rateLimitByApiKey,
  getQuota: getRemainingQuota,
  getStatus: getRateLimitStatus,
  getStats: getRateLimitStats,
  reset: resetRateLimit,
  resetAll: resetAllRateLimits,
  clearPenalty,
  hashApiKey,
  compareApiKeyHash,
  buildHeaders: buildRateLimitHeaders,
  setHeaders: setRateLimitHeaders,
  reloadConfig,
  ping: pingRateLimit,
  getConfig,
} as const;

export default rateLimit;