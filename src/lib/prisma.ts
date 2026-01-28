import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClientInstance: PrismaClient };

// Create Prisma client with optimized settings
function createPrismaClient() {
    return new PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['error', 'warn']
            : ['error'],
    });
}

// Singleton pattern for Prisma client
export const prisma = globalForPrisma.prismaClientInstance ?? createPrismaClient();

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaClientInstance = prisma;
}
