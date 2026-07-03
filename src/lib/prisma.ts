/**
 * Prisma Client Singleton
 *
 * Global database client instance with connection management, query logging,
 * and audit middleware integration.
 *
 * Environment Variables:
 *   DATABASE_URL              — PostgreSQL connection string (required by Prisma)
 *   PRISMA_LOG_QUERIES        — log all queries to console (default: false)
 *   PRISMA_LOG_SLOW_MS        — log queries slower than this threshold (default: 1000)
 *   PRISMA_MAX_RETRIES        — max connection retries (default: 3)
 */

import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LOG_QUERIES = process.env.PRISMA_LOG_QUERIES === "true";
const LOG_SLOW_MS = Number(process.env.PRISMA_LOG_SLOW_MS || 1000);

// ---------------------------------------------------------------------------
// Global Singleton
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClient | undefined;
  __prismaInitialized: boolean;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: "warn", emit: "stdout" },
      { level: "error", emit: "stdout" },
      ...(LOG_QUERIES
        ? [{ level: "query" as const, emit: "stdout" as const }]
        : []),
    ],
  });

  // Slow query logging via $extends
  const extendedClient = client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = Date.now();
          const result = await query(args);
          const duration = Date.now() - start;

          if (duration >= LOG_SLOW_MS) {
            console.warn(
              `[prisma] slow query (${duration}ms): ${model}.${operation}`,
            );
          }

          return result;
        },
      },
    },
  });

  return extendedClient as unknown as PrismaClient;
}

/**
 * Returns the shared Prisma client instance.
 * Safe to call multiple times — always returns the same singleton.
 *
 * Lazy initialization: the client is created on the first call.
 * Call `initializePrisma()` explicitly if you need to guarantee
 * the client is ready before accepting requests.
 */
export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = createPrismaClient();
    globalForPrisma.__prismaInitialized = true;

    if (process.env.NODE_ENV !== "production") {
      console.log("[prisma] client initialized");
    }
  }
  return globalForPrisma.__prisma;
}

/**
 * Explicitly initialize the Prisma client (optional — getPrismaClient()
 * already does lazy initialization).
 */
export function initializePrisma(): PrismaClient {
  return getPrismaClient();
}

/**
 * Gracefully close the Prisma connection.
 * Call during server shutdown (SIGTERM / SIGINT handler).
 */
export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.__prisma) {
    await globalForPrisma.__prisma.$disconnect();
    globalForPrisma.__prisma = undefined;
    globalForPrisma.__prismaInitialized = false;

    if (process.env.NODE_ENV !== "production") {
      console.log("[prisma] disconnected");
    }
  }
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Check if the database is reachable.
 * Executes a lightweight query (SELECT 1).
 */
export async function pingPrisma(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$queryRawUnsafe(`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Transaction Helper
// ---------------------------------------------------------------------------

/**
 * Execute a callback within a Prisma transaction.
 *
 * @example
 *   await prismaTransaction(async (tx) => {
 *     const project = await tx.project.create({ data: { ... } });
 *     await tx.task.create({ data: { projectId: project.id, ... } });
 *   });
 */
export async function prismaTransaction<T>(
  fn: (tx: PrismaTransaction) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: "ReadUncommitted" | "ReadCommitted" | "RepeatableRead" | "Serializable";
  },
): Promise<T> {
  const client = getPrismaClient();
  return client.$transaction(fn, options) as Promise<T>;
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const prisma = {
  getClient: getPrismaClient,
  initialize: initializePrisma,
  disconnect: disconnectPrisma,
  ping: pingPrisma,
  transaction: prismaTransaction,
} as const;

export default prisma;