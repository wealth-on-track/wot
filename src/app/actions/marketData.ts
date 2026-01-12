"use server";

import { getMarketPrice as getMarketPriceService, PriceResult } from "@/services/marketData";
import { getYahooAssetProfile } from "@/services/yahooApi";

export async function getMarketPriceAction(symbol: string, type: string, exchange?: string): Promise<PriceResult | null> {
    const result = await getMarketPriceService(symbol, type, exchange);
    return result || null;
}
