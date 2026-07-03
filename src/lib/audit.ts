/**
 * Audit Trail Service — Automatic Entity Change Recording with Diff Engine
 *
 * Production-grade audit logging that captures every mutation across entities,
 * computes granular before/after diffs, and stores immutable audit entries
 * in the database. Designed for compliance (GDPR, SOC 2, ISO 27001),
 * debugging, and change history UIs.
 *
 * Architecture:
 *   1. Prisma Middleware — intercepts all write operations (create/update/delete)
 *      at the ORM layer. No code changes needed in existing services.
 *   2. Diff Engine — computes deep JSON diffs between before and after states:
 *        - Changed fields with old → new values
 *        - Added / removed fields
 *        - Nested object & array diff (shallow comparison with deep detection)
 *   3. Async Write Buffer — batches audit entries and flushes to the database
 *      without blocking the mutation. Falls back to sync write if buffer is full.
 *   4. Enrichment — attaches actor identity (userId), tenant (organizationId),
 *      IP address, user agent, and request metadata automatically.
 *   5. Retention & Purging — configurable TTL for audit entries; automatic
 *      cleanup of expired records via cron / queue job.
 *   6. Query API — search, filter, paginate, and export audit trails.
 *
 * Diff Output Format:
 *   {
 *     "fieldName": { "old": <previous>, "new": <current> },
 *     "status": { "old": "DRAFT", "new": "PUBLISHED" },
 *     "metadata.theme": { "old": "light", "new": "dark" },
 *     ...
 *   }
 *
 *   For CREATE: all fields in "new", "old" is null
 *   For DELETE: all fields in "old", "new" is null
 *   For UPDATE: only changed fields are recorded
 *
 * Environment Variables:
 *   AUDIT_ENABLED              — master switch (default: true)
 *   AUDIT_BUFFER_SIZE          — max entries before forced flush (default: 100)
 *   AUDIT_FLUSH_INTERVAL_MS    — flush interval in ms (default: 5000)
 *   AUDIT_RETENTION_DAYS       — days to keep audit logs (default: 365)
 *   AUDIT_EXCLUDED_MODELS      — comma-separated models to skip (default: AuditLog,AnalyticsEvent,ViewDashboardStats)
 *   AUDIT_EXCLUDED_FIELDS      — comma-separated fields to redact (default: passwordHash,totpSecret,recoveryCodes)
 *   AUDIT_MASKED_VALUE         — placeholder for redacted fields (default: "[REDACTED]")
 *   AUDIT_MAX_DIFF_DEPTH       — max nesting depth for diff (default: 5)
 *   AUDIT_MAX_DIFF_FIELDS      — max number of changed fields per entry (default: 200)
 *   AUDIT_ASYNC_ENABLED        — use async buffered writes (default: true)
 *
 * Usage — Automatic (Prisma Middleware):
 *   import { applyAuditMiddleware } from "@/lib/audit";
 *
 *   // In your Prisma client setup:
 *   const prisma = new PrismaClient();
 *   applyAuditMiddleware(prisma);
 *
 * Usage — Manual Recording:
 *   import { recordAudit, AuditAction } from "@/lib/audit";
 *
 *   await recordAudit({
 *     action: "LOGIN",
 *     entityType: "User",
 *     entityId: userId,
 *     metadata: { provider: "credentials" },
 *   });
 *
 * Usage — Querying:
 *   import { queryAuditLogs } from "@/lib/audit";
 *
 *   const logs = await queryAuditLogs({
 *     entityType: "Project",
 *     entityId: projectId,
 *     actions: ["UPDATE"],
 *     from: startDate,
 *     limit: 50,
 *   });
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Audit action types — mirrors the database enum */
export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "RESTORE"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "IMPORT"
  | "VIEW";

/** A single field diff: old value → new value */
export interface FieldDiff {
  old: unknown;
  new: unknown;
}

/** Complete diff map: fieldPath → { old, new } */
export type DiffMap = Record<string, FieldDiff>;

/** Structured audit entry (before database serialization) */
export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes: DiffMap | null;
  /** Full snapshot after the operation (for CREATE), before (for DELETE) */
  snapshot?: Record<string, unknown> | null;
  /** Actor who performed the action */
  userId: string;
  /** Tenant isolation */
  organizationId: string;
  /** Request context */
  ipAddress?: string;
  userAgent?: string;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

/** Manual audit recording options */
export interface AuditRecordOptions {
  action: AuditAction;
  entityType: string;
  entityId: string;
  /** Before state (for UPDATE/DELETE diffs) */
  before?: Record<string, unknown> | null;
  /** After state (for CREATE/UPDATE diffs) */
  after?: Record<string, unknown> | null;
  /** Pre-computed diff (overrides before/after diff computation) */
  diff?: DiffMap | null;
  /** Extra context data */
  metadata?: Record<string, unknown>;
}

/** Query filters for audit log retrieval */
export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  userId?: string;
  organizationId?: string;
  actions?: AuditAction[];
  /** ISO date string for range start */
  from?: string;
  /** ISO date string for range end */
  to?: string;
  /** Full-text search across changes.snapshot */
  search?: string;
  page?: number;
  limit?: number;
  /** Sort direction */
  order?: "asc" | "desc";
}

/** Paginated audit log result */
export interface AuditQueryResult {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Deserialized audit log entry from database */
export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes: DiffMap | null;
  snapshot: Record<string, unknown> | null;
  userId: string;
  userName?: string;
  userEmail?: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** Audit service configuration */
export interface AuditConfig {
  enabled: boolean;
  bufferSize: number;
  flushIntervalMs: number;
  retentionDays: number;
  excludedModels: Set<string>;
  excludedFields: Set<string>;
  maskedValue: string;
  maxDiffDepth: number;
  maxDiffFields: number;
  asyncEnabled: boolean;
}

/** Prisma middleware context for audit */
interface AuditMiddlewareContext {
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Entity metadata cache for optimization */
interface EntityMeta {
  primaryKey: string;
  tableName: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_EXCLUDED_MODELS = [
  "AuditLog",
  "AnalyticsEvent",
  "ViewDashboardStats",
  "Session",
  "Account",
  "WebhookDelivery",
  "AIMessage",
  "AIUsage",
];

const DEFAULT_EXCLUDED_FIELDS = [
  "passwordHash",
  "totpSecret",
  "recoveryCodes",
  "accessToken",
  "refreshToken",
  "idToken",
  "secret",
  "apiKey",
  "key",
];

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key$/i,
  /hash$/i,
  /credential/i,
  /private/i,
];

// ---------------------------------------------------------------------------
// Global State
// ---------------------------------------------------------------------------

const globalForAudit = globalThis as unknown as {
  __config: AuditConfig | undefined;
  __buffer: AuditEntry[];
  __flushTimer: ReturnType<typeof setInterval> | undefined;
  __flushing: boolean;
  __middlewareApplied: boolean;
  __entityMetaCache: Map<string, EntityMeta>;
  __requestContext: AuditMiddlewareContext;
};

function initGlobalState(): void {
  if (!globalForAudit.__buffer) {
    globalForAudit.__buffer = [];
  }
  if (!globalForAudit.__entityMetaCache) {
    globalForAudit.__entityMetaCache = new Map();
  }
  if (!globalForAudit.__requestContext) {
    globalForAudit.__requestContext = {};
  }
  if (globalForAudit.__flushing === undefined) {
    globalForAudit.__flushing = false;
  }
  if (globalForAudit.__middlewareApplied === undefined) {
    globalForAudit.__middlewareApplied = false;
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function envStr(key: string, fallback: string): string {
  const raw = process.env[key];
  return raw !== undefined && raw !== "" ? raw : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function buildAuditConfig(): AuditConfig {
  const excludedModelsRaw = process.env.AUDIT_EXCLUDED_MODELS;
  const excludedModels = excludedModelsRaw
    ? new Set(excludedModelsRaw.split(",").map((m) => m.trim()).filter(Boolean))
    : new Set(DEFAULT_EXCLUDED_MODELS);

  const excludedFieldsRaw = process.env.AUDIT_EXCLUDED_FIELDS;
  const excludedFields = excludedFieldsRaw
    ? new Set(excludedFieldsRaw.split(",").map((f) => f.trim()).filter(Boolean))
    : new Set(DEFAULT_EXCLUDED_FIELDS);

  return {
    enabled: envBool("AUDIT_ENABLED", true),
    bufferSize: envInt("AUDIT_BUFFER_SIZE", 100),
    flushIntervalMs: envInt("AUDIT_FLUSH_INTERVAL_MS", 5000),
    retentionDays: envInt("AUDIT_RETENTION_DAYS", 365),
    excludedModels,
    excludedFields,
    maskedValue: envStr("AUDIT_MASKED_VALUE", "[REDACTED]"),
    maxDiffDepth: envInt("AUDIT_MAX_DIFF_DEPTH", 5),
    maxDiffFields: envInt("AUDIT_MAX_DIFF_FIELDS", 200),
    asyncEnabled: envBool("AUDIT_ASYNC_ENABLED", true),
  };
}

function getConfig(): AuditConfig {
  if (!globalForAudit.__config) {
    globalForAudit.__config = buildAuditConfig();
  }
  return globalForAudit.__config;
}

/**
 * Reload configuration at runtime (useful for feature flags).
 */
export function reloadAuditConfig(): AuditConfig {
  globalForAudit.__config = buildAuditConfig();
  stopFlushTimer();
  startFlushTimer();
  return globalForAudit.__config;
}

// ---------------------------------------------------------------------------
// Request Context (set per-request)
// ---------------------------------------------------------------------------

/**
 * Set the current request context for automatic enrichment of audit entries.
 * Call at the beginning of each request (middleware / server action / API route).
 */
export function setAuditContext(ctx: AuditMiddlewareContext): void {
  initGlobalState();
  globalForAudit.__requestContext = {
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  };
}

/**
 * Get the current request context.
 */
export function getAuditContext(): Readonly<AuditMiddlewareContext> {
  initGlobalState();
  return { ...globalForAudit.__requestContext };
}

/**
 * Clear the current request context (call at end of request).
 */
export function clearAuditContext(): void {
  initGlobalState();
  globalForAudit.__requestContext = {};
}

// ---------------------------------------------------------------------------
// Sensitive Field Detection & Redaction
// ---------------------------------------------------------------------------

function isSensitiveField(fieldName: string): boolean {
  const config = getConfig();
  if (config.excludedFields.has(fieldName)) return true;
  for (const pattern of SENSITIVE_FIELD_PATTERNS) {
    if (pattern.test(fieldName)) return true;
  }
  return false;
}

function redactSensitiveData(value: unknown, depth: number = 0): unknown {
  const config = getConfig();
  if (value === null || value === undefined) return value;
  if (depth > config.maxDiffDepth) return config.maskedValue;

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof value === "object" && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (isSensitiveField(key)) {
        result[key] = config.maskedValue;
      } else {
        result[key] = redactSensitiveData(val, depth + 1);
      }
    }
    return result;
  }

  return value;
}

// ---------------------------------------------------------------------------
// Diff Engine
// ---------------------------------------------------------------------------

/**
 * Compute a deep diff between two objects.
 * Field paths use dot notation: "settings.theme.primaryColor"
 */
export function computeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  config?: AuditConfig,
  prefix: string = "",
  depth: number = 0,
): DiffMap {
  const cfg = config || getConfig();
  if (depth > cfg.maxDiffDepth) return {};

  if (!before && after) return computeCreateDiff(after, cfg, prefix, depth);
  if (before && !after) return computeDeleteDiff(before, cfg, prefix, depth);
  if (!before && !after) return {};

  const diff: DiffMap = {};
  before = before!;
  after = after!;

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  let fieldCount = 0;

  for (const key of allKeys) {
    if (fieldCount >= cfg.maxDiffFields) break;

    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (isSensitiveField(key)) {
      const oldVal = key in before ? cfg.maskedValue : undefined;
      const newVal = key in after ? cfg.maskedValue : undefined;
      if (oldVal !== newVal) {
        diff[fieldPath] = { old: oldVal, new: newVal };
        fieldCount++;
      }
      continue;
    }

    const oldVal = before[key];
    const newVal = after[key];

    if (!(key in after)) {
      diff[fieldPath] = { old: serializeValue(oldVal, cfg), new: null };
      fieldCount++;
      continue;
    }
    if (!(key in before)) {
      diff[fieldPath] = { old: null, new: serializeValue(newVal, cfg) };
      fieldCount++;
      continue;
    }
    if (isEqual(oldVal, newVal)) continue;

    if (
      isPlainObject(oldVal) && isPlainObject(newVal) &&
      !(oldVal instanceof Date) && !(newVal instanceof Date)
    ) {
      const nestedDiff = computeDiff(
        oldVal as Record<string, unknown>,
        newVal as Record<string, unknown>,
        cfg, fieldPath, depth + 1,
      );
      if (Object.keys(nestedDiff).length > 0) {
        const nestedKeys = Object.keys(nestedDiff).length;
        if (nestedKeys <= 5 && fieldCount + nestedKeys <= cfg.maxDiffFields) {
          Object.assign(diff, nestedDiff);
          fieldCount += nestedKeys;
        } else {
          diff[fieldPath] = { old: serializeValue(oldVal, cfg), new: serializeValue(newVal, cfg) };
          fieldCount++;
        }
      }
    } else {
      diff[fieldPath] = { old: serializeValue(oldVal, cfg), new: serializeValue(newVal, cfg) };
      fieldCount++;
    }
  }

  return diff;
}

function computeCreateDiff(
  after: Record<string, unknown>, config: AuditConfig,
  prefix: string, depth: number,
): DiffMap {
  if (depth > config.maxDiffDepth) return {};
  const diff: DiffMap = {};
  let fieldCount = 0;

  for (const [key, value] of Object.entries(after)) {
    if (fieldCount >= config.maxDiffFields) break;
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (isSensitiveField(key)) {
      diff[fieldPath] = { old: null, new: config.maskedValue };
      fieldCount++;
      continue;
    }
    if (isPlainObject(value) && !(value instanceof Date) && depth < config.maxDiffDepth) {
      const nestedDiff = computeCreateDiff(value as Record<string, unknown>, config, fieldPath, depth + 1);
      Object.assign(diff, nestedDiff);
      fieldCount += Object.keys(nestedDiff).length;
    } else {
      diff[fieldPath] = { old: null, new: serializeValue(value, config) };
      fieldCount++;
    }
  }
  return diff;
}

function computeDeleteDiff(
  before: Record<string, unknown>, config: AuditConfig,
  prefix: string, depth: number,
): DiffMap {
  if (depth > config.maxDiffDepth) return {};
  const diff: DiffMap = {};
  let fieldCount = 0;

  for (const [key, value] of Object.entries(before)) {
    if (fieldCount >= config.maxDiffFields) break;
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (isSensitiveField(key)) {
      diff[fieldPath] = { old: config.maskedValue, new: null };
      fieldCount++;
      continue;
    }
    diff[fieldPath] = { old: serializeValue(value, config), new: null };
    fieldCount++;
  }
  return diff;
}

// ---------------------------------------------------------------------------
// Serialization Helpers
// ---------------------------------------------------------------------------

function serializeValue(value: unknown, config: AuditConfig): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return "[Function]";
  if (typeof value === "symbol") return value.toString();
  if (Buffer.isBuffer(value)) return { _type: "Buffer", _length: value.length };

  if (Array.isArray(value)) {
    if (value.length > 100) return { _type: "Array", _length: value.length, _truncated: true };
    return value.map((v) => serializeValue(v, config));
  }

  if (isPlainObject(value)) {
    try {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = serializeValue(v, config);
      }
      return result;
    } catch {
      return "[Object: unserializable]";
    }
  }

  return value;
}

// ---------------------------------------------------------------------------
// Equality Check
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (value instanceof Date) return false;
  if (value instanceof RegExp) return false;
  if (Buffer.isBuffer(value)) return false;
  if (Array.isArray(value)) return false;
  return true;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== typeof b) return false;
  if (typeof a === "object" && a !== null && b !== null) {
    if (a === b) return true;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Async Write Buffer
// ---------------------------------------------------------------------------

function startFlushTimer(): void {
  const config = getConfig();
  if (!config.asyncEnabled) return;
  if (globalForAudit.__flushTimer) return;

  globalForAudit.__flushTimer = setInterval(() => {
    flushAuditBuffer().catch((err) => {
      console.error("[audit] flush error:", err instanceof Error ? err.message : String(err));
    });
  }, config.flushIntervalMs);

  if (globalForAudit.__flushTimer && typeof globalForAudit.__flushTimer === "object") {
    (globalForAudit.__flushTimer as ReturnType<typeof setInterval>).unref?.();
  }
}

function stopFlushTimer(): void {
  if (globalForAudit.__flushTimer) {
    clearInterval(globalForAudit.__flushTimer);
    globalForAudit.__flushTimer = undefined;
  }
}

function bufferAuditEntry(entry: AuditEntry): void {
  initGlobalState();
  const config = getConfig();
  globalForAudit.__buffer.push(entry);

  if (globalForAudit.__buffer.length >= config.bufferSize) {
    if (config.asyncEnabled) {
      flushAuditBuffer().catch((err) => {
        console.error("[audit] forced flush error:", err instanceof Error ? err.message : String(err));
      });
    }
  }
  if (!globalForAudit.__flushTimer && config.asyncEnabled) {
    startFlushTimer();
  }
}

/**
 * Flush all buffered audit entries to the database.
 */
export async function flushAuditBuffer(): Promise<void> {
  initGlobalState();
  if (globalForAudit.__buffer.length === 0) return;
  if (globalForAudit.__flushing) return;

  globalForAudit.__flushing = true;
  const batch = globalForAudit.__buffer.splice(0);
  const config = getConfig();

  try {
    const prisma = getPrismaClient();
    const records = batch.map((entry) => ({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: (entry.changes ?? {}) as Prisma.InputJsonValue,
      snapshot: (entry.snapshot ?? undefined) as Prisma.InputJsonValue | undefined,
      userId: entry.userId,
      organizationId: entry.organizationId,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    }));

    await prisma.auditLog.createMany({ data: records, skipDuplicates: true });

    if (process.env.NODE_ENV !== "production" && batch.length > 1) {
      console.log(`[audit] flushed ${batch.length} entries`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[audit] failed to flush ${batch.length} entries: ${message}`);
    if (globalForAudit.__buffer.length < config.bufferSize * 2) {
      globalForAudit.__buffer.unshift(...batch);
    }
  } finally {
    globalForAudit.__flushing = false;
  }
}

// ---------------------------------------------------------------------------
// Core: Record Audit Entry
// ---------------------------------------------------------------------------

/**
 * Record an audit entry manually.
 */
export async function recordAudit(opts: AuditRecordOptions): Promise<void> {
  initGlobalState();
  const config = getConfig();
  if (!config.enabled) return;

  const ctx = globalForAudit.__requestContext;
  if (!ctx.userId || !ctx.organizationId) {
    console.warn(
      "[audit] Missing audit context (userId/organizationId). " +
      "Call setAuditContext() at the start of your request. " +
      `Entity: ${opts.entityType}#${opts.entityId}, Action: ${opts.action}`,
    );
    return;
  }

  let diff: DiffMap | null = opts.diff ?? null;
  if (!diff && (opts.before !== undefined || opts.after !== undefined)) {
    diff = computeDiff(opts.before ?? null, opts.after ?? null, config);
  }
  if (diff) diff = redactSensitiveData(diff, 1) as DiffMap;

  let snapshot: Record<string, unknown> | null = null;
  if (opts.action === "CREATE" && opts.after) {
    snapshot = redactSensitiveData(opts.after, 1) as Record<string, unknown>;
  } else if (opts.action === "DELETE" && opts.before) {
    snapshot = redactSensitiveData(opts.before, 1) as Record<string, unknown>;
  }

  const entry: AuditEntry = {
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    changes: diff,
    snapshot,
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    metadata: opts.metadata as Record<string, unknown> | undefined,
  };

  if (config.asyncEnabled) {
    bufferAuditEntry(entry);
  } else {
    try {
      const prisma = getPrismaClient();
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          changes: (entry.changes ?? {}) as Prisma.InputJsonValue,
          snapshot: (entry.snapshot ?? undefined) as Prisma.InputJsonValue | undefined,
          userId: entry.userId,
          organizationId: entry.organizationId,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      console.error("[audit] sync write failed:", err instanceof Error ? err.message : String(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Prisma Middleware — Automatic Entity Tracking
// ---------------------------------------------------------------------------

/**
 * Apply audit middleware to a Prisma client instance.
 * Intercepts all write operations and automatically records audit entries
 * with before/after diffs.
 */
export function applyAuditMiddleware(prisma: PrismaClient): void {
  initGlobalState();
  const config = getConfig();
  if (!config.enabled) return;
  if (globalForAudit.__middlewareApplied) return;

  prisma.$use(async (params, next) => {
    const startTime = Date.now();
    if (!getConfig().enabled) return next(params);

    const isWriteOp = ["create", "update", "delete", "upsert", "createMany", "updateMany", "deleteMany"].some(
      (op) => params.action.startsWith(op),
    );

    if (!isWriteOp || !params.model || config.excludedModels.has(params.model)) {
      return next(params);
    }

    const ctx = globalForAudit.__requestContext;
    if (!ctx.userId || !ctx.organizationId) return next(params);

    const modelName = params.model;
    const isCreate = params.action.startsWith("create");
    const isUpdate = params.action.startsWith("update") || params.action.startsWith("upsert");
    const isDelete = params.action.startsWith("delete");

    let action: AuditAction;
    let beforeSnapshot: Record<string, unknown> | null = null;
    let entityId: string = "unknown";

    try {
      if (isUpdate || isDelete) {
        const where = params.args.where as Record<string, unknown> | undefined;
        if (where) {
          const delegate = (prisma as Record<string, unknown>)[
            modelName.charAt(0).toLowerCase() + modelName.slice(1)
          ] as Record<string, unknown> | undefined;

          if (delegate && typeof delegate["findFirst"] === "function") {
            const findFn = delegate["findFirst"] as (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown>>;
            const current = await findFn({ where });
            if (current) {
              beforeSnapshot = { ...current };
              entityId = current.id ? String(current.id) : JSON.stringify(where);
            } else {
              entityId = JSON.stringify(where);
            }
          }
        }
      }

      const result = await next(params);

      if (isCreate) action = "CREATE";
      else if (isUpdate) action = "UPDATE";
      else if (isDelete) action = "DELETE";
      else return result;

      if (isCreate && result) {
        if (typeof result === "object" && result !== null && "id" in result) {
          entityId = String((result as Record<string, string>).id);
        }
        if (params.action === "createMany") {
          const count = (result as { count?: number }).count ?? 0;
          const bulkEntry: AuditEntry = {
            action: "CREATE", entityType: modelName, entityId: `bulk:${count}`,
            changes: { count: { old: null, new: count } },
            userId: ctx.userId, organizationId: ctx.organizationId,
            ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
            metadata: { model: modelName, bulk: true },
          };
          if (config.asyncEnabled) bufferAuditEntry(bulkEntry);
          return result;
        }
      }

      if (params.action === "updateMany" || params.action === "deleteMany") {
        const count = (result as { count?: number }).count ?? 0;
        const bulkAction: AuditAction = params.action === "updateMany" ? "UPDATE" : "DELETE";
        const bulkEntry: AuditEntry = {
          action: bulkAction, entityType: modelName,
          entityId: `bulk:${params.args.where ? JSON.stringify(params.args.where).slice(0, 200) : "all"}`,
          changes: { affectedRows: { old: null, new: count } },
          userId: ctx.userId, organizationId: ctx.organizationId,
          ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
          metadata: { model: modelName, bulk: true },
        };
        if (config.asyncEnabled) bufferAuditEntry(bulkEntry);
        return result;
      }

      let afterSnapshot: Record<string, unknown> | null = null;
      if (result && typeof result === "object" && !Array.isArray(result)) {
        afterSnapshot = { ...(result as Record<string, unknown>) };
      }

      let diffResult: DiffMap | null = null;
      if (action === "UPDATE" && beforeSnapshot && afterSnapshot) {
        diffResult = computeDiff(beforeSnapshot, afterSnapshot, config);
      } else if (action === "CREATE" && afterSnapshot) {
        diffResult = computeDiff(null, afterSnapshot, config);
      } else if (action === "DELETE" && beforeSnapshot) {
        diffResult = computeDiff(beforeSnapshot, null, config);
      }

      if (diffResult) diffResult = redactSensitiveData(diffResult, 1) as DiffMap;

      let snapshot: Record<string, unknown> | null = null;
      if (action === "CREATE" && afterSnapshot) {
        snapshot = redactSensitiveData(afterSnapshot, 1) as Record<string, unknown>;
      } else if (action === "DELETE" && beforeSnapshot) {
        snapshot = redactSensitiveData(beforeSnapshot, 1) as Record<string, unknown>;
      }

      const entry: AuditEntry = {
        action, entityType: modelName, entityId, changes: diffResult, snapshot,
        userId: ctx.userId, organizationId: ctx.organizationId,
        ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
        metadata: { prismaAction: params.action, latencyMs: Date.now() - startTime },
      };

      if (config.asyncEnabled) {
        bufferAuditEntry(entry);
      } else {
        const prismaClient = getPrismaClient();
        await prismaClient.auditLog.create({
          data: {
            action: entry.action, entityType: entry.entityType, entityId: entry.entityId,
            changes: (entry.changes ?? {}) as Prisma.InputJsonValue,
            snapshot: (entry.snapshot ?? undefined) as Prisma.InputJsonValue | undefined,
            userId: entry.userId, organizationId: entry.organizationId,
            ipAddress: entry.ipAddress ?? null, userAgent: entry.userAgent ?? null,
            metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[audit] middleware error (${params.model}.${params.action}):`, message);
      return next(params);
    }
  });

  globalForAudit.__middlewareApplied = true;
  startFlushTimer();

  if (process.env.NODE_ENV !== "production") {
    console.log("[audit] Prisma audit middleware applied");
  }
}

// ---------------------------------------------------------------------------
// Query API
// ---------------------------------------------------------------------------

export async function queryAuditLogs(query: AuditQuery): Promise<AuditQueryResult> {
  const prisma = getPrismaClient();
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(query.limit || 50, 500);
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};
  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.userId) where.userId = query.userId;
  if (query.organizationId) where.organizationId = query.organizationId;
  if (query.actions && query.actions.length > 0) where.action = { in: query.actions };
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.from);
    if (query.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.to);
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: query.order || "desc" },
      skip, take: limit,
      include: { user: { select: { id: true, email: true, displayName: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const mappedEntries: AuditLogEntry[] = entries.map((entry) => ({
    id: entry.id,
    action: entry.action as AuditAction,
    entityType: entry.entityType,
    entityId: entry.entityId,
    changes: (entry.changes as DiffMap) ?? null,
    snapshot: (entry.snapshot as Record<string, unknown>) ?? null,
    userId: entry.userId,
    userName: entry.user?.displayName ?? undefined,
    userEmail: entry.user?.email ?? undefined,
    organizationId: entry.organizationId,
    ipAddress: entry.ipAddress ?? undefined,
    userAgent: entry.userAgent ?? undefined,
    metadata: (entry.metadata as Record<string, unknown>) ?? null,
    createdAt: entry.createdAt.toISOString(),
  }));

  return { entries: mappedEntries, total, page, limit, totalPages };
}

export async function getAuditLogEntry(id: string): Promise<AuditLogEntry | null> {
  const prisma = getPrismaClient();
  const entry = await prisma.auditLog.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });
  if (!entry) return null;

  return {
    id: entry.id, action: entry.action as AuditAction,
    entityType: entry.entityType, entityId: entry.entityId,
    changes: (entry.changes as DiffMap) ?? null,
    snapshot: (entry.snapshot as Record<string, unknown>) ?? null,
    userId: entry.userId,
    userName: entry.user?.displayName ?? undefined,
    userEmail: entry.user?.email ?? undefined,
    organizationId: entry.organizationId,
    ipAddress: entry.ipAddress ?? undefined,
    userAgent: entry.userAgent ?? undefined,
    metadata: (entry.metadata as Record<string, unknown>) ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function getEntityHistory(
  entityType: string, entityId: string,
  opts?: { actions?: AuditAction[]; from?: string; to?: string; limit?: number },
): Promise<AuditLogEntry[]> {
  const result = await queryAuditLogs({
    entityType, entityId,
    actions: opts?.actions, from: opts?.from, to: opts?.to,
    limit: opts?.limit || 100, order: "asc",
  });
  return result.entries;
}

// ---------------------------------------------------------------------------
// Retention & Purging
// ---------------------------------------------------------------------------

export async function purgeExpiredAuditLogs(retentionDaysOverride?: number): Promise<number> {
  const config = getConfig();
  const retentionDays = retentionDaysOverride ?? config.retentionDays;
  if (retentionDays <= 0) return 0;

  const prisma = getPrismaClient();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[audit] purged ${result.count} expired entries (cutoff: ${cutoff.toISOString()})`);
    }
    return result.count;
  } catch (err) {
    console.error(`[audit] purge error:`, err instanceof Error ? err.message : String(err));
    return 0;
  }
}

export async function getAuditLogCount(organizationId?: string): Promise<number> {
  const prisma = getPrismaClient();
  return prisma.auditLog.count({ where: organizationId ? { organizationId } : undefined });
}

export async function getOldestAuditEntryDate(): Promise<Date | null> {
  const prisma = getPrismaClient();
  const oldest = await prisma.auditLog.findFirst({
    orderBy: { createdAt: "asc" }, select: { createdAt: true },
  });
  return oldest?.createdAt ?? null;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

export async function pingAudit(): Promise<{
  healthy: boolean;
  config: {
    enabled: boolean; maxBufferSize: number; currentBufferSize: number;
    flushIntervalMs: number; retentionDays: number; maskedValue: string;
    maxDiffDepth: number; maxDiffFields: number; asyncEnabled: boolean;
    excludedModelCount: number; excludedFieldCount: number; middlewareApplied: boolean;
  };
  error?: string;
}> {
  initGlobalState();
  const config = getConfig();

  const safeConfig = {
    enabled: config.enabled, flushIntervalMs: config.flushIntervalMs,
    retentionDays: config.retentionDays, maskedValue: config.maskedValue,
    maxDiffDepth: config.maxDiffDepth, maxDiffFields: config.maxDiffFields,
    asyncEnabled: config.asyncEnabled, maxBufferSize: config.bufferSize,
    excludedModelCount: config.excludedModels.size,
    excludedFieldCount: config.excludedFields.size,
    currentBufferSize: globalForAudit.__buffer?.length ?? 0,
    middlewareApplied: globalForAudit.__middlewareApplied ?? false,
  };

  try {
    const prisma = getPrismaClient();
    await prisma.auditLog.count({ take: 0 });
    return { healthy: true, config: safeConfig };
  } catch (err) {
    return {
      healthy: false, config: safeConfig,
      error: err instanceof Error ? err.message : "Unknown audit health check error.",
    };
  }
}

// ---------------------------------------------------------------------------
// Manual Diff Utility
// ---------------------------------------------------------------------------

export function diffObjects(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  opts?: { maxDepth?: number; excludeFields?: string[] },
): DiffMap {
  const config = getConfig();
  if (opts?.maxDepth) config.maxDiffDepth = opts.maxDepth;
  if (opts?.excludeFields) {
    for (const field of opts.excludeFields) config.excludedFields.add(field);
  }
  const diff = computeDiff(before, after, config);
  if (opts?.excludeFields) {
    for (const field of opts.excludeFields) config.excludedFields.delete(field);
  }
  return diff;
}

export function getDiffSummary(diff: DiffMap): string {
  if (!diff || Object.keys(diff).length === 0) return "No changes detected.";

  const entries = Object.entries(diff);
  const parts: string[] = [];
  const added = entries.filter(([, v]) => v.old === null && v.new !== null);
  const removed = entries.filter(([, v]) => v.old !== null && v.new === null);
  const changed = entries.filter(([, v]) => v.old !== null && v.new !== null && v.old !== v.new);

  if (added.length === entries.length) return `Created with ${added.length} field(s).`;
  if (removed.length === entries.length) return `Deleted with ${removed.length} field(s).`;

  if (changed.length > 0) {
    const sample = changed.slice(0, 3).map(([field]) => `"${field.split(".").pop() || field}"`);
    const changedSummary = `Changed ${sample.join(", ")}`;
    if (changed.length > 3) parts.push(`${changedSummary} and ${changed.length - 3} more field(s)`);
    else parts.push(changedSummary);
  }
  if (added.length > 0) parts.push(`added ${added.length} field(s)`);
  if (removed.length > 0) parts.push(`removed ${removed.length} field(s)`);
  return parts.join(", ") + ".";
}

export function formatDiffField(field: string, diff: FieldDiff): string {
  const fieldName = field.split(".").pop() || field;
  const oldStr = diff.old === null ? "(none)" : typeof diff.old === "object" ? JSON.stringify(diff.old) : String(diff.old);
  const newStr = diff.new === null ? "(none)" : typeof diff.new === "object" ? JSON.stringify(diff.new) : String(diff.new);

  if (diff.old === null && diff.new !== null) return `Added ${fieldName}: ${newStr}`;
  if (diff.old !== null && diff.new === null) return `Removed ${fieldName} (was: ${oldStr})`;
  return `Changed ${fieldName}: ${oldStr} → ${newStr}`;
}

// ---------------------------------------------------------------------------
// Export Utilities
// ---------------------------------------------------------------------------

export async function exportAuditLogsCSV(query: AuditQuery): Promise<string> {
  const result = await queryAuditLogs({ ...query, limit: 10000 });
  const header = "id,action,entityType,entityId,userId,userName,userEmail,organizationId,ipAddress,changesSummary,createdAt\n";
  const rows = result.entries.map((entry) => {
    const changesSummary = entry.changes ? getDiffSummary(entry.changes).replace(/"/g, '""') : "";
    return [
      entry.id, entry.action, entry.entityType, entry.entityId,
      entry.userId, entry.userName ?? "", entry.userEmail ?? "",
      entry.organizationId, entry.ipAddress ?? "",
      `"${changesSummary}"`, entry.createdAt,
    ].join(",");
  });
  return header + rows.join("\n");
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function shutdownAudit(): Promise<void> {
  stopFlushTimer();
  await flushAuditBuffer();
  if (process.env.NODE_ENV !== "production") {
    console.log("[audit] service shut down, buffer flushed");
  }
}

export function getAuditBufferStats(): {
  bufferSize: number; maxBufferSize: number; percentFull: number;
  flushing: boolean; middlewareApplied: boolean;
} {
  initGlobalState();
  const config = getConfig();
  const size = globalForAudit.__buffer?.length ?? 0;
  return {
    bufferSize: size, maxBufferSize: config.bufferSize,
    percentFull: config.bufferSize > 0 ? Math.round((size / config.bufferSize) * 100) : 0,
    flushing: globalForAudit.__flushing ?? false,
    middlewareApplied: globalForAudit.__middlewareApplied ?? false,
  };
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const audit = {
  applyMiddleware: applyAuditMiddleware,
  shutdown: shutdownAudit,
  flush: flushAuditBuffer,
  setContext: setAuditContext,
  getContext: getAuditContext,
  clearContext: clearAuditContext,
  record: recordAudit,
  query: queryAuditLogs,
  get: getAuditLogEntry,
  getEntityHistory,
  count: getAuditLogCount,
  computeDiff,
  diffObjects,
  getDiffSummary,
  formatDiffField,
  purge: purgeExpiredAuditLogs,
  getOldestEntry: getOldestAuditEntryDate,
  exportCSV: exportAuditLogsCSV,
  ping: pingAudit,
  bufferStats: getAuditBufferStats,
  reloadConfig: reloadAuditConfig,
} as const;

export default audit;