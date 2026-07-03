/**
 * Redis Client Singleton
 *
 * Connection pooling, error handling, caching, and session store utilities.
 * Uses ioredis under the hood — production-grade, cluster/Sentinel-ready.
 *
 * Environment Variables:
 *   REDIS_URL          — full connection string (redis://user:pass@host:port/db)
 *   REDIS_HOST         — default: 127.0.0.1
 *   REDIS_PORT         — default: 6379
 *   REDIS_PASSWORD     — default: (none)
 *   REDIS_DB           — default: 0
 *   REDIS_MAX_RETRIES  — default: 3
 *   REDIS_CONNECT_TIMEOUT_MS — default: 10000
 *   REDIS_ENABLE_OFFLINE_QUEUE — default: false (fail-fast in serverless)
 */

import { Redis, type RedisOptions } from "ioredis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheEntry<T = unknown> {
  value: T;
  /** Unix timestamp (ms) when the entry expires */
  expiresAt: number | null;
}

export type CacheSetMode = "EX" | "PX" | "EXAT" | "PXAT" | "KEEPTTL";

export interface CacheSetOptions {
  /** Expiration in seconds (EX) */
  ex?: number;
  /** Expiration in milliseconds (PX) */
  px?: number;
  /** Set only if key does not exist */
  nx?: boolean;
  /** Set only if key exists */
  xx?: boolean;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function buildRedisOptions(): RedisOptions {
  const url = process.env.REDIS_URL;

  if (url) {
    // ioredis handles URL parsing natively, but we merge with explicit overrides
    const parsed = new URL(url);
    return {
      host: process.env.REDIS_HOST || parsed.hostname || "127.0.0.1",
      port: Number(process.env.REDIS_PORT || parsed.port || 6379),
      password:
        process.env.REDIS_PASSWORD ||
        decodeURIComponent(parsed.password || "") ||
        undefined,
      db: Number(process.env.REDIS_DB || parsed.pathname?.replace("/", "") || 0),
      maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES || 3),
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 10000),
      enableOfflineQueue:
        process.env.REDIS_ENABLE_OFFLINE_QUEUE === "true" ? true : false,
      retryStrategy(times: number): number | void {
        const maxRetries = Number(process.env.REDIS_MAX_RETRIES || 3);
        if (times > maxRetries) {
          // Stop retrying after max retries
          return;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
      // Keep connections alive
      keepAlive: 30000,
    };
  }

  // Fallback: construct from individual vars
  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
    maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES || 3),
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 10000),
    enableOfflineQueue:
      process.env.REDIS_ENABLE_OFFLINE_QUEUE === "true" ? true : false,
    retryStrategy(times: number): number | void {
      const maxRetries = Number(process.env.REDIS_MAX_RETRIES || 3);
      if (times > maxRetries) {
        return;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: false,
    keepAlive: 30000,
  };
}

// ---------------------------------------------------------------------------
// Global Singleton
// ---------------------------------------------------------------------------

const globalForRedis = globalThis as unknown as {
  __redis: Redis | undefined;
  __redisInitialized: boolean;
};

function createRedisClient(): Redis {
  const options = buildRedisOptions();
  const client = new Redis(options);

  client.on("connect", () => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[redis] connected");
    }
  });

  client.on("ready", () => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[redis] ready");
    }
  });

  client.on("error", (err: Error) => {
    console.error("[redis] error:", err.message);
  });

  client.on("close", () => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[redis] connection closed");
    }
  });

  client.on("reconnecting", () => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[redis] reconnecting...");
    }
  });

  return client;
}

/**
 * Returns the shared Redis client instance.
 * Safe to call multiple times — always returns the same singleton.
 */
export function getRedisClient(): Redis {
  if (!globalForRedis.__redis) {
    globalForRedis.__redis = createRedisClient();
    globalForRedis.__redisInitialized = true;
  }
  return globalForRedis.__redis;
}

/**
 * Gracefully close the Redis connection.
 * Call during server shutdown (e.g., SIGTERM handler).
 */
export async function closeRedis(): Promise<void> {
  if (globalForRedis.__redis) {
    await globalForRedis.__redis.quit();
    globalForRedis.__redis = undefined;
    globalForRedis.__redisInitialized = false;
  }
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Check if Redis is reachable.
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cache Helpers
// ---------------------------------------------------------------------------

/**
 * Set a value in the cache with optional TTL.
 * Automatically serializes objects to JSON.
 */
export async function cacheSet<T = unknown>(
  key: string,
  value: T,
  opts: CacheSetOptions = {},
): Promise<"OK" | null> {
  const client = getRedisClient();
  const serialized = typeof value === "string" ? value : JSON.stringify(value);

  // Build pipeline arguments
  const args: (string | number)[] = [key, serialized];

  if (opts.ex !== undefined) {
    args.push("EX", opts.ex);
  } else if (opts.px !== undefined) {
    args.push("PX", opts.px);
  }

  if (opts.nx) {
    args.push("NX");
  } else if (opts.xx) {
    args.push("XX");
  }

  return client.set(...(args as [string, string, ...(string | number)[]]));
}

/**
 * Get a cached value.
 * Automatically deserializes JSON. Returns null on miss.
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const raw = await client.get(key);
  if (raw === null) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

/**
 * Delete one or more cache keys.
 */
export async function cacheDel(...keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const client = getRedisClient();
  return client.del(...keys);
}

/**
 * Check if a key exists.
 */
export async function cacheHas(key: string): Promise<boolean> {
  const client = getRedisClient();
  return (await client.exists(key)) === 1;
}

/**
 * Get the remaining TTL of a key in seconds.
 * Returns -1 if no expiry, -2 if key does not exist.
 */
export async function cacheTTL(key: string): Promise<number> {
  const client = getRedisClient();
  return client.ttl(key);
}

/**
 * Set expiration on an existing key.
 */
export async function cacheExpire(
  key: string,
  seconds: number,
): Promise<boolean> {
  const client = getRedisClient();
  return (await client.expire(key, seconds)) === 1;
}

/**
 * Atomically increment a counter.
 */
export async function cacheIncr(key: string, by = 1): Promise<number> {
  const client = getRedisClient();
  return by === 1 ? client.incr(key) : client.incrby(key, by);
}

/**
 * Atomically decrement a counter.
 */
export async function cacheDecr(key: string, by = 1): Promise<number> {
  const client = getRedisClient();
  return by === 1 ? client.decr(key) : client.decrby(key, by);
}

/**
 * Get-and-set (atomic). Returns the old value.
 */
export async function cacheGetSet<T = unknown>(
  key: string,
  value: T,
): Promise<T | null> {
  const client = getRedisClient();
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const oldRaw = await client.getset(key, serialized);
  if (oldRaw === null) return null;

  try {
    return JSON.parse(oldRaw) as T;
  } catch {
    return oldRaw as unknown as T;
  }
}

/**
 * Set multiple key-value pairs at once (MSET).
 */
export async function cacheSetMany(
  entries: Record<string, unknown>,
): Promise<"OK"> {
  const client = getRedisClient();
  const flat: string[] = [];
  for (const [key, value] of Object.entries(entries)) {
    flat.push(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  return client.mset(...flat);
}

/**
 * Get multiple keys at once (MGET).
 */
export async function cacheGetMany<T = unknown>(
  keys: string[],
): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  const client = getRedisClient();
  const raw = await client.mget(...keys);
  return raw.map((r) => {
    if (r === null) return null;
    try {
      return JSON.parse(r) as T;
    } catch {
      return r as unknown as T;
    }
  });
}

/**
 * Acquire a simple distributed lock via SET NX.
 * Returns true if the lock was acquired.
 */
export async function cacheLock(
  lockKey: string,
  ttlSeconds = 30,
): Promise<boolean> {
  const client = getRedisClient();
  const result = await client.set(lockKey, "1", "EX", ttlSeconds, "NX");
  return result === "OK";
}

/**
 * Release a distributed lock.
 */
export async function cacheUnlock(lockKey: string): Promise<number> {
  const client = getRedisClient();
  return client.del(lockKey);
}

/**
 * Execute a callback under a distributed lock.
 * The lock is automatically released after the callback completes (or after TTL).
 */
export async function cacheWithLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  ttlSeconds = 30,
): Promise<T | null> {
  const acquired = await cacheLock(lockKey, ttlSeconds);
  if (!acquired) return null;

  try {
    return await fn();
  } finally {
    await cacheUnlock(lockKey);
  }
}

// ---------------------------------------------------------------------------
// Session Store Helpers (for next-auth / custom session management)
// ---------------------------------------------------------------------------

const SESSION_PREFIX = "session:";

/**
 * Store a session object.
 */
export async function sessionSet(
  sessionId: string,
  data: Record<string, unknown>,
  ttlSeconds = 86400, // 24h default
): Promise<"OK" | null> {
  return cacheSet(`${SESSION_PREFIX}${sessionId}`, data, { ex: ttlSeconds });
}

/**
 * Retrieve a session object.
 */
export async function sessionGet<T = Record<string, unknown>>(
  sessionId: string,
): Promise<T | null> {
  return cacheGet<T>(`${SESSION_PREFIX}${sessionId}`);
}

/**
 * Delete a session.
 */
export async function sessionDel(sessionId: string): Promise<number> {
  return cacheDel(`${SESSION_PREFIX}${sessionId}`);
}

/**
 * Touch a session (refresh its TTL).
 */
export async function sessionTouch(
  sessionId: string,
  ttlSeconds = 86400,
): Promise<boolean> {
  return cacheExpire(`${SESSION_PREFIX}${sessionId}`, ttlSeconds);
}

// ---------------------------------------------------------------------------
// Rate Limiting Helpers (sliding window)
// ---------------------------------------------------------------------------

/**
 * Simple sliding-window rate limit check.
 * Returns the number of remaining requests in the current window.
 */
export async function rateLimitCheck(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const client = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  const pipeline = client.pipeline();
  // Remove entries outside the window
  pipeline.zremrangebyscore(key, 0, windowStart);
  // Count entries in the window
  pipeline.zcard(key);
  // Add the current request
  pipeline.zadd(key, now, `${now}-${Math.random().toString(36).slice(2)}`);
  // Set expiry on the sorted set key itself
  pipeline.expire(key, windowSeconds + 1);

  const results = await pipeline.exec();
  const count = (results?.[1]?.[1] as number) ?? 0;

  const remaining = Math.max(0, maxRequests - count - 1);
  const allowed = remaining >= 0;
  const resetAt = now + windowSeconds * 1000;

  return { allowed, remaining, resetAt };
}

// ---------------------------------------------------------------------------
// Convenience: Default Export
// ---------------------------------------------------------------------------

const redis = {
  getClient: getRedisClient,
  close: closeRedis,
  ping: pingRedis,
  get: cacheGet,
  set: cacheSet,
  del: cacheDel,
  has: cacheHas,
  ttl: cacheTTL,
  expire: cacheExpire,
  incr: cacheIncr,
  decr: cacheDecr,
  getSet: cacheGetSet,
  setMany: cacheSetMany,
  getMany: cacheGetMany,
  lock: cacheLock,
  unlock: cacheUnlock,
  withLock: cacheWithLock,
  session: {
    set: sessionSet,
    get: sessionGet,
    del: sessionDel,
    touch: sessionTouch,
  },
  rateLimit: rateLimitCheck,
} as const;

export default redis;