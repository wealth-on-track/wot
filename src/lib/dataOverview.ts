import { prisma } from "@/lib/prisma";

export interface DataOverviewRow {
    userEmail: string;
    userId: string;
    symbol: string;
    assetName: string | null;
    quantity: number;
    buyPrice: number;
    assetCurrency: string;
    currentPrice: number | null;
    priceCurrency: string | null;
    priceSource: string | null;
    priceUpdatedAt: Date | null;
    dataStatus: 'fresh' | 'stale' | 'missing';
    ageMinutes: number | null;
    hasHistory: boolean;
    historyCount: number;
    latestHistoryDate: Date | null;
    lastApiCallStatus: string | null;
    lastApiCallTime: Date | null;
}

export interface SystemHealthStats {
    totalUsers: number;
    totalAssets: number;
    totalPrices: number;
    totalHistory: number;
    totalApiCalls: number;
    freshPrices: number;
    stalePrices: number;
    missingPrices: number;
    apiSuccessRate24h: number;
}

export function calculateFreshness(updatedAt: Date | null): 'fresh' | 'stale' | 'missing' {
    if (!updatedAt) return 'missing';
    const ageMinutes = (Date.now() - updatedAt.getTime()) / 60000;
    if (ageMinutes < 15) return 'fresh';
    if (ageMinutes < 60) return 'stale';
    return 'missing';
}

export function getAgeMinutes(updatedAt: Date | null): number | null {
    if (!updatedAt) return null;
    return Math.floor((Date.now() - updatedAt.getTime()) / 60000);
}

export async function getSystemHealthStats(): Promise<SystemHealthStats> {
    const [
        totalUsers,
        totalAssets,
        totalPrices,
        totalHistory,
        totalApiCalls,
        prices,
        apiCalls24h
    ] = await Promise.all([
        prisma.user.count(),
        prisma.asset.count(),
        prisma.priceCache.count(),
        prisma.assetPriceHistory.count(),
        prisma.apiRequestLog.count(),
        prisma.priceCache.findMany({ select: { updatedAt: true } }),
        prisma.apiRequestLog.findMany({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            },
            select: { status: true }
        })
    ]);

    // Calculate freshness
    let freshPrices = 0;
    let stalePrices = 0;
    let missingPrices = 0;

    prices.forEach(p => {
        const status = calculateFreshness(p.updatedAt);
        if (status === 'fresh') freshPrices++;
        else if (status === 'stale') stalePrices++;
        else missingPrices++;
    });

    // Calculate API success rate
    const successCalls = apiCalls24h.filter(c => c.status === 'SUCCESS').length;
    const apiSuccessRate24h = apiCalls24h.length > 0
        ? (successCalls / apiCalls24h.length) * 100
        : 0;

    return {
        totalUsers,
        totalAssets,
        totalPrices,
        totalHistory,
        totalApiCalls,
        freshPrices,
        stalePrices,
        missingPrices,
        apiSuccessRate24h
    };
}

export async function getDataOverview(): Promise<DataOverviewRow[]> {
    // Fetch all users with their portfolios and assets
    const users = await prisma.user.findMany({
        include: {
            Portfolio: {
                include: {
                    Asset: true
                }
            }
        }
    });

    // Get all unique symbols from assets
    const allSymbols = users.flatMap(u =>
        u.Portfolio?.Asset.map(a => a.symbol) || []
    );
    const uniqueSymbols = [...new Set(allSymbols)];

    // Fetch price cache for all symbols
    const priceCache = await prisma.priceCache.findMany({
        where: { symbol: { in: uniqueSymbols } }
    });
    const priceCacheMap = new Map(priceCache.map(p => [p.symbol, p]));

    // Fetch history stats for all symbols
    const historyStats = await prisma.assetPriceHistory.groupBy({
        by: ['symbol'],
        where: { symbol: { in: uniqueSymbols } },
        _count: { id: true },
        _max: { date: true }
    });
    const historyStatsMap = new Map(
        historyStats.map(h => [h.symbol, { count: h._count.id, latestDate: h._max.date }])
    );

    // Fetch latest API call for each symbol
    const apiCalls = await prisma.apiRequestLog.findMany({
        where: {
            params: { in: uniqueSymbols }
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['params']
    });
    const apiCallsMap = new Map(
        apiCalls.map(c => [c.params, { status: c.status, createdAt: c.createdAt }])
    );

    // Build the data overview rows
    const rows: DataOverviewRow[] = [];

    for (const user of users) {
        if (!user.Portfolio) continue;

        for (const asset of user.Portfolio.Asset) {
            const price = priceCacheMap.get(asset.symbol);
            const history = historyStatsMap.get(asset.symbol);
            const apiCall = apiCallsMap.get(asset.symbol);

            const priceUpdatedAt = price?.updatedAt || null;
            const dataStatus = calculateFreshness(priceUpdatedAt);
            const ageMinutes = getAgeMinutes(priceUpdatedAt);

            rows.push({
                userEmail: user.email,
                userId: user.id,
                symbol: asset.symbol,
                assetName: asset.name,
                quantity: asset.quantity,
                buyPrice: asset.buyPrice,
                assetCurrency: asset.currency,
                currentPrice: price?.previousClose || null,
                priceCurrency: price?.currency || null,
                priceSource: price?.source || null,
                priceUpdatedAt,
                dataStatus,
                ageMinutes,
                hasHistory: !!history,
                historyCount: history?.count || 0,
                latestHistoryDate: history?.latestDate || null,
                lastApiCallStatus: apiCall?.status || null,
                lastApiCallTime: apiCall?.createdAt || null
            });
        }
    }

    // Sort by freshness (fresh first, then stale, then missing)
    rows.sort((a, b) => {
        const statusOrder = { fresh: 0, stale: 1, missing: 2 };
        return statusOrder[a.dataStatus] - statusOrder[b.dataStatus];
    });

    return rows;
}
