
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env depending on usage
// Load environment variables from .env depending on usage
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to database...');
    try {
        const users = await prisma.user.findMany({
            include: {
                portfolio: {
                    include: {
                        assets: true,
                        transactions: true
                    }
                }
            }
        });

        console.log(`Found ${users.length} users.`);

        for (const user of users) {
            console.log(`\n--- User: ${user.username} ---`);
            if (!user.portfolio) {
                console.log('No portfolio found.');
                continue;
            }

            const assets = user.portfolio.assets;
            const transactions = user.portfolio.transactions;

            console.log(`Assets: ${assets.length}`);
            console.log(`Transactions: ${transactions.length}`);

            console.log('\nChecking linkages:');

            for (const asset of assets) {
                console.log(`\nAsset: ${asset.symbol} (Name: "${asset.name}", Orig: "${asset.originalName}")`);

                // Replicate logic from getOpenPositions
                const matches = transactions.filter(t => {
                    const matchSymbol = t.symbol === asset.symbol;
                    const matchOrig = asset.originalName && (t.symbol === asset.originalName || t.name === asset.originalName);
                    const matchName = t.name === asset.name;

                    if (matchSymbol) return true;
                    if (matchOrig) return true;
                    if (matchName) return true;
                    return false;
                });

                console.log(`  -> Matched Transactions: ${matches.length}`);
                if (matches.length === 0) {
                    console.log(`  !! NO MATCHES FOUND !!`);
                    // Try to find potential candidates
                    const candidates = transactions.filter(t =>
                        t.symbol.includes(asset.symbol) ||
                        asset.symbol.includes(t.symbol) ||
                        (t.name && asset.name && (t.name.includes(asset.name) || asset.name.includes(t.name)))
                    );
                    if (candidates.length > 0) {
                        console.log(`  Potential Candidates (Partial Match):`);
                        candidates.forEach(c => console.log(`    - [${c.type}] Symbol: ${c.symbol}, Name: ${c.name}, Date: ${c.date}`));
                    } else {
                        // Print first 5 transactions just to see what they look like
                        if (transactions.length > 0) {
                            console.log(`  First 3 unmatched transactions for reference:`);
                            transactions.slice(0, 3).forEach(c => console.log(`    - [${c.type}] Symbol: ${c.symbol}, Name: ${c.name}`));
                        }
                    }
                } else {
                    // Show why it matched
                    matches.slice(0, 1).forEach(t => {
                        let reason = [];
                        if (t.symbol === asset.symbol) reason.push('Symbol');
                        if (asset.originalName && (t.symbol === asset.originalName || t.name === asset.originalName)) reason.push('OriginalName');
                        if (t.name === asset.name) reason.push('Name');
                        console.log(`  -> Match Reason: ${reason.join(', ')}`);
                    });
                }
            }
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
