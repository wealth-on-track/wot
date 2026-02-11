/**
 * Fix missing database columns before build
 * This ensures the schema matches what Prisma expects
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('[DB Fix] Checking for missing columns...');

    try {
        // Check if actualPreviousClose column exists in PriceCache
        const result = await prisma.$queryRaw<any[]>`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'PriceCache' AND column_name = 'actualPreviousClose'
        `;

        if (result.length === 0) {
            console.log('[DB Fix] Adding actualPreviousClose column to PriceCache...');
            await prisma.$executeRaw`
                ALTER TABLE "PriceCache" ADD COLUMN "actualPreviousClose" DOUBLE PRECISION
            `;
            console.log('[DB Fix] Column added successfully!');
        } else {
            console.log('[DB Fix] actualPreviousClose column already exists');
        }
    } catch (error) {
        console.error('[DB Fix] Error:', error);
        // Don't fail the build, just log the error
    } finally {
        await prisma.$disconnect();
    }
}

main();
