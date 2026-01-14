
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const symbol = 'VOO';

        // 1. Check current status
        const before = await prisma.priceCache.findUnique({ where: { symbol } });
        console.log('Before Fix:', JSON.stringify(before, null, 2));

        // 2. Fix it: Set source to null or delete the row to force fresh fetch
        // Deleting is safer as it clears any "bad" metadata too
        if (before) {
            console.log('Deleting corrupted cache entry...');
            await prisma.priceCache.delete({ where: { symbol } });
            console.log('Deleted.');
        } else {
            console.log('No cache entry found to delete.');
        }

        // 3. Verify it's gone
        const after = await prisma.priceCache.findUnique({ where: { symbol } });
        console.log('After Fix:', after);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
