"use server";

import { getMarketPrice as getMarketPriceService, PriceResult } from "@/services/marketData";

export async function getMarketPriceAction(symbol: string, type: string, exchange?: string): Promise<PriceResult | null> {
    const result = await getMarketPriceService(symbol, type, exchange);
    return result || null;
}
