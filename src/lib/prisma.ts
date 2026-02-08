import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Prisma Client Singleton with Production-Ready Configuration
 * - Connection pooling optimized for serverless (Vercel)
 * - Query timeout protection
 * - Structured logging
 * - Graceful shutdown handling
 */

const globalForPrisma = globalThis as unknown as {
    prismaClientInstance: PrismaClient;
    isShuttingDown: boolean;
};

// Production-optimized log configuration
const getLogConfig = (): Prisma.LogLevel[] => {
    if (process.env.NODE_ENV === 'development') {
        return ['error', 'warn'];
    }
    // Production: Only critical errors
    return ['error'];
};

function createPrismaClient(): PrismaClient {
    const client = new PrismaClient({
        log: getLogConfig(),
        // Datasource configuration is handled via DATABASE_URL
        // Connection pooling is configured in the connection string:
        // ?connection_limit=10&pool_timeout=20
    });

    return client;
}

// Singleton pattern
export const prisma = globalForPrisma.prismaClientInstance ?? createPrismaClient();

// Development hot-reload protection
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaClientInstance = prisma;
}

/**
 * Graceful shutdown handler for serverless environments
 * Ensures connections are properly closed on process termination
 */
async function gracefulShutdown(): Promise<void> {
    if (globalForPrisma.isShuttingDown) return;
    globalForPrisma.isShuttingDown = true;

    try {
        await prisma.$disconnect();
    } catch (e) {
        console.error('[Prisma] Disconnect error:', e);
    }
}

// Register shutdown handlers (Node.js server environment only)
if (typeof process !== 'undefined' && process.on) {
    process.on('beforeExit', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
}

/**
 * Execute a database operation with timeout protection
 * Prevents hanging queries from blocking the application
 */
export async function withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number = 10000,
    operationName: string = 'database operation'
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`[Prisma] ${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    return Promise.race([operation, timeoutPromise]);
}

/**
 * Execute multiple operations in a transaction with automatic rollback on failure
 * Ensures atomic operations for data integrity
 */
export async function executeTransaction<T>(
    operations: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeout?: number; maxWait?: number }
): Promise<T> {
    return prisma.$transaction(operations, {
        timeout: options?.timeout ?? 15000,
        maxWait: options?.maxWait ?? 5000,
    });
}

/**
 * Health check for database connectivity
 * Useful for monitoring and load balancer health checks
 */
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { healthy: true, latencyMs: Date.now() - start };
    } catch {
        return { healthy: false, latencyMs: Date.now() - start };
    }
}
