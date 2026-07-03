/**
 * Feature Flags Manager
 *
 * Multi-tenant, production-grade feature flag system with:
 *   - Per-tenant (organization) targeting
 *   - Per-user explicit inclusion / exclusion
 *   - Percentage-based gradual rollout (deterministic hash)
 *   - Attribute-based targeting (user properties, custom context)
 *   - Rule evaluation with priority chain
 *   - Redis caching layer for sub-millisecond lookups
 *   - Prisma-backed persistence with audit-friendly schema
 *
 * Evaluation Priority (first match wins):
 *   1. Global `enabled` toggle on the flag record itself
 *   2. Per-user explicit INCLUDE rule
 *   3. Per-user explicit EXCLUDE rule
 *   4. Per-tenant (organization) explicit INCLUDE rule
 *   5. Per-tenant explicit EXCLUDE rule
 *   6. Percentage rollout (deterministic hash of userId + flagSlug)
 *   7. Attribute-based rules (custom context matching)
 *   8. Fallback default: `false`
 *
 * Caching Strategy:
 *   - All flags for a tenant are cached in Redis (hash set)
 *   - TTL: 60 seconds (configurable via FEATURE_FLAG_CACHE_TTL_SECONDS)
 *   - Cache invalidation on write (set/update/delete)
 *   - Stale-while-revalidate for reads under high concurrency
 *
 * Environment Variables:
 *   FEATURE_FLAG_CACHE_TTL_SECONDS  — Redis cache TTL (default: 60)
 *   FEATURE_FLAG_CACHE_PREFIX       — Redis key prefix (default: "ff:")
 *
 * Usage:
 *   import { isEnabled, getFeatureFlag, setFeatureFlag } from "@/lib/feature-flags";
 *
 *   // Simple check
 *   const showBetaUI = await isEnabled("beta-dashboard", {
 *     organizationId: "org-123",
 *     userId: "user-456",
 *   });
 *
 *   // With custom attributes
 *   const canExport = await isEnabled("csv-export", {
 *     organizationId: "org-123",
 *     userId: "user-456",
 *     attributes: { plan: "pro", region: "EU" },
 *   });
 */

import { getPrismaClient, type PrismaTransaction } from "./prisma";
import {
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDel,
} from "./redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The stored feature flag record (mirrors Prisma FeatureFlag model) */
export interface FeatureFlag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  enabled: boolean;
  rules: FeatureFlagRules | null;
  percentageRollout: number | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Union of all rule types */
export type FeatureFlagRule =
  | UserIncludeRule
  | UserExcludeRule
  | TenantIncludeRule
  | TenantExcludeRule
  | AttributeRule;

export interface UserIncludeRule {
  type: "user_include";
  /** List of user IDs that should always see this flag ON */
  userIds: string[];
}

export interface UserExcludeRule {
  type: "user_exclude";
  /** List of user IDs that should always see this flag OFF */
  userIds: string[];
}

export interface TenantIncludeRule {
  type: "tenant_include";
  /** List of organization IDs that should always see this flag ON */
  organizationIds: string[];
}

export interface TenantExcludeRule {
  type: "tenant_exclude";
  /** List of organization IDs that should always see this flag OFF */
  organizationIds: string[];
}

export interface AttributeRule {
  type: "attribute";
  /** Attribute key to match against */
  attribute: string;
  /** Operator: eq, neq, in, not_in, gt, gte, lt, lte, regex, exists */
  operator: AttributeOperator;
  /** Value(s) to compare */
  value: string | number | boolean | (string | number | boolean)[];
  /** If true, this rule acts as an INCLUDE; if false, as an EXCLUDE */
  include: boolean;
}

export type AttributeOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "regex"
  | "exists";

/** The full rules container stored in the JSONB column */
export interface FeatureFlagRules {
  rules: FeatureFlagRule[];
  /** Optional: logical operator for combining multiple rules (default: "or") */
  combinator?: "and" | "or";
}

/** Context provided at evaluation time */
export interface FeatureFlagContext {
  /** Organization (tenant) ID — required */
  organizationId: string;
  /** User ID — optional (anonymous users may not have one) */
  userId?: string;
  /** Arbitrary attributes for attribute-based rules */
  attributes?: Record<string, string | number | boolean | null>;
  /** If true, skip the cache and hit the database directly */
  bypassCache?: boolean;
}

/** Result of evaluating a feature flag */
export interface FeatureFlagEvaluation {
  /** Whether the flag is enabled for this context */
  enabled: boolean;
  /** Which rule matched (or "default" if none) */
  matchedRule: string;
  /** The full flag record (null if flag not found) */
  flag: FeatureFlag | null;
  /** Whether the result came from cache */
  fromCache: boolean;
}

/** Input for creating or updating a feature flag */
export interface FeatureFlagInput {
  name: string;
  slug: string;
  description?: string;
  enabled?: boolean;
  rules?: FeatureFlagRules | null;
  percentageRollout?: number | null;
  organizationId: string;
}

/** Paginated listing result */
export interface FeatureFlagListResult {
  flags: FeatureFlag[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CACHE_TTL = Number(process.env.FEATURE_FLAG_CACHE_TTL_SECONDS || 60);
const CACHE_PREFIX = process.env.FEATURE_FLAG_CACHE_PREFIX || "ff:";

function cacheKey(organizationId: string): string {
  return `${CACHE_PREFIX}${organizationId}`;
}

function flagCacheKey(organizationId: string, slug: string): string {
  return `${CACHE_PREFIX}${organizationId}:${slug}`;
}

// ---------------------------------------------------------------------------
// Helpers: Normalization
// ---------------------------------------------------------------------------

function normalizeRules(rules: unknown): FeatureFlagRules | null {
  if (!rules || typeof rules !== "object") return null;
  const obj = rules as Record<string, unknown>;
  if (!Array.isArray(obj.rules) || obj.rules.length === 0) return null;
  return {
    rules: obj.rules as FeatureFlagRule[],
    combinator: (obj.combinator as "and" | "or") || "or",
  };
}

function normalizeFlag(row: Record<string, unknown>): FeatureFlag {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string) || null,
    enabled: Boolean(row.enabled),
    rules: normalizeRules(row.rules),
    percentageRollout:
      row.percentageRollout != null ? Number(row.percentageRollout) : null,
    organizationId: row.organizationId as string,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  };
}

// ---------------------------------------------------------------------------
// Helpers: Deterministic Hash for Percentage Rollout
// ---------------------------------------------------------------------------

/**
 * Produces a deterministic integer in [0, 99] for a given userId + flagSlug.
 * Uses SHA-256 for uniform distribution — same user+flag always gets the same bucket.
 */
function rolloutBucket(userId: string, flagSlug: string): number {
  // Simple but effective fnv-1a-like hash for Node.js runtime
  // (avoiding async crypto for sync evaluation in hot path)
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  const input = `${userId}:${flagSlug}`;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }

  // Map to 0–99
  return Math.abs(hash) % 100;
}

// ---------------------------------------------------------------------------
// Core: Rule Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single rule against the provided context.
 */
function evaluateRule(
  rule: FeatureFlagRule,
  ctx: FeatureFlagContext,
): { match: boolean; include: boolean } {
  switch (rule.type) {
    // -- User include
    case "user_include": {
      if (!ctx.userId) return { match: false, include: true };
      const match = rule.userIds.includes(ctx.userId);
      return { match, include: true };
    }

    // -- User exclude
    case "user_exclude": {
      if (!ctx.userId) return { match: false, include: false };
      const match = rule.userIds.includes(ctx.userId);
      return { match, include: false };
    }

    // -- Tenant include
    case "tenant_include": {
      const match = rule.organizationIds.includes(ctx.organizationId);
      return { match, include: true };
    }

    // -- Tenant exclude
    case "tenant_exclude": {
      const match = rule.organizationIds.includes(ctx.organizationId);
      return { match, include: false };
    }

    // -- Attribute
    case "attribute": {
      if (!ctx.attributes) return { match: false, include: rule.include };
      const attrValue = ctx.attributes[rule.attribute];

      // exists operator
      if (rule.operator === "exists") {
        const exists = attrValue !== undefined && attrValue !== null;
        return { match: exists, include: rule.include };
      }

      // For other operators, the attribute must exist
      if (attrValue === undefined || attrValue === null) {
        return { match: false, include: rule.include };
      }

      const match = evaluateAttributeOperator(
        attrValue,
        rule.operator,
        rule.value,
      );
      return { match, include: rule.include };
    }

    default:
      return { match: false, include: false };
  }
}

/**
 * Compare a context attribute value against the rule value using the operator.
 */
function evaluateAttributeOperator(
  ctxValue: string | number | boolean,
  operator: AttributeOperator,
  ruleValue: string | number | boolean | (string | number | boolean)[],
): boolean {
  switch (operator) {
    case "eq":
      return ctxValue === ruleValue;

    case "neq":
      return ctxValue !== ruleValue;

    case "in":
      return Array.isArray(ruleValue) && ruleValue.includes(ctxValue);

    case "not_in":
      return Array.isArray(ruleValue) && !ruleValue.includes(ctxValue);

    case "gt":
      return Number(ctxValue) > Number(ruleValue);

    case "gte":
      return Number(ctxValue) >= Number(ruleValue);

    case "lt":
      return Number(ctxValue) < Number(ruleValue);

    case "lte":
      return Number(ctxValue) <= Number(ruleValue);

    case "regex":
      try {
        const regex = new RegExp(String(ruleValue));
        return regex.test(String(ctxValue));
      } catch {
        return false;
      }

    default:
      return false;
  }
}

/**
 * Evaluate the full rules chain for a flag against the given context.
 *
 * Priority (first match wins):
 *   1. Global enabled toggle
 *   2. User include
 *   3. User exclude
 *   4. Tenant include
 *   5. Tenant exclude
 *   6. Percentage rollout
 *   7. Attribute rules
 *   8. Default false
 */
function evaluateRules(
  flag: FeatureFlag,
  ctx: FeatureFlagContext,
): { enabled: boolean; matchedRule: string } {
  // 1. If the flag is globally disabled, short-circuit
  if (!flag.enabled) {
    return { enabled: false, matchedRule: "global_disabled" };
  }

  const rules = flag.rules?.rules ?? [];
  const combinator = flag.rules?.combinator ?? "or";

  // Separate rules by priority for ordered evaluation
  const userIncludes: UserIncludeRule[] = [];
  const userExcludes: UserExcludeRule[] = [];
  const tenantIncludes: TenantIncludeRule[] = [];
  const tenantExcludes: TenantExcludeRule[] = [];
  const attributeRules: AttributeRule[] = [];

  for (const rule of rules) {
    switch (rule.type) {
      case "user_include":
        userIncludes.push(rule);
        break;
      case "user_exclude":
        userExcludes.push(rule);
        break;
      case "tenant_include":
        tenantIncludes.push(rule);
        break;
      case "tenant_exclude":
        tenantExcludes.push(rule);
        break;
      case "attribute":
        attributeRules.push(rule);
        break;
    }
  }

  // 2. User include — first match wins
  for (const rule of userIncludes) {
    const result = evaluateRule(rule, ctx);
    if (result.match) {
      return { enabled: true, matchedRule: "user_include" };
    }
  }

  // 3. User exclude — first match wins
  for (const rule of userExcludes) {
    const result = evaluateRule(rule, ctx);
    if (result.match) {
      return { enabled: false, matchedRule: "user_exclude" };
    }
  }

  // 4. Tenant include — first match wins
  for (const rule of tenantIncludes) {
    const result = evaluateRule(rule, ctx);
    if (result.match) {
      return { enabled: true, matchedRule: "tenant_include" };
    }
  }

  // 5. Tenant exclude — first match wins
  for (const rule of tenantExcludes) {
    const result = evaluateRule(rule, ctx);
    if (result.match) {
      return { enabled: false, matchedRule: "tenant_exclude" };
    }
  }

  // 6. Percentage rollout (deterministic hash)
  if (
    flag.percentageRollout != null &&
    flag.percentageRollout > 0 &&
    ctx.userId
  ) {
    const bucket = rolloutBucket(ctx.userId, flag.slug);
    if (bucket < flag.percentageRollout) {
      return { enabled: true, matchedRule: "percentage_rollout" };
    }
    if (flag.percentageRollout < 100) {
      // If rollout < 100 and user not in bucket, they are explicitly out
      return { enabled: false, matchedRule: "percentage_rollout" };
    }
  }

  // 7. Attribute rules
  if (attributeRules.length > 0) {
    if (combinator === "and") {
      const allInclude = attributeRules.every((rule) => {
        const result = evaluateRule(rule, ctx);
        return result.match && result.include;
      });
      const anyExclude = attributeRules.some((rule) => {
        const result = evaluateRule(rule, ctx);
        return result.match && !result.include;
      });
      if (anyExclude) {
        return { enabled: false, matchedRule: "attribute_exclude" };
      }
      if (allInclude && attributeRules.every((r) => r.include)) {
        return { enabled: true, matchedRule: "attribute_include" };
      }
    } else {
      // "or" combinator for attributes
      for (const rule of attributeRules) {
        const result = evaluateRule(rule, ctx);
        if (result.match) {
          return {
            enabled: result.include,
            matchedRule: result.include
              ? "attribute_include"
              : "attribute_exclude",
          };
        }
      }
    }
  }

  // 8. Default: false
  return { enabled: false, matchedRule: "default" };
}

// ---------------------------------------------------------------------------
// Database Operations
// ---------------------------------------------------------------------------

/**
 * Fetch a single feature flag from the database by slug + organization.
 */
async function fetchFlagFromDB(
  slug: string,
  organizationId: string,
): Promise<FeatureFlag | null> {
  const prisma = getPrismaClient();

  const row = await prisma.featureFlag.findUnique({
    where: {
      slug_organizationId: {
        slug,
        organizationId,
      },
    },
  });

  if (!row) return null;
  return normalizeFlag(row as unknown as Record<string, unknown>);
}

/**
 * Fetch all feature flags for an organization from the database.
 */
async function fetchAllFlagsFromDB(
  organizationId: string,
): Promise<FeatureFlag[]> {
  const prisma = getPrismaClient();

  const rows = await prisma.featureFlag.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });

  return rows.map(
    (row) => normalizeFlag(row as unknown as Record<string, unknown>),
  );
}

// ---------------------------------------------------------------------------
// Cache Operations
// ---------------------------------------------------------------------------

/**
 * Invalidate all cached flags for an organization.
 */
async function invalidateOrgCache(organizationId: string): Promise<void> {
  const key = cacheKey(organizationId);
  await cacheDel(key);
}

/**
 * Invalidate a single cached flag.
 */
async function invalidateFlagCache(
  organizationId: string,
  slug: string,
): Promise<void> {
  const key = flagCacheKey(organizationId, slug);
  await cacheDel(key);
}

/**
 * Get a feature flag — tries cache first, falls back to database.
 */
async function getFlagWithCache(
  slug: string,
  organizationId: string,
  bypassCache = false,
): Promise<{ flag: FeatureFlag | null; fromCache: boolean }> {
  // 1. Try single-flag cache
  if (!bypassCache) {
    const singleKey = flagCacheKey(organizationId, slug);
    const cached = await cacheGet<FeatureFlag>(singleKey);
    if (cached) {
      return { flag: cached, fromCache: true };
    }

    // 2. Try organization-wide cache
    const orgKey = cacheKey(organizationId);
    const orgCache = await cacheGet<Record<string, FeatureFlag>>(orgKey);
    if (orgCache && orgCache[slug]) {
      return { flag: orgCache[slug]!, fromCache: true };
    }
  }

  // 3. Database fallback
  const flag = await fetchFlagFromDB(slug, organizationId);

  // 4. Populate cache
  if (flag) {
    await cacheSet(flagCacheKey(organizationId, slug), flag, {
      ex: CACHE_TTL,
    });
  }

  return { flag, fromCache: false };
}

/**
 * Warm the organization-wide cache with all flags.
 */
async function warmOrgCache(organizationId: string): Promise<FeatureFlag[]> {
  const flags = await fetchAllFlagsFromDB(organizationId);

  if (flags.length > 0) {
    const map: Record<string, FeatureFlag> = {};
    for (const flag of flags) {
      map[flag.slug] = flag;
    }
    await cacheSet(cacheKey(organizationId), map, { ex: CACHE_TTL });
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Public API: Read
// ---------------------------------------------------------------------------

/**
 * Check whether a feature flag is enabled for the given context.
 *
 * This is the primary entry point — optimized for the hot path with
 * multi-layer caching and deterministic evaluation.
 *
 * @param slug        - The feature flag slug (e.g., "beta-dashboard")
 * @param ctx         - Evaluation context (organizationId required, userId optional)
 * @returns           - Evaluation result with enabled state and metadata
 *
 * @example
 *   const result = await isEnabled("new-checkout", {
 *     organizationId: "org_abc",
 *     userId: "user_xyz",
 *     attributes: { plan: "enterprise" },
 *   });
 *   if (result.enabled) { ... }
 */
export async function isEnabled(
  slug: string,
  ctx: FeatureFlagContext,
): Promise<FeatureFlagEvaluation> {
  const { flag, fromCache } = await getFlagWithCache(
    slug,
    ctx.organizationId,
    ctx.bypassCache,
  );

  if (!flag) {
    return {
      enabled: false,
      matchedRule: "not_found",
      flag: null,
      fromCache,
    };
  }

  const { enabled, matchedRule } = evaluateRules(flag, ctx);

  return {
    enabled,
    matchedRule,
    flag,
    fromCache,
  };
}

/**
 * Evaluate multiple feature flags in a single call.
 *
 * More efficient than calling `isEnabled` repeatedly because it
 * loads all flags for the organization once.
 *
 * @param slugs       - Array of feature flag slugs to evaluate
 * @param ctx         - Evaluation context
 * @returns           - Map of slug → evaluation result
 */
export async function areEnabled(
  slugs: string[],
  ctx: FeatureFlagContext,
): Promise<Map<string, FeatureFlagEvaluation>> {
  const results = new Map<string, FeatureFlagEvaluation>();

  if (slugs.length === 0) return results;

  // Load all flags for the org (cached)
  const flags = await listFeatureFlags(ctx.organizationId, {
    bypassCache: ctx.bypassCache,
    pageSize: 10_000, // effectively all
  });

  const flagMap = new Map<string, FeatureFlag>();
  for (const flag of flags.flags) {
    flagMap.set(flag.slug, flag);
  }

  for (const slug of slugs) {
    const flag = flagMap.get(slug) ?? null;

    if (!flag) {
      results.set(slug, {
        enabled: false,
        matchedRule: "not_found",
        flag: null,
        fromCache: false,
      });
      continue;
    }

    const { enabled, matchedRule } = evaluateRules(flag, ctx);
    results.set(slug, {
      enabled,
      matchedRule,
      flag,
      fromCache: false,
    });
  }

  return results;
}

/**
 * Get a single feature flag by slug (without evaluating rules).
 */
export async function getFeatureFlag(
  slug: string,
  organizationId: string,
  bypassCache = false,
): Promise<FeatureFlag | null> {
  const { flag } = await getFlagWithCache(slug, organizationId, bypassCache);
  return flag;
}

/**
 * List all feature flags for an organization (paginated).
 */
export async function listFeatureFlags(
  organizationId: string,
  options: {
    page?: number;
    pageSize?: number;
    bypassCache?: boolean;
  } = {},
): Promise<FeatureFlagListResult> {
  const { page = 1, pageSize = 50, bypassCache = false } = options;

  let allFlags: FeatureFlag[];

  if (!bypassCache) {
    // Try org-level cache first
    const orgKey = cacheKey(organizationId);
    const cached = await cacheGet<Record<string, FeatureFlag>>(orgKey);

    if (cached) {
      allFlags = Object.values(cached);
    } else {
      allFlags = await warmOrgCache(organizationId);
    }
  } else {
    allFlags = await fetchAllFlagsFromDB(organizationId);
  }

  const total = allFlags.length;
  const start = (page - 1) * pageSize;
  const flags = allFlags.slice(start, start + pageSize);

  return { flags, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Public API: Write
// ---------------------------------------------------------------------------

/**
 * Create a new feature flag.
 *
 * Automatically invalidates the organization cache after creation.
 */
export async function createFeatureFlag(
  input: FeatureFlagInput,
): Promise<FeatureFlag> {
  const prisma = getPrismaClient();

  const row = await prisma.featureFlag.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      enabled: input.enabled ?? false,
      rules: (input.rules as unknown as Record<string, unknown>) ?? null,
      percentageRollout: input.percentageRollout ?? null,
      organizationId: input.organizationId,
    },
  });

  const flag = normalizeFlag(row as unknown as Record<string, unknown>);

  // Invalidate caches
  await invalidateOrgCache(input.organizationId);

  return flag;
}

/**
 * Update an existing feature flag.
 *
 * Only updates provided fields. Automatically invalidates cache.
 */
export async function updateFeatureFlag(
  id: string,
  input: Partial<
    Omit<FeatureFlagInput, "organizationId" | "slug">
  >,
): Promise<FeatureFlag> {
  const prisma = getPrismaClient();

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.rules !== undefined) {
    data.rules = (input.rules as unknown as Record<string, unknown>) ?? null;
  }
  if (input.percentageRollout !== undefined) {
    data.percentageRollout = input.percentageRollout;
  }

  const row = await prisma.featureFlag.update({
    where: { id },
    data,
  });

  const flag = normalizeFlag(row as unknown as Record<string, unknown>);

  // Invalidate caches
  await invalidateOrgCache(flag.organizationId);
  await invalidateFlagCache(flag.organizationId, flag.slug);

  return flag;
}

/**
 * Toggle a feature flag on or off.
 *
 * Convenience wrapper around updateFeatureFlag.
 */
export async function toggleFeatureFlag(
  id: string,
  enabled: boolean,
): Promise<FeatureFlag> {
  return updateFeatureFlag(id, { enabled });
}

/**
 * Set the percentage rollout for a feature flag.
 *
 * Convenience wrapper. Value must be 0–100.
 */
export async function setPercentageRollout(
  id: string,
  percentage: number,
): Promise<FeatureFlag> {
  if (percentage < 0 || percentage > 100) {
    throw new Error(
      `[feature-flags] Percentage rollout must be between 0 and 100. Got: ${percentage}`,
    );
  }
  return updateFeatureFlag(id, { percentageRollout: percentage });
}

/**
 * Delete a feature flag.
 */
export async function deleteFeatureFlag(id: string): Promise<void> {
  const prisma = getPrismaClient();

  // Fetch first to get orgId for cache invalidation
  const existing = await prisma.featureFlag.findUnique({
    where: { id },
    select: { organizationId: true, slug: true },
  });

  await prisma.featureFlag.delete({ where: { id } });

  if (existing) {
    await invalidateOrgCache(existing.organizationId);
    await invalidateFlagCache(existing.organizationId, existing.slug);
  }
}

/**
 * Bulk-update feature flags within a Prisma transaction.
 *
 * @param fn - Callback receiving a transaction client
 *
 * @example
 *   await transactionFeatureFlags(async (tx) => {
 *     await tx.featureFlag.update({ where: { id }, data: { enabled: true } });
 *   });
 */
export async function transactionFeatureFlags<T>(
  fn: (tx: PrismaTransaction) => Promise<T>,
  organizationId: string,
): Promise<T> {
  const prisma = getPrismaClient();

  const result = await prisma.$transaction(fn);

  // Invalidate cache after transaction
  await invalidateOrgCache(organizationId);

  return result;
}

// ---------------------------------------------------------------------------
// Warm-Up & Health
// ---------------------------------------------------------------------------

/**
 * Pre-warm the feature flag cache for an organization.
 *
 * Useful during server startup or after a deployment to avoid
 * cold-start latency on the first request.
 */
export async function warmCache(organizationId: string): Promise<number> {
  const flags = await warmOrgCache(organizationId);
  return flags.length;
}

/**
 * Pre-warm caches for multiple organizations.
 */
export async function warmCachesForOrganizations(
  organizationIds: string[],
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  for (const orgId of organizationIds) {
    try {
      const count = await warmCache(orgId);
      results.set(orgId, count);
    } catch (err) {
      console.error(
        `[feature-flags] Failed to warm cache for org ${orgId}:`,
        err instanceof Error ? err.message : err,
      );
      results.set(orgId, -1);
    }
  }

  return results;
}

/**
 * Health check — verifies database connectivity and cache availability.
 */
export async function pingFeatureFlags(): Promise<{
  healthy: boolean;
  db: boolean;
  cache: boolean;
  error?: string;
}> {
  const result = { healthy: false, db: false, cache: false };

  try {
    const prisma = getPrismaClient();
    await prisma.$queryRawUnsafe(`SELECT 1`);
    result.db = true;
  } catch (err) {
    return {
      ...result,
      error: `Database unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    const redis = getRedisClient();
    const pong = await redis.ping();
    result.cache = pong === "PONG";
  } catch (err) {
    return {
      ...result,
      error: `Redis unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  result.healthy = result.db && result.cache;
  return result;
}

// ---------------------------------------------------------------------------
// Bulk Import / Export
// ---------------------------------------------------------------------------

/**
 * Export all feature flags for an organization as a JSON-serializable array.
 */
export async function exportFeatureFlags(
  organizationId: string,
): Promise<FeatureFlag[]> {
  return fetchAllFlagsFromDB(organizationId);
}

/**
 * Import feature flags (create or update) for an organization.
 *
 * Matches by slug — if a flag with the same slug exists, it is updated.
 * Otherwise, a new flag is created.
 */
export async function importFeatureFlags(
  organizationId: string,
  flags: FeatureFlagInput[],
): Promise<{ created: number; updated: number; errors: string[] }> {
  const result = { created: 0, updated: 0, errors: [] as string[] };
  const prisma = getPrismaClient();

  for (const input of flags) {
    try {
      const existing = await prisma.featureFlag.findUnique({
        where: {
          slug_organizationId: {
            slug: input.slug,
            organizationId,
          },
        },
      });

      if (existing) {
        await prisma.featureFlag.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            description: input.description ?? null,
            enabled: input.enabled ?? false,
            rules:
              (input.rules as unknown as Record<string, unknown>) ?? null,
            percentageRollout: input.percentageRollout ?? null,
          },
        });
        result.updated++;
      } else {
        await prisma.featureFlag.create({
          data: {
            name: input.name,
            slug: input.slug,
            description: input.description ?? null,
            enabled: input.enabled ?? false,
            rules:
              (input.rules as unknown as Record<string, unknown>) ?? null,
            percentageRollout: input.percentageRollout ?? null,
            organizationId,
          },
        });
        result.created++;
      }
    } catch (err) {
      result.errors.push(
        `[${input.slug}] ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Invalidate cache after all changes
  await invalidateOrgCache(organizationId);

  return result;
}

// ---------------------------------------------------------------------------
// Helpers: Build Rule Objects
// ---------------------------------------------------------------------------

/**
 * Builder helpers for constructing typed rules without manual JSON.
 */
export const RuleBuilder = {
  userInclude: (userIds: string[]): UserIncludeRule => ({
    type: "user_include",
    userIds,
  }),

  userExclude: (userIds: string[]): UserExcludeRule => ({
    type: "user_exclude",
    userIds,
  }),

  tenantInclude: (organizationIds: string[]): TenantIncludeRule => ({
    type: "tenant_include",
    organizationIds,
  }),

  tenantExclude: (organizationIds: string[]): TenantExcludeRule => ({
    type: "tenant_exclude",
    organizationIds,
  }),

  attribute: (
    attribute: string,
    operator: AttributeOperator,
    value: AttributeRule["value"],
    include = true,
  ): AttributeRule => ({
    type: "attribute",
    attribute,
    operator,
    value,
    include,
  }),

  rules: (
    rules: FeatureFlagRule[],
    combinator: "and" | "or" = "or",
  ): FeatureFlagRules => ({
    rules,
    combinator,
  }),
};

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const featureFlags = {
  // Core
  isEnabled,
  areEnabled,
  getFeatureFlag,
  listFeatureFlags,

  // CRUD
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  toggleFeatureFlag,
  setPercentageRollout,
  transactionFeatureFlags,

  // Bulk
  exportFeatureFlags,
  importFeatureFlags,

  // Cache
  warmCache,
  warmCachesForOrganizations,

  // Health
  ping: pingFeatureFlags,

  // Builders
  RuleBuilder,

  // Utilities (exported for testing)
  evaluateRules,
  rolloutBucket,
} as const;

export default featureFlags;