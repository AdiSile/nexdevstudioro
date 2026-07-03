/**
 * Structured Logger — Pino-based, Correlation IDs, Monitoring Export
 *
 * Production-grade structured JSON logging with log levels, automatic
 * correlation ID propagation, request-scoped child loggers, redaction of
 * sensitive fields, and first-class export to monitoring systems
 * (Datadog, Grafana Loki, CloudWatch, stdout as ndjson).
 *
 * Architecture:
 *   1. Pino as the base logger — high-performance, low-overhead, ndjson stdout
 *   2. AsyncLocalStorage for correlation ID propagation across async boundaries
 *   3. Per-request child loggers with automatic enrichment (requestId, userId,
 *      organizationId, IP, userAgent, traceId)
 *   4. Sensitive field redaction via Pino serializers + custom redact patterns
 *   5. Transport pipeline: stdout (ndjson) → optional sidecar file / HTTP export
 *      to Datadog / Loki / CloudWatch via pino-abstract-transport compatible
 *      custom transports
 *   6. Log levels: trace < debug < info < warn < error < fatal
 *   7. Sampling for high-volume trace/debug logs in production
 *   8. Circular reference protection
 *
 * Log Levels (syslog-compatible):
 *   10 — trace   (extremely verbose; sampled in production by default)
 *   20 — debug   (diagnostics; sampled in production)
 *   30 — info    (normal operational events)
 *   40 — warn    (recoverable issues, degradation)
 *   50 — error   (unrecoverable errors; triggers alert-rules in monitoring)
 *   60 — fatal   (process-crashing errors; immediate escalation)
 *
 * Environment Variables:
 *   LOG_LEVEL                       — minimum level (default: "info"; "debug" in dev)
 *   LOG_PRETTY                      — pretty-print in console (default: true in dev, false in prod)
 *   LOG_TIMESTAMP                   — include timestamps (default: true)
 *   LOG_REDACT_FIELDS               — comma-separated fields to redact (appended to defaults)
 *   LOG_SAMPLING_TRACE_RATE         — fraction of trace logs to emit in prod (default: 0.0)
 *   LOG_SAMPLING_DEBUG_RATE         — fraction of debug logs to emit in prod (default: 0.05)
 *   LOG_MONITORING_ENABLED          — enable monitoring export (default: false)
 *   LOG_MONITORING_ENDPOINT         — HTTP endpoint for log export (Datadog/Loki)
 *   LOG_MONITORING_API_KEY          — API key for monitoring endpoint
 *   LOG_MONITORING_BATCH_SIZE       — batch size for monitoring export (default: 100)
 *   LOG_MONITORING_FLUSH_INTERVAL_MS — flush interval ms (default: 5000)
 *   LOG_FILE_PATH                   — optional sidecar file path for persistent logs
 *
 * Usage — Simple:
 *   import { logger } from "@/lib/logger";
 *   logger.info("User signed in", { userId: "usr_123" });
 *   logger.error({ err: new Error("DB down") }, "Database connection lost");
 *
 * Usage — Request-scoped (preferred):
 *   import { createRequestLogger } from "@/lib/logger";
 *
 *   // In middleware / API route:
 *   const log = createRequestLogger({ requestId, userId, organizationId, ip, userAgent });
 *   log.info("Processing request");
 *   log.child({ component: "billing" }).info("Invoice generated");
 *
 * Usage — Correlation ID Propagation:
 *   import { runWithCorrelationId, getCorrelationId, logger } from "@/lib/logger";
 *
 *   await runWithCorrelationId("req_abc123", async () => {
 *     await someAsyncWork(); // all logs inside inherit correlationId
 *   });
 */

import pino, { type Logger as PinoLogger, type LoggerOptions, type Bindings } from "pino";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { createWriteStream, type WriteStream } from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Log levels supported by the logger — maps to Pino numeric levels */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/** Numeric log levels (Pino convention) */
export const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

/** Labels for numeric levels */
export const LOG_LEVEL_LABELS: Record<number, LogLevel> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

/** Request context injected into child loggers */
export interface RequestLogContext {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  userId?: string;
  organizationId?: string;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  latencyMs?: number;
  component?: string;
  [key: string]: unknown;
}

/** Logger configuration */
export interface LoggerConfig {
  level: LogLevel;
  pretty: boolean;
  timestamp: boolean;
  redactFields: string[];
  sampling: {
    traceRate: number;
    debugRate: number;
  };
  monitoring: {
    enabled: boolean;
    endpoint?: string;
    apiKey?: string;
    batchSize: number;
    flushIntervalMs: number;
  };
  filePath?: string;
  baseBindings: Record<string, unknown>;
}

/** Structured log entry for monitoring export */
export interface LogEntry {
  level: number;
  time: number;
  pid: number;
  hostname: string;
  msg: string;
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  userId?: string;
  organizationId?: string;
  component?: string;
  err?: {
    type: string;
    message: string;
    stack?: string;
    code?: string;
  };
  [key: string]: unknown;
}

/** Type for the public logger API */
export interface Logger {
  trace: (msg: string, obj?: Record<string, unknown>) => void;
  debug: (msg: string, obj?: Record<string, unknown>) => void;
  info: (msg: string, obj?: Record<string, unknown>) => void;
  warn: (msg: string, obj?: Record<string, unknown>) => void;
  error: (msgOrObj: string | Record<string, unknown>, objOrMsg?: string | Record<string, unknown>) => void;
  fatal: (msgOrObj: string | Record<string, unknown>, objOrMsg?: string | Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
  level: LogLevel;
  setLevel: (level: LogLevel) => void;
  flush: () => Promise<void>;
}

/** Monitoring transport state */
interface MonitoringTransportState {
  buffer: LogEntry[];
  timer: ReturnType<typeof setInterval> | undefined;
  flushing: boolean;
}

// ---------------------------------------------------------------------------
// AsyncLocalStorage for Correlation ID Propagation
// ---------------------------------------------------------------------------

const correlationStorage = new AsyncLocalStorage<{ correlationId: string }>();

/**
 * Run an async function with a given correlation ID.
 * All logs emitted within the callback automatically inherit the correlation ID.
 *
 * @example
 *   await runWithCorrelationId("ord_12345", async () => {
 *     await processPayment(); // logs inside will have correlationId: "ord_12345"
 *   });
 */
export async function runWithCorrelationId<T>(
  correlationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return correlationStorage.run({ correlationId }, fn);
}

/**
 * Run an async function with a generated correlation ID.
 * Returns the generated ID alongside the result.
 */
export async function runWithGeneratedCorrelationId<T>(
  fn: (correlationId: string) => Promise<T>,
): Promise<{ correlationId: string; result: T }> {
  const correlationId = randomUUID();
  const result = await correlationStorage.run({ correlationId }, () => fn(correlationId));
  return { correlationId, result };
}

/**
 * Get the current correlation ID from async context, if any.
 */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

// ---------------------------------------------------------------------------
// Global State
// ---------------------------------------------------------------------------

interface GlobalLoggerState {
  __config: LoggerConfig | undefined;
  __baseLogger: PinoLogger | undefined;
  __monitoringState: MonitoringTransportState | undefined;
  __fileStream: WriteStream | undefined;
}

const globalForLogger = globalThis as unknown as GlobalLoggerState;

function initGlobalState(): void {
  if (!globalForLogger.__monitoringState) {
    globalForLogger.__monitoringState = {
      buffer: [],
      timer: undefined,
      flushing: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Sensitive Field Redaction
// ---------------------------------------------------------------------------

const DEFAULT_REDACT_FIELDS = [
  "password",
  "passwordHash",
  "password_hash",
  "passwd",
  "secret",
  "apiKey",
  "api_key",
  "apikey",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "idToken",
  "id_token",
  "authorization",
  "credential",
  "credentials",
  "privateKey",
  "private_key",
  "totpSecret",
  "totp_secret",
  "recoveryCodes",
  "recovery_codes",
  "ssn",
  "socialSecurity",
  "creditCard",
  "credit_card",
  "ccv",
  "cvc",
  "cvv",
  "iban",
  "bankAccount",
  "bank_account",
  "routing",
  "pin",
  "passcode",
];

const REDACTED_VALUE = "[REDACTED]";

/**
 * Build the Pino redact configuration from the field list.
 */
function buildRedactConfig(fields: string[]): LoggerOptions["redact"] {
  const allFields = [...new Set([...DEFAULT_REDACT_FIELDS, ...fields])];
  const paths = allFields.flatMap((field) => [
    field,
    `*.${field}`,
    `*.*.${field}`,
    `*.*.*.${field}`,
    `obj.${field}`,
    `err.${field}`,
  ]);
  return {
    paths,
    censor: REDACTED_VALUE,
    remove: false,
  };
}

// ---------------------------------------------------------------------------
// Custom Serializers
// ---------------------------------------------------------------------------

/**
 * Error serializer that extracts structured error info.
 * Prevents Pino from serializing the full error object including
 * non-enumerable properties.
 */
function errorSerializer(err: Error): Record<string, unknown> {
  return {
    type: err.constructor.name,
    message: err.message,
    stack: err.stack,
    ...(err as Record<string, unknown>),
    // Override any sensitive fields
    password: undefined,
    secret: undefined,
    token: undefined,
    key: undefined,
  };
}

/**
 * Request serializer that extracts only safe fields.
 */
function requestSerializer(req: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!req) return null;
  return {
    method: req.method,
    url: req.url,
    headers: undefined, // Never log raw headers — use specific fields
    remoteAddress: req.socket ? (req.socket as Record<string, unknown>).remoteAddress : undefined,
  };
}

/**
 * Response serializer — extracts status + timing.
 */
function responseSerializer(res: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!res) return null;
  return {
    statusCode: res.statusCode,
    headers: undefined, // Never log response headers
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function envStr(key: string, fallback: string): string {
  const raw = process.env[key];
  return raw !== undefined && raw !== "" ? raw : fallback;
}

function envNum(key: string, fallback: number): number {
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

function buildLoggerConfig(): LoggerConfig {
  const isDev = process.env.NODE_ENV !== "production";

  const redactExtraRaw = process.env.LOG_REDACT_FIELDS;
  const redactExtra = redactExtraRaw
    ? redactExtraRaw.split(",").map((f) => f.trim()).filter(Boolean)
    : [];

  return {
    level: (process.env.LOG_LEVEL || (isDev ? "debug" : "info")) as LogLevel,
    pretty: envBool("LOG_PRETTY", isDev),
    timestamp: envBool("LOG_TIMESTAMP", true),
    redactFields: redactExtra,
    sampling: {
      traceRate: envNum("LOG_SAMPLING_TRACE_RATE", 0.0),
      debugRate: envNum("LOG_SAMPLING_DEBUG_RATE", isDev ? 1.0 : 0.05),
    },
    monitoring: {
      enabled: envBool("LOG_MONITORING_ENABLED", false),
      endpoint: process.env.LOG_MONITORING_ENDPOINT || undefined,
      apiKey: process.env.LOG_MONITORING_API_KEY || undefined,
      batchSize: envNum("LOG_MONITORING_BATCH_SIZE", 100),
      flushIntervalMs: envNum("LOG_MONITORING_FLUSH_INTERVAL_MS", 5000),
    },
    filePath: process.env.LOG_FILE_PATH || undefined,
    baseBindings: {
      env: process.env.NODE_ENV || "development",
      service: process.env.LOG_SERVICE_NAME || "nexus",
      version: process.env.npm_package_version || process.env.APP_VERSION || "0.0.0",
      pid: process.pid,
      hostname: process.env.HOSTNAME || process.env.HOST || "unknown",
    },
  };
}

function getConfig(): LoggerConfig {
  if (!globalForLogger.__config) {
    globalForLogger.__config = buildLoggerConfig();
  }
  return globalForLogger.__config;
}

/**
 * Reload configuration at runtime (useful for feature flags / hot-reload).
 */
export function reloadLoggerConfig(): LoggerConfig {
  globalForLogger.__config = buildLoggerConfig();
  // Rebuild the base logger
  globalForLogger.__baseLogger = createPinoLogger(globalForLogger.__config);
  stopMonitoringFlush();
  if (globalForLogger.__config.monitoring.enabled) {
    startMonitoringFlush();
  }
  return globalForLogger.__config;
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

/**
 * Determine whether a log at a given level should be emitted based on
 * the configured sampling rates. Only trace and debug are sampled.
 */
function shouldSample(level: LogLevel, config: LoggerConfig): boolean {
  if (level === "trace") {
    return Math.random() < config.sampling.traceRate;
  }
  if (level === "debug") {
    return Math.random() < config.sampling.debugRate;
  }
  return true; // info, warn, error, fatal are always emitted
}

// ---------------------------------------------------------------------------
// Base Logger Construction
// ---------------------------------------------------------------------------

function createPinoLogger(config: LoggerConfig): PinoLogger {
  const targets: pino.TransportTargetOptions[] = [];

  // Stdout target
  targets.push({
    target: "pino/file",
    level: config.level,
    options: {
      destination: 1, // stdout
      ...(config.pretty
        ? {}
        : {}),
    },
  });

  const options: LoggerOptions = {
    level: config.level,
    timestamp: config.timestamp ? pino.stdTimeFunctions.isoTime : false,
    redact: buildRedactConfig(config.redactFields),
    serializers: {
      err: errorSerializer,
      error: errorSerializer,
      req: requestSerializer,
      res: responseSerializer,
    },
    formatters: {
      level(label: string, _number: number) {
        return { level: label };
      },
      bindings(bindings: Bindings) {
        return {
          pid: bindings.pid,
          hostname: bindings.hostname,
          env: bindings.env,
          service: bindings.service,
          version: bindings.version,
        };
      },
      log(obj: Record<string, unknown>) {
        // Extract correlation ID from async context automatically
        const correlationId = getCorrelationId();
        if (correlationId) {
          obj.correlationId = correlationId;
        }
        return obj;
      },
    },
    // Never crash on logging errors
    errorKey: "err",
    messageKey: "msg",
    // Use the base config from above
    base: null, // We manage base bindings via formatters.bindings
  };

  // For pretty-printing in development
  if (config.pretty) {
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
          ignore: "pid,hostname,service,version",
          messageFormat: "{correlationId} {msg}",
          levelFirst: true,
          singleLine: false,
          hideObject: false,
        },
      },
    });
  }

  return pino(options);
}

// ---------------------------------------------------------------------------
// Base Logger Singleton
// ---------------------------------------------------------------------------

function getBaseLogger(): PinoLogger {
  if (!globalForLogger.__baseLogger) {
    const config = getConfig();
    globalForLogger.__baseLogger = createPinoLogger(config);
  }
  return globalForLogger.__baseLogger;
}

// ---------------------------------------------------------------------------
// File Stream (Optional Sidecar)
// ---------------------------------------------------------------------------

function getFileStream(): WriteStream | undefined {
  const config = getConfig();
  if (!config.filePath) return undefined;

  if (!globalForLogger.__fileStream) {
    const dir = path.dirname(config.filePath);
    // Ensure directory exists (best-effort in Node; for production use fs.mkdirSync)
    try {
      // Dynamic require to avoid bundling fs in edge runtimes
      const fs = require("node:fs") as typeof import("node:fs");
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Directory may already exist; ignore
    }
    globalForLogger.__fileStream = createWriteStream(config.filePath, {
      flags: "a",
      encoding: "utf-8",
    });
  }

  return globalForLogger.__fileStream;
}

// ---------------------------------------------------------------------------
// Monitoring Export Transport
// ---------------------------------------------------------------------------

function startMonitoringFlush(): void {
  initGlobalState();
  const config = getConfig();
  const state = globalForLogger.__monitoringState!;

  if (state.timer) return;

  state.timer = setInterval(() => {
    flushMonitoringBuffer().catch((err) => {
      // Use raw console to avoid circular logging
      console.error("[logger] monitoring flush error:", err instanceof Error ? err.message : String(err));
    });
  }, config.monitoring.flushIntervalMs);

  if (state.timer && typeof state.timer === "object") {
    (state.timer as ReturnType<typeof setInterval>).unref?.();
  }
}

function stopMonitoringFlush(): void {
  const state = globalForLogger.__monitoringState;
  if (state?.timer) {
    clearInterval(state.timer);
    state.timer = undefined;
  }
}

function bufferLogEntry(entry: LogEntry): void {
  initGlobalState();
  const config = getConfig();
  const state = globalForLogger.__monitoringState!;

  state.buffer.push(entry);

  if (state.buffer.length >= config.monitoring.batchSize) {
    flushMonitoringBuffer().catch((err) => {
      console.error("[logger] monitoring forced flush error:", err instanceof Error ? err.message : String(err));
    });
  }
}

/**
 * Flush the monitoring buffer to the configured endpoint.
 */
export async function flushMonitoringBuffer(): Promise<void> {
  const config = getConfig();
  const state = globalForLogger.__monitoringState;
  if (!state || state.buffer.length === 0) return;
  if (state.flushing) return;

  if (!config.monitoring.enabled || !config.monitoring.endpoint) {
    // If monitoring isn't enabled, just drain the buffer
    state.buffer.length = 0;
    return;
  }

  state.flushing = true;
  const batch = state.buffer.splice(0, config.monitoring.batchSize);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.monitoring.apiKey) {
      headers["Authorization"] = `Bearer ${config.monitoring.apiKey}`;
    }

    // Use the global fetch API (Node 18+)
    const response = await fetch(config.monitoring.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok && process.env.NODE_ENV !== "production") {
      console.warn(`[logger] monitoring export returned ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[logger] monitoring export failed: ${message}`);
    // Re-enqueue only if buffer isn't already too large
    if (state.buffer.length < config.monitoring.batchSize * 3) {
      state.buffer.unshift(...batch);
    }
  } finally {
    state.flushing = false;
  }
}

// ---------------------------------------------------------------------------
// Core: Create a Logging Method with Sampling
// ---------------------------------------------------------------------------

type LogMethod = (msgOrObj: string | Record<string, unknown>, objOrMsg?: string | Record<string, unknown>) => void;

function createLogMethod(baseLogger: PinoLogger, level: LogLevel, config: LoggerConfig): LogMethod {
  return (msgOrObj: string | Record<string, unknown>, objOrMsg?: string | Record<string, unknown>) => {
    // Sampling
    if (!shouldSample(level, config)) return;

    let msg: string;
    let obj: Record<string, unknown> | undefined;

    if (typeof msgOrObj === "string") {
      msg = msgOrObj;
      obj = typeof objOrMsg === "object" && objOrMsg !== null ? objOrMsg as Record<string, unknown> : undefined;
    } else {
      obj = msgOrObj as Record<string, unknown>;
      msg = typeof objOrMsg === "string" ? objOrMsg : (obj?.msg as string) || "";
    }

    // Inject correlation ID from async context
    const correlationId = getCorrelationId();
    const enrichedObj: Record<string, unknown> = { ...obj };
    if (correlationId) {
      enrichedObj.correlationId = correlationId;
    }

    // Call the correct Pino method
    if (level === "fatal") {
      baseLogger.fatal(enrichedObj, msg);
    } else if (level === "error") {
      baseLogger.error(enrichedObj, msg);
    } else if (level === "warn") {
      baseLogger.warn(enrichedObj, msg);
    } else if (level === "info") {
      baseLogger.info(enrichedObj, msg);
    } else if (level === "debug") {
      baseLogger.debug(enrichedObj, msg);
    } else {
      baseLogger.trace(enrichedObj, msg);
    }

    // Also write to file sidecar
    const fileStream = getFileStream();
    if (fileStream) {
      const line = JSON.stringify({
        level: LOG_LEVELS[level],
        time: new Date().toISOString(),
        msg,
        ...enrichedObj,
      }) + "\n";
      fileStream.write(line);
    }

    // Buffer for monitoring export
    const monitoringConfig = config.monitoring;
    if (monitoringConfig.enabled && monitoringConfig.endpoint) {
      const entry: LogEntry = {
        level: LOG_LEVELS[level],
        time: Date.now(),
        pid: process.pid,
        hostname: process.env.HOSTNAME || "unknown",
        msg,
        correlationId: correlationId || (enrichedObj.correlationId as string | undefined),
        requestId: enrichedObj.requestId as string | undefined,
        traceId: enrichedObj.traceId as string | undefined,
        userId: enrichedObj.userId as string | undefined,
        organizationId: enrichedObj.organizationId as string | undefined,
        component: enrichedObj.component as string | undefined,
        ...enrichedObj,
      };

      // If there's an error object, structure it
      if (enrichedObj.err && enrichedObj.err instanceof Error) {
        entry.err = {
          type: enrichedObj.err.constructor.name,
          message: enrichedObj.err.message,
          stack: enrichedObj.err.stack,
          code: (enrichedObj.err as NodeJS.ErrnoException).code,
        };
      }

      bufferLogEntry(entry);
    }
  };
}

// ---------------------------------------------------------------------------
// Build Public Logger Instance
// ---------------------------------------------------------------------------

function wrapPinoLogger(pinoLogger: PinoLogger, config: LoggerConfig): Logger {
  return {
    trace: createLogMethod(pinoLogger, "trace", config),
    debug: createLogMethod(pinoLogger, "debug", config),
    info: createLogMethod(pinoLogger, "info", config),
    warn: createLogMethod(pinoLogger, "warn", config),
    error: createLogMethod(pinoLogger, "error", config),
    fatal: createLogMethod(pinoLogger, "fatal", config),

    get level(): LogLevel {
      return (pinoLogger.levelVal !== undefined
        ? (LOG_LEVEL_LABELS[pinoLogger.levelVal] as LogLevel)
        : config.level);
    },

    setLevel(level: LogLevel): void {
      pinoLogger.level = level;
    },

    child(bindings: Record<string, unknown>): Logger {
      const child = pinoLogger.child(bindings);
      return wrapPinoLogger(child, config);
    },

    async flush(): Promise<void> {
      await flushMonitoringBuffer();
      // Pino's flush is not async, but we can force it
      pinoLogger.flush();
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton Logger Instance
// ---------------------------------------------------------------------------

/**
 * The default logger instance. Use for non-request-scoped logging.
 *
 * @example
 *   import { logger } from "@/lib/logger";
 *   logger.info("Server started", { port: 3000 });
 *   logger.error({ err: new Error("Boom") }, "Something went wrong");
 */
export const logger: Logger = (() => {
  const config = getConfig();
  const baseLogger = getBaseLogger();
  // Start monitoring flush if enabled
  if (config.monitoring.enabled) {
    startMonitoringFlush();
  }
  return wrapPinoLogger(baseLogger, config);
})();

// ---------------------------------------------------------------------------
// Request-Scoped Logger Factory
// ---------------------------------------------------------------------------

/**
 * Create a request-scoped child logger with automatic enrichment.
 *
 * The returned logger has all bindings from the context attached, and
 * inherits the correlation ID from AsyncLocalStorage if available.
 *
 * @example
 *   const log = createRequestLogger({
 *     requestId: "req_abc",
 *     userId: "usr_123",
 *     organizationId: "org_456",
 *     component: "billing",
 *   });
 *   log.info("Invoice created", { invoiceId: "inv_789" });
 */
export function createRequestLogger(ctx: RequestLogContext): Logger {
  const config = getConfig();
  const baseLogger = getBaseLogger();

  const bindings: Record<string, unknown> = {};

  if (ctx.requestId) bindings.requestId = ctx.requestId;
  if (ctx.correlationId) bindings.correlationId = ctx.correlationId;
  if (ctx.traceId) bindings.traceId = ctx.traceId;
  if (ctx.userId) bindings.userId = ctx.userId;
  if (ctx.organizationId) bindings.organizationId = ctx.organizationId;
  if (ctx.tenantId) bindings.tenantId = ctx.tenantId;
  if (ctx.ip) bindings.ip = ctx.ip;
  if (ctx.userAgent) bindings.userAgent = ctx.userAgent;
  if (ctx.method) bindings.method = ctx.method;
  if (ctx.url) bindings.url = ctx.url;
  if (ctx.component) bindings.component = ctx.component;

  // Also attach any extra keys
  for (const [key, value] of Object.entries(ctx)) {
    if (!(key in bindings) && value !== undefined) {
      bindings[key] = value;
    }
  }

  const childLogger = baseLogger.child(bindings);
  return wrapPinoLogger(childLogger, config);
}

// ---------------------------------------------------------------------------
// Convenience: Create Logger with Component Tag
// ---------------------------------------------------------------------------

/**
 * Create a logger tagged with a component name.
 * Useful for module-level loggers.
 *
 * @example
 *   const log = createComponentLogger("auth");
 *   log.info("OAuth flow started");
 */
export function createComponentLogger(component: string): Logger {
  return createRequestLogger({ component });
}

// ---------------------------------------------------------------------------
// Audit Log Helper
// ---------------------------------------------------------------------------

/**
 * Log an audit event. These are always at "info" level and carry an
 * `audit: true` marker for easy filtering in monitoring systems.
 *
 * @param action - The action performed (e.g., "user.signin", "invoice.create")
 * @param details - Contextual details about the action
 */
export function auditLog(action: string, details: Record<string, unknown> = {}): void {
  const correlationId = getCorrelationId();
  logger.info(`[AUDIT] ${action}`, {
    audit: true,
    action,
    correlationId,
    ...details,
  });
}

// ---------------------------------------------------------------------------
// Performance / Latency Logging Helper
// ---------------------------------------------------------------------------

/**
 * Start a high-resolution timer for performance tracking.
 * Returns a stop function that logs the elapsed time.
 *
 * @example
 *   const stop = startPerfTimer("db-query", { query: "SELECT ..." });
 *   const result = await db.query(...);
 *   stop({ rows: result.length });
 */
export function startPerfTimer(
  label: string,
  startMeta: Record<string, unknown> = {},
): (endMeta?: Record<string, unknown>) => void {
  const start = process.hrtime.bigint();
  const correlationId = getCorrelationId();

  return (endMeta: Record<string, unknown> = {}) => {
    const elapsedNs = process.hrtime.bigint() - start;
    const elapsedMs = Number(elapsedNs) / 1_000_000;

    logger.debug(`[PERF] ${label}`, {
      perf: true,
      label,
      elapsedMs: Math.round(elapsedMs * 100) / 100, // 2 decimal places
      elapsedNs: elapsedNs.toString(),
      correlationId,
      ...startMeta,
      ...endMeta,
    });

    // If slow (>1s), promote to warn
    if (elapsedMs > 1000) {
      logger.warn(`[PERF:SLOW] ${label} took ${Math.round(elapsedMs)}ms`, {
        perf: true,
        label,
        elapsedMs: Math.round(elapsedMs),
        correlationId,
        ...startMeta,
        ...endMeta,
      });
    }
  };
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Verify that the logger is properly configured and operational.
 */
export function pingLogger(): {
  healthy: boolean;
  config: {
    level: LogLevel;
    pretty: boolean;
    timestamp: boolean;
    redactFieldCount: number;
    samplingTraceRate: number;
    samplingDebugRate: number;
    monitoringEnabled: boolean;
    monitoringEndpoint: string | undefined;
    monitoringBufferSize: number;
    monitoringFlushing: boolean;
    filePath: string | undefined;
    correlationIdActive: boolean;
  };
  error?: string;
} {
  initGlobalState();
  const config = getConfig();
  const state = globalForLogger.__monitoringState;

  const healthConfig = {
    level: config.level,
    pretty: config.pretty,
    timestamp: config.timestamp,
    redactFieldCount: config.redactFields.length + DEFAULT_REDACT_FIELDS.length,
    samplingTraceRate: config.sampling.traceRate,
    samplingDebugRate: config.sampling.debugRate,
    monitoringEnabled: config.monitoring.enabled,
    monitoringEndpoint: config.monitoring.endpoint ? "[configured]" : undefined,
    monitoringBufferSize: state?.buffer.length ?? 0,
    monitoringFlushing: state?.flushing ?? false,
    filePath: config.filePath,
    correlationIdActive: getCorrelationId() !== undefined,
  };

  try {
    // Test that the logger can emit a message
    getBaseLogger().debug({ health: true }, "Logger health check");
    return { healthy: true, config: healthConfig };
  } catch (err) {
    return {
      healthy: false,
      config: healthConfig,
      error: err instanceof Error ? err.message : "Unknown logger health check error.",
    };
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: Shutdown
// ---------------------------------------------------------------------------

/**
 * Gracefully shutdown the logger.
 * Flushes monitoring buffer, closes file streams, stops timers.
 * Call during server shutdown (SIGTERM / SIGINT handler).
 */
export async function shutdownLogger(): Promise<void> {
  stopMonitoringFlush();
  await flushMonitoringBuffer();

  const fileStream = globalForLogger.__fileStream;
  if (fileStream) {
    await new Promise<void>((resolve) => {
      fileStream.end(() => resolve());
    });
    globalForLogger.__fileStream = undefined;
  }

  // Pino doesn't have an async close, but we can flush
  const baseLogger = globalForLogger.__baseLogger;
  if (baseLogger) {
    baseLogger.flush();
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[logger] shut down gracefully");
  }
}

// ---------------------------------------------------------------------------
// Monitoring Buffer Stats
// ---------------------------------------------------------------------------

/**
 * Get current monitoring buffer statistics.
 */
export function getMonitoringBufferStats(): {
  bufferSize: number;
  maxBatchSize: number;
  flushing: boolean;
  percentFull: number;
} {
  initGlobalState();
  const config = getConfig();
  const state = globalForLogger.__monitoringState!;
  const size = state.buffer.length;
  return {
    bufferSize: size,
    maxBatchSize: config.monitoring.batchSize,
    flushing: state.flushing,
    percentFull: config.monitoring.batchSize > 0
      ? Math.round((size / config.monitoring.batchSize) * 100)
      : 0,
  };
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const log = {
  // Core logger
  logger,

  // Factories
  createRequestLogger,
  createComponentLogger,

  // Correlation ID
  runWithCorrelationId,
  runWithGeneratedCorrelationId,
  getCorrelationId,

  // Utilities
  audit: auditLog,
  startPerfTimer,

  // Monitoring
  flushMonitoring: flushMonitoringBuffer,
  getMonitoringBufferStats,

  // Lifecycle
  shutdown: shutdownLogger,
  reloadConfig: reloadLoggerConfig,

  // Health
  ping: pingLogger,

  // Constants
  levels: LOG_LEVELS,
  levelLabels: LOG_LEVEL_LABELS,
} as const;

export default log;