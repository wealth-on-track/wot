
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BENCHMARKS = [
    { id: 'SPX', symbol: '^GSPC' },
    { id: 'IXIC', symbol: '^IXIC' },
    { id: 'BIST100', symbol: 'XU100.IS' },
    { id: 'GOLD', symbol: 'GC=F' },
    { id: 'BTC', symbol: 'BTC-USD' },
];

async function fetchHistory(symbol: string) {
    const end = Math.floor(Date.now() / 1000);
    const start = end - (1825 * 24 * 60 * 60); // 5 years ago
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${start}&period2=${end}`;

    console.log(`Fetching ${symbol}...`);
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) {
        console.error(`Failed to fetch ${symbol}: ${res.statusText}`);
        return [];
    }

    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;

    return timestamps.map((t: number, i: number) => ({
        timestamp: t,
        price: closes[i]
    })).filter((x: any) => x.price != null);
}

async function main() {
    console.log('Seeding Benchmark Data...');

    for (const b of BENCHMARKS) {
        const data = await fetchHistory(b.symbol);
        console.log(`Saved ${data.length} points for ${b.id}`);

        if (data.length === 0) continue;

        // Clear existing
        await prisma.benchmarkPrice.deleteMany({ where: { symbol: b.symbol } });

        // Batch insert
        await prisma.benchmarkPrice.createMany({
            data: data.map((d: any) => ({
                symbol: b.symbol,
                date: new Date(d.timestamp * 1000),
                price: d.price
            })),
            skipDuplicates: true
        });
    }

    console.log('Done!');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
