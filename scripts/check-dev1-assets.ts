import "dotenv/config";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'dev1@wot.money';

    const user = await prisma.user.findUnique({
        where: { email },
        include: { Portfolio: { include: { assets: true, transactions: true } } }
    });

    if (!user || !user.Portfolio) {
        console.log("User or portfolio not found.");
        return;
    }

    console.log(`User: ${user.username} (${user.email})`);
    console.log(`Portfolio ID: ${user.Portfolio.id}`);

    console.log("\n--- ASSETS ---");
    if (user.Portfolio.Asset.length === 0) {
        console.log("No assets found.");
    } else {
        user.Portfolio.Asset.forEach(a => {
            console.log(`[${a.symbol}] Qty: ${a.quantity} | isin: ${a.isin} | Type: ${a.type} | Cat: ${a.category}`);
        });
    }

    console.log("\n--- TRANSACTIONS (Last 10) ---");
    const txs = await prisma.assetTransaction.findMany({
        where: { portfolioId: user.Portfolio.id },
        orderBy: { date: 'desc' },
        take: 10
    });

    txs.forEach(t => {
        console.log(`[${t.date.toISOString().split('T')[0]}] ${t.type} ${t.symbol} qty:${t.quantity} price:${t.price}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
