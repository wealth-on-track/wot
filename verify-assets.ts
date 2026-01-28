
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Check Assets
    console.log("\n=== ASSETS ===");
    const assets = await prisma.asset.findMany({
        select: {
            symbol: true,
            name: true,
            quantity: true,
            type: true,
            platform: true,
            currency: true,
            customGroup: true,
            portfolioId: true
        },
        orderBy: {
            symbol: 'asc'
        }
    });

    if (assets.length === 0) {
        console.log("No assets found in the database.");
    } else {
        console.table(assets);
        console.log(`Total Assets: ${assets.length}`);
    }

    // 2. Check AssetAlias table
    console.log("\n=== ASSET ALIASES (Caching) ===");
    try {
        const aliases = await (prisma as any).assetAlias.findMany({
            orderBy: { sourceString: 'asc' }
        });

        if (aliases.length === 0) {
            console.log("❌ NO ALIASES FOUND - This is why Yahoo API is called every time!");
            console.log("   Aliases should be saved after first successful import.");
        } else {
            console.log(`✓ Found ${aliases.length} aliases:`);
            aliases.forEach((a: any) => {
                console.log(`   '${a.sourceString}' -> '${a.resolvedSymbol}' (platform: ${a.platform || 'none'}, verified: ${a.isVerified})`);
            });
        }
    } catch (error: any) {
        console.log("❌ ERROR accessing AssetAlias table:", error.message);
        console.log("   Run: npx prisma db push");
    }

    // 3. Check Users
    console.log("\n=== USERS ===");
    const users = await prisma.user.findMany({
        select: { id: true, username: true, email: true }
    });
    console.table(users);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
