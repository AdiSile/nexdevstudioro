/**
 * Aggregated Health Check Endpoint
 *
 * Orchestrates readiness and liveness probes for all infrastructure dependencies:
 * Database (Prisma/PostgreSQL), Redis, Object Storage (S3/R2/MinIO),
 * Queue (BullMQ), Search Engine (Meilisearch/Elasticsearch), and Logger.
 *
 * Designed for:
 *   - Kubernetes / Nomad / Docker Compose health checks
 *   - Load balancer target group health checks (ALB, NLB, Traefik, etc.)
 *   - Monitoring dashboards (Datadog, Grafana, New Relic)
 *   - Status pages (public or internal)
 *
 * Two probe types:
 *   - Liveness  — "Is the process alive?"  (lightweight, always returns 200 if the
 *                  process is running; no dependency checks)
 *   - Readiness — "Is the process ready to serve traffic?" (checks all configured
 *                  dependencies; returns 503 if any critical dependency is down)
 *
 * Environment Variables:
 *   HEALTH_CHECK_TIMEOUT_MS      — max time per dependency check (default: 3000)
 *   HEALTH_CHECK_CRITICAL_DEPS   — comma-separated list of deps that cause 503
 *                                   if down (default: db,redis)
 *   HEALTH_CHECK_EXPOSE_STATS    — expose memory/uptime stats (default: true)
 *
 * Usage — Next.js API Route / Route Handler:
 *   // app/api/health/route.ts
 *   import { readinessProbe, livenessProbe } from "@/lib/health";
 *
 *   export async function GET(req: Request) {
 *     const url = new URL(req.url);
 *     const probe = url.searchParams.get("probe") || "readiness";
 *
 *     if (probe === "liveness") {
 *       const result = await livenessProbe();
 *       return Response.json(result, { status: 200 });
 *     }
 *
 *     const result = await readinessProbe();
 *     return Response.json(result, { status: result.status === "ok" ? 200 : 503 });
 *   }
 */

import { pingPrisma } from "@/lib/prisma";
import { pingRedis } from "@/lib/redis";
import { pingStorage } from "@/lib/storage";
import { pingQueues } from "@/lib/queue";
import { pingSearch } from "@/lib/search";
import { pingLogger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Overall health status */
export type HealthStatus = "ok" | "degraded" | "unhealthy";

/** Status of a single dependency */
export type DependencyStatus = "up" | "down" | "unknown";

/** Result of a single dependency check */
export interface DependencyCheck {
  name: string;
  status: DependencyStatus;
  latencyMs: number;
  critical: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/** Full readiness probe result */
export interface ReadinessResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  dependencies: DependencyCheck[];
  stats?: SystemStats;
}

/** Full liveness probe result */
export interface LivenessResult {
  status: "ok";
  timestamp: string;
  uptime: number;
  pid: number;
}

/** System-level statistics */
export interface SystemStats {
  memory: {
    rssMB: string;
    heapUsedMB: string;
    heapTotalMB: string;
    externalMB: string;
    percentUsed: string;
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
  nodeVersion: string;
  platform: string;
  arch: string;
  cpus: number;
}

/** Configuration for the health check orchestrator */
export interface HealthCheckConfig {
  timeoutMs: number;
  criticalDeps: string[];
  exposeStats: boolean;
}

/** A single health check function signature */
export type HealthCheckFn = () => Promise<boolean | { connected?: boolean; status?: string; error?: string; [key: string]: unknown }>;

/** Internal descriptor for a dependency check */
interface DependencyDescriptor {
  name: string;
  critical: boolean;
  check: HealthCheckFn;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CRITICAL_DEPS = ["db", "redis"];

function buildHealthConfig(): HealthCheckConfig {
  const rawCritical = process.env.HEALTH_CHECK_CRITICAL_DEPS;
  const criticalDeps = rawCritical
    ? rawCritical.split(",").map((d) => d.trim()).filter(Boolean)
    : DEFAULT_CRITICAL_DEPS;

  return {
    timeoutMs: Number(process.env.HEALTH_CHECK_TIMEOUT_MS || 3000),
    criticalDeps,
    exposeStats: process.env.HEALTH_CHECK_EXPOSE_STATS !== "false",
  };
}

// ---------------------------------------------------------------------------
// Global State
// ---------------------------------------------------------------------------

const processStartTime = Date.now();

const globalForHealth = globalThis as unknown as {
  __config: HealthCheckConfig | undefined;
};

function getConfig(): HealthCheckConfig {
  if (!globalForHealth.__config) {
    globalForHealth.__config = buildHealthConfig();
  }
  return globalForHealth.__config;
}

// ---------------------------------------------------------------------------
// Timeout Wrapper
// ---------------------------------------------------------------------------

/**
 * Execute a health check function with a configurable timeout.
 * If the check does not complete within the timeout, it is considered "down".
 */
async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Health check timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ---------------------------------------------------------------------------
// Dependency Registry
// ---------------------------------------------------------------------------

/**
 * Build the list of dependencies to check based on configuration.
 * Some dependencies may be optional (e.g., search engine, storage).
 */
function buildDependencyDescriptors(): DependencyDescriptor[] {
  const cfg = getConfig();

  const allDeps: DependencyDescriptor[] = [
    {
      name: "db",
      critical: cfg.criticalDeps.includes("db"),
      check: pingPrisma as HealthCheckFn,
    },
    {
      name: "redis",
      critical: cfg.criticalDeps.includes("redis"),
      check: pingRedis as HealthCheckFn,
    },
    {
      name: "storage",
      critical: cfg.criticalDeps.includes("storage"),
      check: async () => {
        const result = await pingStorage();
        return result.connected;
      },
    },
    {
      name: "queue",
      critical: cfg.criticalDeps.includes("queue"),
      check: pingQueues as HealthCheckFn,
    },
    {
      name: "search",
      critical: cfg.criticalDeps.includes("search"),
      check: async () => {
        const result = await pingSearch();
        return result.connected;
      },
    },
    {
      name: "logger",
      critical: false, // Logger is never critical — app still works without it
      check: async () => {
        const result = pingLogger();
        return result.healthy;
      },
    },
  ];

  return allDeps;
}

// ---------------------------------------------------------------------------
// Individual Dependency Check
// ---------------------------------------------------------------------------

/**
 * Execute a single dependency health check and return a structured result.
 */
async function checkDependency(descriptor: DependencyDescriptor): Promise<DependencyCheck> {
  const cfg = getConfig();
  const startTime = Date.now();

  try {
    const result = await withTimeout(descriptor.check, cfg.timeoutMs);
    const latencyMs = Date.now() - startTime;

    // Interpret the result — can be boolean or an object with .connected
    let up: boolean;
    let details: Record<string, unknown> | undefined;

    if (typeof result === "boolean") {
      up = result;
    } else if (result !== null && typeof result === "object") {
      up = result.connected !== false && result.status !== "down";
      details = { ...result };
    } else {
      up = false;
    }

    return {
      name: descriptor.name,
      status: up ? "up" : "down",
      latencyMs,
      critical: descriptor.critical,
      ...(details && Object.keys(details).length > 0 ? { details } : {}),
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);

    return {
      name: descriptor.name,
      status: "down",
      latencyMs,
      critical: descriptor.critical,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// System Stats
// ---------------------------------------------------------------------------

/**
 * Collect system-level statistics (memory, CPU, uptime, runtime).
 */
function collectSystemStats(): SystemStats {
  const memory = process.memoryUsage();
  const uptimeSeconds = Math.floor((Date.now() - processStartTime) / 1000);

  const formatUptime = (totalSeconds: number): string => {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(" ");
  };

  const heapUsed = memory.heapUsed;
  const heapTotal = memory.heapTotal;

  return {
    memory: {
      rssMB: (memory.rss / 1024 / 1024).toFixed(2),
      heapUsedMB: (heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (heapTotal / 1024 / 1024).toFixed(2),
      externalMB: (memory.external / 1024 / 1024).toFixed(2),
      percentUsed: heapTotal > 0
        ? ((heapUsed / heapTotal) * 100).toFixed(1)
        : "0.0",
    },
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
    },
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: (typeof navigator !== "undefined" && navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : 1,
  };
}

// ---------------------------------------------------------------------------
// Readiness Probe
// ---------------------------------------------------------------------------

/**
 * Execute all dependency health checks in parallel and return a comprehensive
 * readiness result.
 *
 * The overall status is determined by critical dependencies:
 *   - "ok"       — all critical dependencies are up
 *   - "degraded" — at least one non-critical dependency is down, but all critical are up
 *   - "unhealthy" — at least one critical dependency is down
 *
 * Use this for:
 *   - Load balancer health checks (target group)
 *   - Kubernetes readiness probes
 *   - Monitoring / status pages
 *
 * @example
 *   const result = await readinessProbe();
 *   // {
 *   //   status: "ok",
 *   //   timestamp: "2025-01-21T10:00:00.000Z",
 *   //   uptime: 86400,
 *   //   dependencies: [
 *   //     { name: "db", status: "up", latencyMs: 12, critical: true },
 *   //     { name: "redis", status: "up", latencyMs: 3, critical: true },
 *   //     ...
 *   //   ],
 *   //   stats: { memory: {...}, uptime: {...}, ... }
 *   // }
 */
export async function readinessProbe(): Promise<ReadinessResult> {
  const cfg = getConfig();
  const descriptors = buildDependencyDescriptors();

  // Execute all checks in parallel
  const results = await Promise.all(descriptors.map((d) => checkDependency(d)));

  // Determine overall status
  let status: HealthStatus = "ok";

  const criticalDown = results.filter((r) => r.critical && r.status !== "up");
  const nonCriticalDown = results.filter((r) => !r.critical && r.status !== "up");

  if (criticalDown.length > 0) {
    status = "unhealthy";
  } else if (nonCriticalDown.length > 0) {
    status = "degraded";
  }

  const result: ReadinessResult = {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - processStartTime) / 1000),
    dependencies: results,
  };

  if (cfg.exposeStats) {
    result.stats = collectSystemStats();
  }

  return result;
}

// ---------------------------------------------------------------------------
// Liveness Probe
// ---------------------------------------------------------------------------

/**
 * Lightweight liveness check — only verifies that the process is alive.
 * Always returns status: "ok" with a 200 response.
 *
 * Does NOT check any external dependencies. Use this for:
 *   - Kubernetes liveness probes (restart policy)
 *   - Quick "is the process running?" checks
 *
 * @example
 *   const result = await livenessProbe();
 *   // { status: "ok", timestamp: "2025-01-21T10:00:00.000Z", uptime: 86400, pid: 1234 }
 */
export async function livenessProbe(): Promise<LivenessResult> {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - processStartTime) / 1000),
    pid: process.pid,
  };
}

// ---------------------------------------------------------------------------
// Single Dependency Check (on-demand)
// ---------------------------------------------------------------------------

/**
 * Check a single named dependency on demand.
 * Useful for targeted checks or retry-after-failure scenarios.
 *
 * @example
 *   const dbCheck = await checkSingleDependency("db");
 *   if (dbCheck.status !== "up") {
 *     console.error(`Database is down: ${dbCheck.error}`);
 *   }
 */
export async function checkSingleDependency(
  name: string,
): Promise<DependencyCheck | null> {
  const descriptors = buildDependencyDescriptors();
  const descriptor = descriptors.find((d) => d.name === name);

  if (!descriptor) {
    return null;
  }

  return checkDependency(descriptor);
}

// ---------------------------------------------------------------------------
// Quick Status (minimal, for frequent polling)
// ---------------------------------------------------------------------------

export interface QuickStatus {
  status: HealthStatus;
  db: DependencyStatus;
  redis: DependencyStatus;
}

/**
 * Minimal health check that only tests the two most critical dependencies
 * (database and Redis) in parallel. Useful for high-frequency load balancer
 * polling where every millisecond counts.
 *
 * @example
 *   const qs = await quickStatus();
 *   // { status: "ok", db: "up", redis: "up" }
 */
export async function quickStatus(): Promise<QuickStatus> {
  const cfg = getConfig();

  const descriptors: DependencyDescriptor[] = [
    {
      name: "db",
      critical: true,
      check: pingPrisma as HealthCheckFn,
    },
    {
      name: "redis",
      critical: true,
      check: pingRedis as HealthCheckFn,
    },
  ];

  const [dbResult, redisResult] = await Promise.all(
    descriptors.map((d) => checkDependency(d)),
  );

  let status: HealthStatus = "ok";
  if (dbResult.status !== "up" || redisResult.status !== "up") {
    status = "unhealthy";
  }

  return {
    status,
    db: dbResult.status,
    redis: redisResult.status,
  };
}

// ---------------------------------------------------------------------------
// Degraded Mode Helpers
// ---------------------------------------------------------------------------

/**
 * Determine which critical dependencies are currently down.
 * Useful for graceful degradation logic in middleware.
 *
 * @example
 *   const degraded = await getDegradedDependencies();
 *   if (degraded.includes("search")) {
 *     // Disable search features, show fallback UI
 *   }
 */
export async function getDegradedDependencies(): Promise<string[]> {
  const descriptors = buildDependencyDescriptors();
  const results = await Promise.all(descriptors.map((d) => checkDependency(d)));

  return results
    .filter((r) => r.status !== "up")
    .map((r) => r.name);
}

// ---------------------------------------------------------------------------
// Health Check Summary (human-readable)
// ---------------------------------------------------------------------------

export interface HealthSummary {
  ok: boolean;
  message: string;
  dependencySummary: string[];
}

/**
 * Produce a human-readable summary of the system health.
 * Useful for CLI tools, admin dashboards, or debug endpoints.
 *
 * @example
 *   const summary = await healthSummary();
 *   console.log(summary.message);
 *   // "System is healthy — all 6 dependencies are up."
 */
export async function healthSummary(): Promise<HealthSummary> {
  const result = await readinessProbe();

  const upCount = result.dependencies.filter((d) => d.status === "up").length;
  const totalCount = result.dependencies.length;
  const downDeps = result.dependencies.filter((d) => d.status !== "up");

  let message: string;
  if (result.status === "ok") {
    message = `System is healthy — all ${totalCount} dependencies are up.`;
  } else if (result.status === "degraded") {
    message = `System is degraded — ${downDeps.length} non-critical ${downDeps.length === 1 ? "dependency" : "dependencies"} down: ${downDeps.map((d) => d.name).join(", ")}.`;
  } else {
    message = `System is unhealthy — ${downDeps.length} critical ${downDeps.length === 1 ? "dependency" : "dependencies"} down: ${downDeps.map((d) => d.name).join(", ")}.`;
  }

  const dependencySummary = result.dependencies.map((d) => {
    const icon = d.status === "up" ? "✓" : "✗";
    const criticalMark = d.critical ? "[critical]" : "[optional]";
    const errorSuffix = d.error ? ` — ${d.error}` : "";
    return `${icon} ${d.name} ${criticalMark} (${d.latencyMs}ms)${errorSuffix}`;
  });

  return {
    ok: result.status === "ok",
    message,
    dependencySummary,
  };
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const health = {
  // Probes
  readiness: readinessProbe,
  liveness: livenessProbe,

  // Utilities
  checkSingle: checkSingleDependency,
  quickStatus,
  getDegradedDependencies,
  summary: healthSummary,

  // Config
  getConfig,
} as const;

export default health;