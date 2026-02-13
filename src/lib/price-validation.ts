/**
 * Price Validation & Previous Close Calculation
 *
 * This module provides centralized, validated price calculations to prevent
 * incorrect 1D change percentages caused by using wrong reference prices.
 *
 * CRITICAL: chartPreviousClose from Yahoo API is NOT the actual previous day's close!
 * It's the first price in the chart range, which could be days or weeks old.
 */

export interface ChartData {
    meta: {
        regularMarketPrice?: number;
        previousClose?: number;        // Often undefined
        chartPreviousClose?: number;   // DO NOT USE for 1D change - this is chart range start
        regularMarketTime?: number;
        currency?: string;
        symbol?: string;
    };
    indicators?: {
        quote?: Array<{
            close?: (number | null)[];
            open?: (number | null)[];
            high?: (number | null)[];
            low?: (number | null)[];
            volume?: (number | null)[];
        }>;
    };
    timestamp?: number[];
}

export interface ValidatedPriceResult {
    currentPrice: number;
    previousClose: number;
    changeAmount: number;
    changePercent: number;
    isValidated: boolean;
    validationWarnings: string[];
}

// Maximum reasonable 1D change percentage (beyond this, something is likely wrong)
const MAX_REASONABLE_1D_CHANGE = 25; // 25% - even volatile stocks rarely move more than this in a day

/**
 * Extract the ACTUAL previous day's close from Yahoo chart data.
 *
 * Priority:
 * 1. meta.previousClose (if defined and reasonable)
 * 2. Second-to-last valid close from chart data
 * 3. chartPreviousClose (LAST RESORT - often wrong for 1D)
 *
 * @param chartResult - The result object from Yahoo chart API
 * @returns The actual previous close price, or null if unavailable
 */
export function extractActualPreviousClose(chartResult: ChartData): number | null {
    const meta = chartResult?.meta;
    const closes = chartResult?.indicators?.quote?.[0]?.close;
    const currentPrice = meta?.regularMarketPrice;

    if (!meta || !currentPrice) return null;

    // Strategy 1: Use meta.previousClose if available
    if (meta.previousClose && meta.previousClose > 0) {
        const change = Math.abs((currentPrice - meta.previousClose) / meta.previousClose * 100);
        // Sanity check: if change is reasonable, use it
        if (change <= MAX_REASONABLE_1D_CHANGE) {
            return meta.previousClose;
        }
        console.warn(`[PriceValidation] meta.previousClose (${meta.previousClose}) gives ${change.toFixed(1)}% change - suspicious, trying alternatives`);
    }

    // Strategy 2: Calculate from chart closes (most reliable)
    if (closes && closes.length >= 2) {
        const validCloses = closes.filter((c): c is number => c !== null && c !== undefined && c > 0);

        if (validCloses.length >= 2) {
            // Second-to-last close is yesterday's close
            const calculatedPrevClose = validCloses[validCloses.length - 2];
            const change = Math.abs((currentPrice - calculatedPrevClose) / calculatedPrevClose * 100);

            if (change <= MAX_REASONABLE_1D_CHANGE) {
                return calculatedPrevClose;
            }
            console.warn(`[PriceValidation] Calculated prevClose (${calculatedPrevClose}) gives ${change.toFixed(1)}% change - suspicious`);
        }
    }

    // Strategy 3: LAST RESORT - use chartPreviousClose with warning
    if (meta.chartPreviousClose && meta.chartPreviousClose > 0) {
        const change = Math.abs((currentPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100);
        console.warn(`[PriceValidation] Using chartPreviousClose as last resort (${meta.chartPreviousClose}) - ${change.toFixed(1)}% change`);
        return meta.chartPreviousClose;
    }

    return null;
}

/**
 * Validate and calculate price change with sanity checks.
 * Returns validated results with warnings if values seem suspicious.
 */
export function validatePriceChange(
    currentPrice: number,
    previousClose: number,
    symbol?: string
): ValidatedPriceResult {
    const warnings: string[] = [];
    let isValidated = true;

    // Basic validation
    if (!currentPrice || currentPrice <= 0) {
        warnings.push('Invalid current price');
        isValidated = false;
    }

    if (!previousClose || previousClose <= 0) {
        warnings.push('Invalid previous close');
        isValidated = false;
    }

    const changeAmount = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (changeAmount / previousClose) * 100 : 0;

    // Sanity checks
    if (Math.abs(changePercent) > MAX_REASONABLE_1D_CHANGE) {
        warnings.push(`1D change of ${changePercent.toFixed(2)}% exceeds ${MAX_REASONABLE_1D_CHANGE}% threshold - verify data accuracy`);
        console.warn(`[PriceValidation] ${symbol || 'Unknown'}: Suspicious 1D change ${changePercent.toFixed(2)}%`);
    }

    // Check for identical prices (stale data)
    if (currentPrice === previousClose && currentPrice > 0) {
        warnings.push('Current price equals previous close - data may be stale');
    }

    return {
        currentPrice,
        previousClose,
        changeAmount,
        changePercent,
        isValidated: isValidated && warnings.length === 0,
        validationWarnings: warnings
    };
}

/**
 * Get validated price data from Yahoo chart response.
 * This is the PRIMARY function to use for extracting price data.
 */
export function getValidatedPriceFromChart(
    chartResult: ChartData,
    symbol?: string
): ValidatedPriceResult | null {
    const meta = chartResult?.meta;
    if (!meta?.regularMarketPrice) return null;

    const currentPrice = meta.regularMarketPrice;
    const previousClose = extractActualPreviousClose(chartResult);

    if (!previousClose) {
        return {
            currentPrice,
            previousClose: currentPrice, // Fallback to current (0% change)
            changeAmount: 0,
            changePercent: 0,
            isValidated: false,
            validationWarnings: ['Could not determine previous close - defaulting to 0% change']
        };
    }

    return validatePriceChange(currentPrice, previousClose, symbol);
}
