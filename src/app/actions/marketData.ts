"use server";

import { getMarketPrice as getMarketPriceService, PriceResult } from "@/services/marketData";
import { getTefasFundInfo } from "@/services/tefasApi";
import { BESFundWithPrice } from "@/lib/besTypes";

export async function getMarketPriceAction(symbol: string, type: string, exchange?: string): Promise<PriceResult | null> {
    const result = await getMarketPriceService(symbol, type, exchange);
    return result || null;
}

/**
 * Fetch current prices for BES funds from TEFAS
 * @param fundCodes Array of fund codes (e.g., ['AH2', 'AH5', 'BGL', 'AET'])
 * @returns Map of fund code to price data
 */
export async function getBESFundPrices(fundCodes: string[]): Promise<Record<string, BESFundWithPrice>> {
    const results: Record<string, BESFundWithPrice> = {};

    // Fetch all fund prices in parallel
    const pricePromises = fundCodes.map(async (code) => {
        try {
            const tefasData = await getTefasFundInfo(code);
            if (tefasData && tefasData.price > 0) {
                return {
                    code,
                    data: {
                        code,
                        name: tefasData.title,
                        percentage: 0, // Will be filled by caller
                        currentPrice: tefasData.price,
                        priceDate: tefasData.lastUpdated,
                    } as BESFundWithPrice
                };
            }
            return { code, data: null };
        } catch (error) {
            console.error(`[BES] Failed to fetch price for ${code}:`, error);
            return { code, data: null };
        }
    });

    const priceResults = await Promise.all(pricePromises);

    for (const result of priceResults) {
        if (result.data) {
            results[result.code] = result.data;
        }
    }

    return results;
}
