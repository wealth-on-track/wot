"use server";

import { getMarketPrice as getMarketPriceService, PriceResult } from "@/services/marketData";
import { getYahooAssetProfile } from "@/services/yahooApi";

export async function getMarketPriceAction(symbol: string, type: string, exchange?: string): Promise<PriceResult | null> {
    const [priceData, profileData] = await Promise.all([
        getMarketPriceService(symbol, type, exchange),
        (type === 'STOCK' || type === 'ETF' || type === 'FUND') ? getYahooAssetProfile(symbol) : null
    ]);

    if (!priceData) return null;

    return {
        ...priceData,
        ...profileData
    };
}
