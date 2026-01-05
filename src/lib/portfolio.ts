import { getMarketPrice, convertCurrency, getAssetName } from "@/services/marketData";
import { prisma } from "@/lib/prisma";
import { cleanAssetName } from "@/lib/companyNames";

import { AssetDisplay } from "@/lib/types";

function estimateFallbackState(exchange?: string): string {
    if (!exchange) return 'CLOSED';

    // Always Open Assets
    if (['CRYPTO', 'FOREX', 'COMMODITY', 'CCC'].includes(exchange)) return 'REGULAR';

    const totalMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();

    // US Markets (NYSE, NASDAQ): ~14:30 - 21:00 UTC
    if (['NASDAQ', 'NYSE', 'US', 'NMS', 'NGM'].includes(exchange)) return (totalMinutes >= 870 && totalMinutes < 1260) ? 'REGULAR' : 'CLOSED';

    // European Markets (AMS, PAR, BRU, MIL, MAD, LSE): ~08:00 - 16:30 UTC
    if (['AMS', 'PAR', 'BRU', 'MIL', 'MC', 'LSE', 'AS', 'PA'].includes(exchange)) return (totalMinutes >= 480 && totalMinutes < 990) ? 'REGULAR' : 'CLOSED';

    // Istanbul (BIST) & TEFAS Funds: ~07:00 - 15:00 UTC (10:00 - 18:00 TRT)
    if (['IST', 'BIST', 'IS', 'TEFAS'].includes(exchange)) return (totalMinutes >= 420 && totalMinutes < 900) ? 'REGULAR' : 'CLOSED';

    return 'CLOSED';
}

// ... imports

export async function getPortfolioMetrics(assets: any[], customRates?: Record<string, number>, forceRefresh: boolean = false): Promise<{ totalValueEUR: number, assetsWithValues: AssetDisplay[] }> {
    // Process Assets: Fetch current prices and calculate values
    const assetsWithValues = await Promise.all(assets.map(async (asset) => {
        // ... (lines 10-58 remain same logic, just ensure indentation)
        // 0. Lazy Name Repair & Cleaning
        let assetName = asset.name;

        if (!assetName || assetName === asset.symbol) {
            try {
                const fetchedName = await getAssetName(asset.symbol, asset.type);
                if (fetchedName) {
                    assetName = fetchedName;
                    prisma.asset.update({
                        where: { id: asset.id },
                        data: { name: fetchedName }
                    }).catch(err => console.error(err));
                }
            } catch (e) { }
        } else {
            const cleanName = cleanAssetName(assetName);
            if (cleanName !== assetName) {
                assetName = cleanName;
                prisma.asset.update({
                    where: { id: asset.id },
                    data: { name: cleanName }
                }).catch(err => console.error(err));
            }
        }

        // 1. Get current market price
        const priceData = await getMarketPrice(asset.symbol, asset.type, asset.exchange, forceRefresh);
        const currentPrice = priceData ? priceData.price : asset.buyPrice;

        // 1b. Check & Fix Currency Mismatch
        let activeCurrency = asset.currency;
        if (priceData?.currency && priceData.currency !== asset.currency) {
            activeCurrency = priceData.currency;
            prisma.asset.update({
                where: { id: asset.id },
                data: { currency: activeCurrency }
            }).catch(err => console.error(err));
        }

        // 2. Calculate Total Value in Logic Currency (Asset Currency)
        const totalValueNative = currentPrice * asset.quantity;

        // 3. Convert to EUR
        const totalValueEUR = await convertCurrency(totalValueNative, activeCurrency, "EUR", customRates);

        // 4. Calculate P/L
        const costBasisNative = asset.buyPrice * asset.quantity;
        const plPercentage = costBasisNative !== 0
            ? ((totalValueNative - costBasisNative) / costBasisNative) * 100
            : 0;

        // 5. Calculate Daily Change (Real 1D P&L)
        const dailyChangeNative = (priceData?.change24h || 0) * asset.quantity;
        const dailyChangeEUR = await convertCurrency(dailyChangeNative, activeCurrency, "EUR", customRates);

        return {
            id: asset.id,
            symbol: asset.symbol,
            name: assetName, // Use resolved name
            type: asset.type,
            quantity: asset.quantity,
            buyPrice: asset.buyPrice,
            currency: activeCurrency, // Return corrected currency
            currentPrice,
            totalValueEUR,
            plPercentage,
            dailyChange: dailyChangeEUR,
            dailyChangePercentage: priceData?.changePercent || 0,
            exchange: asset.exchange || undefined,
            sector: asset.sector || undefined,
            country: asset.country || undefined,
            platform: asset.platform || undefined,
            customGroup: asset.customGroup || undefined,
            rank: asset.rank || 0, // Pass rank
            location: asset.location || undefined,
            ownerCode: asset.ownerCode || undefined,
            assetClass: asset.assetClass || undefined,
            assetSubClass: asset.assetSubClass || undefined,
            market: asset.market || undefined,
            marketState: priceData?.marketState || estimateFallbackState(asset.exchange),
        };
    }));

    const totalPortfolioValueEUR = assetsWithValues.reduce((sum: number, asset) => {
        // console.log(`[MetricDebug] ${asset.symbol}: ${asset.totalValueEUR} EUR (Cum: ${sum + asset.totalValueEUR})`);
        return sum + asset.totalValueEUR;
    }, 0);

    const sorted = assetsWithValues.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    console.log("[Portfolio] Server returning assets with ranks:", sorted.map(a => `${a.symbol}:${a.rank}`));
    return {
        totalValueEUR: totalPortfolioValueEUR,
        assetsWithValues: sorted
    };
}
