import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClientInstance: PrismaClient };

// Force a new instance if the current one is stale (missing models)
// This key change forces Next.js HMR to pick up the new client
export const prisma = globalForPrisma.prismaClientInstance || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaClientInstance = prisma;
