import "dotenv/config";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('SEARCHING FOR dev1...');
    const user = await prisma.user.findUnique({
        where: { email: 'dev1@wot.money' },
        include: { Portfolio: true }
    });

    if (!user || !user.Portfolio) {
        console.error('User dev1 not found or has no portfolio');
        return;
    }

    const portfolioId = user.Portfolio.id;
    console.log(`Found portfolio: ${portfolioId}`);

    // Fetch all transactions
    const txs = await prisma.assetTransaction.findMany({
        where: { portfolioId }
    });

    console.log(`Found ${txs.length} transactions.`);

    // Aggregate by Symbol
    const positions: Record<string, {
        symbol: string;
        quantity: number;
        cost: number;
        currency: string;
        transactions: typeof txs;
    }> = {};

    for (const tx of txs) {
        if (!positions[tx.symbol]) {
            positions[tx.symbol] = {
                symbol: tx.symbol,
                quantity: 0,
                cost: 0,
                currency: tx.currency,
                transactions: []
            };
        }

        positions[tx.symbol].Transaction.push(tx);

        if (tx.type === 'BUY' || tx.type === 'DEPOSIT') { // Deposit usually Cash but handle generic
            positions[tx.symbol].quantity += tx.quantity;
            positions[tx.symbol].cost += (tx.quantity * tx.price);
        } else if (tx.type === 'SELL' || tx.type === 'WITHDRAWAL') {
            positions[tx.symbol].quantity -= tx.quantity;
            positions[tx.symbol].cost -= (tx.quantity * tx.price); // Simple avg logic simplification
        }
    }

    console.log('\nCalculated Positions:');
    for (const [symbol, pos] of Object.entries(positions)) {
        if (pos.quantity > 0.000001) {
            console.log(`- ${symbol}: ${pos.quantity} units (Creating Asset...)`);

            // Calculate avg price (naive: Total Cost / Qty)
            // Ideally we iterate buys accurately but this is a repair
            const avgPrice = pos.quantity > 0 ? Math.abs(pos.cost / pos.quantity) : 0;

            // Check if asset exists
            const existing = await prisma.asset.findFirst({
                where: { portfolioId, symbol }
            });

            if (!existing) {
                // Determine category
                let category: any = 'US_MARKETS';
                if (symbol.includes('EUR')) category = 'CRYPTO'; // Heuristic
                else if (symbol.includes('.')) category = 'EU_MARKETS';

                try {
                    await prisma.asset.create({
                        data: {
                            portfolioId,
                            symbol: pos.symbol,
                            name: pos.symbol, // Use symbol as name for now
                            quantity: pos.quantity,
                            buyPrice: Math.abs(avgPrice),
                            currency: pos.currency,
                            type: 'STOCK', // Default
                            category: category,
                            exchange: 'UNKNOWN',
                            country: 'UNKNOWN',
                            sector: 'UNKNOWN',
                            // We leave ISIN null to avoid unique constraint issues if any remaining
                        }
                    });
                    console.log(`  ✅ Created Asset ${symbol}`);
                } catch (err) {
                    console.error(`  ❌ Failed to create ${symbol}:`, err);
                }
            } else {
                console.log(`  ⚠️  Asset ${symbol} already exists. Skipping.`);
            }
        } else {
            console.log(`- ${symbol}: Closed (Qty ${pos.quantity})`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
