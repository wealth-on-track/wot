import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClientInstance_v3: PrismaClient };

// Force a new instance if the current one is stale (missing models)
export const prisma = globalForPrisma.prismaClientInstance_v3 || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaClientInstance_v3 = prisma;
