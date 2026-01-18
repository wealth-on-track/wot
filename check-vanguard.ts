
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const transactions = await prisma.assetTransaction.findMany({
        where: {
            OR: [
                { symbol: { contains: 'Vanguard', mode: 'insensitive' } },
                { name: { contains: 'Vanguard', mode: 'insensitive' } },
                { name: { contains: 'FTSE', mode: 'insensitive' } },
            ],
        },
        orderBy: {
            date: 'asc',
        },
    });

    console.log('Found transactions:', transactions.length);

    // Group by symbol to calculate net quantity
    const positions: Record<string, { bought: number, sold: number, net: number, txs: any[] }> = {};

    transactions.forEach(tx => {
        const key = tx.symbol;
        if (!positions[key]) {
            positions[key] = { bought: 0, sold: 0, net: 0, txs: [] };
        }

        positions[key].txs.push({
            date: tx.date.toISOString().split('T')[0],
            type: tx.type,
            qty: tx.quantity,
            price: tx.price
        });

        if (tx.type === 'BUY') {
            positions[key].bought += tx.quantity;
            positions[key].net += tx.quantity;
        } else if (tx.type === 'SELL') {
            positions[key].sold += tx.quantity;
            positions[key].net -= tx.quantity;
        }
    });

    Object.entries(positions).forEach(([symbol, data]) => {
        console.log(`\n--- Position: ${symbol} ---`);
        console.log(`Total Bought: ${data.bought}`);
        console.log(`Total Sold:   ${data.sold}`);
        console.log(`Net Quantity: ${data.net.toFixed(4)}`); // Net 0 ise kapanmıştır.
        console.log('Transactions:');
        data.txs.forEach(tx => console.log(`  ${tx.date}  ${tx.type}  ${tx.qty} @ ${tx.price}`));
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
