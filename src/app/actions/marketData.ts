"use server";

import { getMarketPrice as getMarketPriceService, PriceResult } from "@/services/marketData";

export async function getMarketPriceAction(symbol: string, type: string, exchange?: string): Promise<PriceResult | null> {
    return await getMarketPriceService(symbol, type, exchange);
}
