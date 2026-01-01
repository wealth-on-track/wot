import { getMarketPrice, convertCurrency, getAssetName } from "@/services/marketData";
import { prisma } from "@/lib/prisma";
import { cleanAssetName } from "@/lib/companyNames";

import { AssetDisplay } from "@/lib/types";

export async function getPortfolioMetrics(assets: any[]): Promise<{ totalValueEUR: number, assetsWithValues: AssetDisplay[] }> {
    // Process Assets: Fetch current prices and calculate values
    const assetsWithValues = await Promise.all(assets.map(async (asset) => {
        // 0. Lazy Name Repair & Cleaning
        // Strategies:
        // A. Name is missing/legacy -> Fetch
        // B. Name exists but has suffixes -> Clean & Update
        let assetName = asset.name;

        if (!assetName || assetName === asset.symbol) {
            try {
                const fetchedName = await getAssetName(asset.symbol, asset.type);
                if (fetchedName) {
                    assetName = fetchedName; // getAssetName already cleans
                    // Update DB
                    prisma.asset.update({
                        where: { id: asset.id },
                        data: { name: fetchedName }
                    }).catch(err => console.error("Lazy name fetch update failed", err));
                }
            } catch (e) { }
        } else {
            // Name exists, but ensure it's clean
            const cleanName = cleanAssetName(assetName);
            if (cleanName !== assetName) {
                // It was dirty (e.g. "Commerzbank AG"), now clean ("Commerzbank")
                assetName = cleanName;
                // Update DB with clean version
                prisma.asset.update({
                    where: { id: asset.id },
                    data: { name: cleanName }
                }).catch(err => console.error("Lazy name clean update failed", err));
            }
        }

        // 1. Get current market price
        const priceData = await getMarketPrice(asset.symbol, asset.type);
        const currentPrice = priceData ? priceData.price : asset.buyPrice;

        // 1b. Check & Fix Currency Mismatch (e.g. BTC-EUR is EUR, but DB says USD)
        let activeCurrency = asset.currency;
        if (priceData?.currency && priceData.currency !== asset.currency) {
            console.log(`[Portfolio] Currency corrected for ${asset.symbol}: ${asset.currency} -> ${priceData.currency}`);
            activeCurrency = priceData.currency;

            // Auto-correct DB
            prisma.asset.update({
                where: { id: asset.id },
                data: { currency: activeCurrency }
            }).catch(err => console.error("Lazy currency update failed", err));
        }

        // 2. Calculate Total Value in Logic Currency (Asset Currency)
        const totalValueNative = currentPrice * asset.quantity;

        // 3. Convert to EUR
        const totalValueEUR = await convertCurrency(totalValueNative, activeCurrency, "EUR");

        // 4. Calculate P/L
        const costBasisNative = asset.buyPrice * asset.quantity;
        // P/L % (Native)
        const plPercentage = costBasisNative !== 0
            ? ((totalValueNative - costBasisNative) / costBasisNative) * 100
            : 0;

        // 5. Calculate Daily Change (Real 1D P&L)
        const dailyChangeNative = (priceData?.change24h || 0) * asset.quantity;
        const dailyChangeEUR = await convertCurrency(dailyChangeNative, activeCurrency, "EUR");

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
            customGroup: asset.customGroup || undefined
        };
    }));

    const totalPortfolioValueEUR = assetsWithValues.reduce((sum: number, asset) => sum + asset.totalValueEUR, 0);

    return {
        totalValueEUR: totalPortfolioValueEUR,
        assetsWithValues
    };
}
