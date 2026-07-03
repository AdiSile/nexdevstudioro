/**
 * BullMQ Queue System
 *
 * Job queues for asynchronous processing: email, notifications, AI processing,
 * and exports. Built on BullMQ with ioredis connection reuse.
 *
 * Architecture:
 *   - One Queue per job domain (email, notification, ai, export)
 *   - Each queue has its own Worker (spawned in a separate process or
 *     conditionally when running as a worker entrypoint)
 *   - Producers (Next.js API routes / server actions) only enqueue jobs
 *   - Consumers (workers) run in a long-lived Node process
 *
 * Usage (Producer):
 *   import { emailQueue } from "@/lib/queue";
 *   await emailQueue.add("send-welcome", { to: "user@example.com", ... });
 *
 * Usage (Worker) — run via: npx ts-node --compiler-options '{"module":"CommonJS"}' src/lib/queue.worker.ts
 *
 * Environment Variables:
 *   REDIS_URL                 — shared with redis.ts
 *   QUEUE_CONCURRENCY_EMAIL   — default: 5
 *   QUEUE_CONCURRENCY_NOTIFY  — default: 10
 *   QUEUE_CONCURRENCY_AI      — default: 2
 *   QUEUE_CONCURRENCY_EXPORT  — default: 3
 */

import { Queue, Worker, type JobsOptions, type QueueOptions, type WorkerOptions } from "bullmq";
import { getRedisClient } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported queue domains */
export type QueueDomain = "email" | "notification" | "ai" | "export";

/** Job name constants per domain */
export const EmailJobs = {
  SEND_WELCOME: "send-welcome",
  SEND_PASSWORD_RESET: "send-password-reset",
  SEND_VERIFICATION: "send-verification",
  SEND_INVOICE: "send-invoice",
  SEND_NEWSLETTER: "send-newsletter",
  SEND_CUSTOM: "send-custom",
} as const;

export const NotificationJobs = {
  PUSH: "push",
  SMS: "sms",
  WEBHOOK: "webhook",
  INTERNAL: "internal",
} as const;

export const AiJobs = {
  TEXT_COMPLETION: "text-completion",
  IMAGE_GENERATION: "image-generation",
  EMBEDDING: "embedding",
  ANALYSIS: "analysis",
  TRANSCRIPTION: "transcription",
  MODERATION: "moderation",
} as const;

export const ExportJobs = {
  CSV_EXPORT: "csv-export",
  PDF_REPORT: "pdf-report",
  DATA_DUMP: "data-dump",
  BACKUP: "backup",
} as const;

// ---------------------------------------------------------------------------
// Job Data Payloads
// ---------------------------------------------------------------------------

export interface EmailJobData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    contentType?: string;
  }>;
  templateId?: string;
  templateVars?: Record<string, unknown>;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationJobData {
  userId: string;
  title: string;
  body: string;
  channel: "push" | "sms" | "webhook" | "internal";
  data?: Record<string, unknown>;
  icon?: string;
  image?: string;
  url?: string;
  /** SMS-specific */
  phoneNumber?: string;
  /** Webhook-specific */
  webhookUrl?: string;
  webhookSecret?: string;
}

export interface AiJobData {
  userId?: string;
  tenantId?: string;
  provider: "openai" | "anthropic" | "google";
  model: string;
  input: unknown;
  options?: Record<string, unknown>;
  /** Max tokens / budget */
  maxTokens?: number;
  /** Callback URL for async results */
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ExportJobData {
  userId: string;
  tenantId?: string;
  format: "csv" | "pdf" | "json" | "sql";
  query?: string;
  table?: string;
  filters?: Record<string, unknown>;
  columns?: string[];
  /** For PDF */
  template?: string;
  /** Destination: download link, email attachment, S3 upload */
  destination: "download" | "email" | "s3";
  destinationEmail?: string;
  destinationBucket?: string;
  metadata?: Record<string, unknown>;
}

/** Union of all job data types */
export type AnyJobData =
  | EmailJobData
  | NotificationJobData
  | AiJobData
  | ExportJobData;

// ---------------------------------------------------------------------------
// Queue Names
// ---------------------------------------------------------------------------

const QUEUE_PREFIX = "nexus";

const QUEUE_NAMES: Record<QueueDomain, string> = {
  email: `${QUEUE_PREFIX}:email`,
  notification: `${QUEUE_PREFIX}:notification`,
  ai: `${QUEUE_PREFIX}:ai`,
  export: `${QUEUE_PREFIX}:export`,
};

// ---------------------------------------------------------------------------
// Global Queue Singletons
// ---------------------------------------------------------------------------

interface GlobalQueueStore {
  __queues: Map<string, Queue> | undefined;
  __connection: ReturnType<typeof getRedisClient> | undefined;
  __workers: Map<string, Worker> | undefined;
}

const globalForQueues = globalThis as unknown as GlobalQueueStore;

function getConnection() {
  if (!globalForQueues.__connection) {
    globalForQueues.__connection = getRedisClient();
  }
  return globalForQueues.__connection;
}

function getQueueStore(): Map<string, Queue> {
  if (!globalForQueues.__queues) {
    globalForQueues.__queues = new Map();
  }
  return globalForQueues.__queues;
}

// ---------------------------------------------------------------------------
// Queue Factory
// ---------------------------------------------------------------------------

const DEFAULT_QUEUE_OPTIONS: Omit<QueueOptions, "connection"> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600 * 24, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 3600 * 24 * 7, // 7 days
    },
    timeout: 120_000, // 2 minutes default
  },
};

/**
 * Create or retrieve a BullMQ Queue instance.
 * Connection is shared across all queues via the singleton Redis client.
 */
export function getQueue(domain: QueueDomain, opts?: Partial<QueueOptions>): Queue {
  const store = getQueueStore();
  const name = QUEUE_NAMES[domain];

  const existing = store.get(name);
  if (existing) {
    return existing;
  }

  const connection = getConnection();
  const queue = new Queue(name, {
    connection,
    ...DEFAULT_QUEUE_OPTIONS,
    ...opts,
  });

  queue.on("error", (err: Error) => {
    console.error(`[queue:${domain}] error:`, err.message);
  });

  queue.on("waiting", (jobId: string) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[queue:${domain}] job ${jobId} waiting`);
    }
  });

  store.set(name, queue);
  return queue;
}

// ---------------------------------------------------------------------------
// Pre-built Queue Instances (lazy)
// ---------------------------------------------------------------------------

let __emailQueue: Queue | undefined;
let __notificationQueue: Queue | undefined;
let __aiQueue: Queue | undefined;
let __exportQueue: Queue | undefined;

export function getEmailQueue(): Queue {
  if (!__emailQueue) {
    __emailQueue = getQueue("email");
  }
  return __emailQueue;
}

export function getNotificationQueue(): Queue {
  if (!__notificationQueue) {
    __notificationQueue = getQueue("notification");
  }
  return __notificationQueue;
}

export function getAiQueue(): Queue {
  if (!__aiQueue) {
    __aiQueue = getQueue("ai");
  }
  return __aiQueue;
}

export function getExportQueue(): Queue {
  if (!__exportQueue) {
    __exportQueue = getQueue("export");
  }
  return __exportQueue;
}

/**
 * Convenience accessors — use these in API routes / server actions.
 */
export const emailQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    return Reflect.get(getEmailQueue(), prop);
  },
}) as Queue;

export const notificationQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    return Reflect.get(getNotificationQueue(), prop);
  },
}) as Queue;

export const aiQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    return Reflect.get(getAiQueue(), prop);
  },
}) as Queue;

export const exportQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    return Reflect.get(getExportQueue(), prop);
  },
}) as Queue;

// ---------------------------------------------------------------------------
// Typed Job Enqueuing Helpers
// ---------------------------------------------------------------------------

/**
 * Enqueue an email job.
 */
export async function enqueueEmail(
  jobName: string,
  data: EmailJobData,
  opts?: JobsOptions,
) {
  const queue = getEmailQueue();
  return queue.add(jobName, data, opts);
}

/**
 * Enqueue a notification job.
 */
export async function enqueueNotification(
  jobName: string,
  data: NotificationJobData,
  opts?: JobsOptions,
) {
  const queue = getNotificationQueue();
  return queue.add(jobName, data, opts);
}

/**
 * Enqueue an AI processing job.
 */
export async function enqueueAi(
  jobName: string,
  data: AiJobData,
  opts?: JobsOptions,
) {
  const queue = getAiQueue();
  return queue.add(jobName, data, opts);
}

/**
 * Enqueue an export job.
 */
export async function enqueueExport(
  jobName: string,
  data: ExportJobData,
  opts?: JobsOptions,
) {
  const queue = getExportQueue();
  return queue.add(jobName, data, opts);
}

// ---------------------------------------------------------------------------
// Bulk Enqueue
// ---------------------------------------------------------------------------

export interface BulkJob<T = unknown> {
  name: string;
  data: T;
  opts?: JobsOptions;
}

/**
 * Add multiple jobs to a queue at once.
 */
export async function enqueueBulk<T = unknown>(
  domain: QueueDomain,
  jobs: BulkJob<T>[],
) {
  const queue = getQueue(domain);
  return queue.addBulk(jobs);
}

// ---------------------------------------------------------------------------
// Worker Factory
// ---------------------------------------------------------------------------

const DEFAULT_WORKER_OPTIONS: Omit<WorkerOptions, "connection"> = {
  concurrency: 1,
  autorun: true,
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 200 },
  lockDuration: 120_000,
  stalledInterval: 30_000,
  maxStalledCount: 2,
};

const CONCURRENCY_MAP: Record<QueueDomain, number> = {
  email: Number(process.env.QUEUE_CONCURRENCY_EMAIL || 5),
  notification: Number(process.env.QUEUE_CONCURRENCY_NOTIFY || 10),
  ai: Number(process.env.QUEUE_CONCURRENCY_AI || 2),
  export: Number(process.env.QUEUE_CONCURRENCY_EXPORT || 3),
};

/**
 * Create a Worker for a given queue domain.
 *
 * Typically called from a dedicated worker entrypoint (e.g., src/lib/queue.worker.ts),
 * NOT from API routes — workers are long-lived and should run in a separate process.
 */
export function createWorker(
  domain: QueueDomain,
  processor: (job: { id: string; name: string; data: AnyJobData }) => Promise<unknown>,
  opts?: Partial<WorkerOptions>,
): Worker {
  const connection = getConnection();
  const name = QUEUE_NAMES[domain];
  const concurrency = CONCURRENCY_MAP[domain];

  const worker = new Worker(
    name,
    async (job) => {
      const start = Date.now();
      try {
        const result = await processor({
          id: job.id ?? "unknown",
          name: job.name,
          data: job.data as AnyJobData,
        });
        const duration = Date.now() - start;
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[worker:${domain}] job ${job.id} (${job.name}) completed in ${duration}ms`,
          );
        }
        return result;
      } catch (err) {
        const duration = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[worker:${domain}] job ${job.id} (${job.name}) failed after ${duration}ms: ${message}`,
        );
        throw err;
      }
    },
    {
      connection,
      concurrency,
      ...DEFAULT_WORKER_OPTIONS,
      ...opts,
    },
  );

  worker.on("error", (err: Error) => {
    console.error(`[worker:${domain}] error:`, err.message);
  });

  worker.on("failed", (job, err) => {
    if (job && process.env.NODE_ENV !== "production") {
      console.error(
        `[worker:${domain}] job ${job.id} (${job.name}) failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`,
      );
    }
  });

  worker.on("stalled", (jobId: string) => {
    console.warn(`[worker:${domain}] job ${jobId} stalled`);
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Queue Management Utilities
// ---------------------------------------------------------------------------

/**
 * Pause a queue — stops processing new jobs. Enqueuing still works.
 */
export async function pauseQueue(domain: QueueDomain): Promise<void> {
  const queue = getQueue(domain);
  await queue.pause();
}

/**
 * Resume a paused queue.
 */
export async function resumeQueue(domain: QueueDomain): Promise<void> {
  const queue = getQueue(domain);
  await queue.resume();
}

/**
 * Get queue statistics.
 */
export async function getQueueStats(domain: QueueDomain) {
  const queue = getQueue(domain);
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getPausedCount(),
  ]);

  return { waiting, active, completed, failed, delayed, paused };
}

/**
 * Get stats for all queues.
 */
export async function getAllQueueStats() {
  const domains: QueueDomain[] = ["email", "notification", "ai", "export"];
  const results = await Promise.all(
    domains.map(async (domain) => ({
      domain,
      ...(await getQueueStats(domain)),
    })),
  );

  return results;
}

/**
 * Remove all jobs from a queue (dangerous — use with caution).
 */
export async function drainQueue(domain: QueueDomain): Promise<void> {
  const queue = getQueue(domain);
  await queue.drain();
}

/**
 * Clean old completed/failed jobs.
 */
export async function cleanQueue(
  domain: QueueDomain,
  graceMs = 3600_000, // 1 hour
): Promise<void> {
  const queue = getQueue(domain);
  await Promise.all([
    queue.clean(graceMs, 500, "completed"),
    queue.clean(graceMs, 500, "failed"),
  ]);
}

/**
 * Get a specific job by ID.
 */
export async function getJob(domain: QueueDomain, jobId: string) {
  const queue = getQueue(domain);
  return queue.getJob(jobId);
}

/**
 * Remove a specific job.
 */
export async function removeJob(domain: QueueDomain, jobId: string): Promise<void> {
  const queue = getQueue(domain);
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
  }
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

/**
 * Gracefully close all queues and their underlying connections.
 * Call during server shutdown (SIGTERM / SIGINT handler).
 */
export async function closeAllQueues(): Promise<void> {
  const store = getQueueStore();
  const closings: Promise<void>[] = [];

  for (const [name, queue] of store.entries()) {
    closings.push(
      queue
        .close()
        .then(() => {
          if (process.env.NODE_ENV !== "production") {
            console.log(`[queue] closed: ${name}`);
          }
        })
        .catch((err: Error) => {
          console.error(`[queue] error closing ${name}:`, err.message);
        }),
    );
  }

  await Promise.all(closings);
  store.clear();

  // Also close any outstanding workers if tracked
  if (globalForQueues.__workers) {
    const workerClosings: Promise<void>[] = [];
    for (const [name, worker] of globalForQueues.__workers.entries()) {
      workerClosings.push(
        worker
          .close()
          .then(() => {
            if (process.env.NODE_ENV !== "production") {
              console.log(`[worker] closed: ${name}`);
            }
          })
          .catch((err: Error) => {
            console.error(`[worker] error closing ${name}:`, err.message);
          }),
      );
    }
    await Promise.all(workerClosings);
    globalForQueues.__workers.clear();
  }
}

// ---------------------------------------------------------------------------
// Worker Registry (for graceful shutdown tracking)
// ---------------------------------------------------------------------------

function getWorkerStore(): Map<string, Worker> {
  if (!globalForQueues.__workers) {
    globalForQueues.__workers = new Map();
  }
  return globalForQueues.__workers;
}

export function registerWorker(domain: QueueDomain, worker: Worker): void {
  getWorkerStore().set(QUEUE_NAMES[domain], worker);
}

export function unregisterWorker(domain: QueueDomain): void {
  getWorkerStore().delete(QUEUE_NAMES[domain]);
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Check if all queues are reachable by testing the shared Redis connection.
 */
export async function pingQueues(): Promise<boolean> {
  try {
    const connection = getConnection();
    const pong = await connection.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const queue = {
  // Domain accessors
  getQueue,
  getEmailQueue,
  getNotificationQueue,
  getAiQueue,
  getExportQueue,

  // Proxy instances (lazy)
  email: emailQueue,
  notification: notificationQueue,
  ai: aiQueue,
  export: exportQueue,

  // Typed enqueue helpers
  enqueueEmail,
  enqueueNotification,
  enqueueAi,
  enqueueExport,
  enqueueBulk,

  // Worker
  createWorker,
  registerWorker,
  unregisterWorker,

  // Management
  pause: pauseQueue,
  resume: resumeQueue,
  stats: getQueueStats,
  allStats: getAllQueueStats,
  drain: drainQueue,
  clean: cleanQueue,
  getJob,
  removeJob,

  // Lifecycle
  closeAll: closeAllQueues,
  ping: pingQueues,

  // Constants
  domains: QUEUE_NAMES,
  jobs: {
    email: EmailJobs,
    notification: NotificationJobs,
    ai: AiJobs,
    export: ExportJobs,
  },
} as const;

export default queue;