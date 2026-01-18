import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClientInstance_v4: PrismaClient };

// Force a new instance if the current one is stale (missing models)
export const prisma = globalForPrisma.prismaClientInstance_v4 || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaClientInstance_v4 = prisma;
