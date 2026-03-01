import { prisma } from "@/lib/prisma";
import { detectCurrency } from "./yahooApi";
import { trackApiRequest } from "./telemetry";

// How far back to ensure history? 
// We want 1Y change, so 365 days + buffer. Let's say 400 days.
const HISTORY_DAYS_NEEDED = 400;

// Helper to fetch raw chart data
async function fetchChartRaw(symbol: string): Promise<{ date: string, price: number }[]> {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2y`;
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) return [];

    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result?.timestamp || !result?.indicators?.quote?.[0]) return [];

    const timestamps = result.timestamp as number[];
    const closes = result.indicators.quote[0].close as (number | null)[];

    const out = [];
    for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] !== null && closes[i] !== undefined) {
            // Use Only Date Part string as key for alignment
            const d = new Date(timestamps[i] * 1000);
            const key = d.toISOString().split('T')[0];
            out.push({ date: key, price: closes[i] as number });
        }
    }
    return out;
}

// Synthetic History Logic
async function fetchSyntheticHistory(symbol: string): Promise<boolean> {
    const isGold = symbol === 'GAUTRY';
    const component1 = isGold ? 'GC=F' : 'SI=F'; // Commodity
    const component2 = 'USDTRY=X'; // Parity

    try {
        const [dataComm, dataParity] = await Promise.all([
            fetchChartRaw(component1),
            fetchChartRaw(component2)
        ]);

        if (dataComm.length === 0 || dataParity.length === 0) return false;

        // Map Parity by Date
        const parityMap = new Map<string, number>();
        dataParity.forEach(d => parityMap.set(d.date, d.price));

        const records = [];
        // Iterate Commodity dates (US Market days are fewer than Forex, so drive by Commodity)
        for (const item of dataComm) {
            const dateKey = item.date;
            const parityPrice = parityMap.get(dateKey); // Find matching date

            if (parityPrice) {
                // Calc: (Ounce * USDTRY) / 31.1035
                const ouncePriceTry = item.price * parityPrice;
                const gramPriceTry = ouncePriceTry / 31.1034768;

                records.push({
                    symbol,
                    price: gramPriceTry,
                    currency: 'TRY',
                    date: new Date(dateKey) // UTC midnight
                });
            }
        }

        if (records.length === 0) return false;

        console.log(`[History] Computed ${records.length} synthetic points for ${symbol}`);

        await prisma.assetPriceHistory.createMany({
            data: records,
            skipDuplicates: true
        });

        await trackApiRequest('YAHOO_HISTORY', true, { endpoint: 'synthetic_merge', params: symbol });
        return true;

    } catch (e) {
        console.error(`[History] Synthetic error ${symbol}:`, e);
        await trackApiRequest('YAHOO_HISTORY', false, { endpoint: 'synthetic_merge', params: symbol, error: String(e) });
        return false;
    }
}

// Specialized function for FX pairs to ensure COMPLETE historical coverage
// Unlike ensureAssetHistory which only checks freshness of latest point,
// this verifies we have data for the ENTIRE required range (e.g., 1 year back)
export async function ensureFXHistoryRange(symbol: string, daysBack: number = 400): Promise<boolean> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysBack);

    // Check if we have data going back far enough
    const oldestRecord = await prisma.assetPriceHistory.findFirst({
        where: { symbol },
        orderBy: { date: 'asc' },
        select: { date: true }
    });

    const latestRecord = await prisma.assetPriceHistory.findFirst({
        where: { symbol },
        orderBy: { date: 'desc' },
        select: { date: true }
    });

    // If we don't have data, or oldest data isn't old enough, or latest is stale, fetch
    const needsFetch = !oldestRecord ||
        !latestRecord ||
        oldestRecord.date > targetDate ||
        (Date.now() - latestRecord.date.getTime()) > (3 * 24 * 60 * 60 * 1000);

    if (!needsFetch) {
        console.log(`[History] FX pair ${symbol} has complete coverage`);
        return true;
    }

    console.log(`[History] Fetching complete FX history for ${symbol} (${daysBack} days back)`);

    // Force a fresh fetch by calling standard ensureAssetHistory
    // But first, we could delete stale data to force a clean fetch? Or just fetch and let skipDuplicates handle it
    return ensureAssetHistory(symbol);
}

export async function ensureAssetHistory(symbol: string, exchange?: string): Promise<boolean> {
    if (!symbol) return false;

    // TEFAS Logic
    if (exchange?.toUpperCase() === 'TEFAS') {
        // Check freshness
        const latest = await prisma.assetPriceHistory.findFirst({
            where: { symbol },
            orderBy: { date: 'desc' },
            select: { date: true }
        });

        const isFresh = latest && (Date.now() - latest.date.getTime()) < (3 * 24 * 60 * 60 * 1000); // 3 days buffer
        if (isFresh) return true;

        console.log(`[History] Backfilling TEFAS history for ${symbol}...`);

        // Dynamic import to avoid circular deps if any, though explicit import is fine usually
        const { getTefasHistory } = await import('./tefasApi');

        // Fetch 2 years to match Yahoo behavior
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const history = await getTefasHistory(symbol, twoYearsAgo);

        if (history.length === 0) return false;

        const records = history.map(h => ({
            symbol,
            price: h.price,
            currency: 'TRY', // TEFAS is always TRY
            date: h.date
        }));

        await prisma.assetPriceHistory.createMany({
            data: records,
            skipDuplicates: true
        });

        return true;
    }

    // Handle Synthetic Assets
    if (symbol === 'GAUTRY' || symbol === 'XAGTRY') {
        return fetchSyntheticHistory(symbol);
    }

    // 1. Check coverage (Optimized)
    // We just check the LATEST entry. If the latest entry is old (> 3 days), we treat it as "stale" and fetch new data.
    // We assume if we have the latest, we have the history (or we backfilled it initially).
    const latest = await prisma.assetPriceHistory.findFirst({
        where: { symbol },
        orderBy: { date: 'desc' },
        select: { date: true }
    });

    const isFresh = latest && (Date.now() - latest.date.getTime()) < (24 * 60 * 60 * 1000); // 1 day buffer for fresher 1D data

    if (isFresh) {
        return true; // Data is up to date
    }


    // 2. Fetch from Yahoo Chart API
    console.log(`[History] Backfilling price history for ${symbol}...`);
    try {
        // Range: '2y' to cover 1Y change + YTD comfortably
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2y`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': '*/*'
            },
            next: { revalidate: 3600 } // Cache fetch for 1 hour to avoid spamming if called rapidly
        });

        if (!response.ok) {
            console.warn(`[History] Failed to fetch chart for ${symbol}: ${response.status}`);
            await trackApiRequest('YAHOO_HISTORY', false, { endpoint: 'history_chart', params: symbol, error: `Status ${response.status}` });
            return false;
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
            console.warn(`[History] Invalid chart format for ${symbol}`);
            return false;
        }

        const timestamps = result.timestamp as number[];
        const closes = result.indicators.quote[0].close as (number | null)[];
        const meta = result.meta;
        const currency = meta?.currency || detectCurrency(symbol) || 'USD';

        // Prepare records
        const records = [];
        for (let i = 0; i < timestamps.length; i++) {
            const price = closes[i];
            const ts = timestamps[i];

            if (price !== null && price !== undefined && ts) {
                // Normalize date to midnight UTC or just store full date
                // Prisma DateTime is usually UTC. 
                const date = new Date(ts * 1000);

                records.push({
                    symbol,
                    price,
                    currency,
                    date
                });
            }
        }

        if (records.length === 0) return false;

        console.log(`[History] Saving ${records.length} points for ${symbol}`);

        // Bulk Upsert using createMany with skipDuplicates (Best for Postgres)
        // Note: skipDuplicates ignores errors on unique constraints.
        await prisma.assetPriceHistory.createMany({
            data: records,
            skipDuplicates: true
        });

        await trackApiRequest('YAHOO_HISTORY', true, { endpoint: 'history_chart', params: symbol });
        return true;

    } catch (e) {
        console.error(`[History] Error backfilling ${symbol}:`, e);
        await trackApiRequest('YAHOO_HISTORY', false, { endpoint: 'history_chart', params: symbol, error: String(e) });
        return false;
    }
}

interface HistoricalPerformance {
    changePercent1D: number;
    changePercent1W: number;
    changePercent1M: number;
    changePercentYTD: number;
    changePercent1Y: number;
}

// Consolidated Exchange Rate Type (passed from client/server context)
interface ExchangeRates {
    [currency: string]: number; // Rate relative to EUR (or Base)
}

export async function getAssetPerformance(
    symbol: string,
    currentPrice: number,
    assetCurrency: string,
    exchangeRates?: ExchangeRates, // e.g. { EUR: 1, USD: 1.05, TRY: 38.5 }
    targetCurrency: string = 'EUR',
    previousClose?: number // Optional: Yahoo's previousClose for accurate 1D calculation
): Promise<HistoricalPerformance> {

    // Helper: Convert Amount to Target
    // Rule: We assume rates are "How much quote currency for 1 Base (EUR)"? 
    // No, standard in this app seems to be rates relative to EUR.
    // Let's stick to standard conversion: AmountInEUR = AmountOrig / RateOrig * RateTarget (if Rate = X per EUR)
    // Actually simplicity: We need historical rates for true accuracy, but that's overkill/expensive.
    // "Relative Return" in diverse currencies is tricky. 
    // Pure % return in local currency is usually valid, UNLESS inflation is huge (like TRY).
    // User wants return IN EUR.
    // So: (CurrentPrice_EUR - OldPrice_EUR) / OldPrice_EUR.
    // CurrentPrice_EUR = CurrentPrice_Local / Rate_Local_Now.
    // OldPrice_EUR = OldPrice_Local / Rate_Local_Then. (CRITICAL: We need historical rates).

    // As a simplification for "Top Performers" widget without fetching 4 years of FX history:
    // We can approximate by converting both prices using CURRENT rates? 
    // NO, that just equals local return. 
    // If I convert both top and bottom of division by constant K, results cancels out.
    // The user's problem is that TLY rose 4000% in TRY, but in EUR maybe only 50%.
    // So we MUST use historical FX rates to "deflate" the nominal return.

    // fetching historical FX is hard.
    // Strategy: 
    // 1. Fetch `EURTRY=X` history together with asset history?
    // 2. Or, for non-base assets, just fetch the "Converted" chart directly if possible? Yahoo usually supports `symbol` but not auto-convert.

    // Let's implement robust "Historical FX Adjustment".
    // If assetCurrency != targetCurrency, we need history of pair `targetCurrency + assetCurrency + '=X'` (e.g. EURTRY=X).
    // Note: Yahoo format is BaseQuote=X. Price is how many Quote for 1 Base.
    // e.g. EURTRY=X is ~38.5. 1 EUR = 38.5 TRY.

    // We will handle strictly EUR as target for now as requested (Navbar defaults).
    // But architecture should allow dynamic.

    const isDifferent = assetCurrency !== targetCurrency;

    // If same currency, calculation is trivial
    // Get comparison dates
    const now = new Date();

    // CRITICAL FIX: Set time to end of day (23:59:59.999) for proper date comparison
    // This ensures we find prices from that CALENDAR day, not exact timestamp
    // Example: If now is Feb 14 21:33, we want prices from Feb 13 (any time)
    // So we set oneDayAgo to Feb 13 23:59:59.999 to include all Feb 13 prices
    // Without this fix, a price from Feb 13 22:56 would be missed if current time is 21:33
    const endOfDay = (date: Date): Date => {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
    };

    const oneDayAgo = endOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const oneWeekAgo = endOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const oneMonthAgo = new Date(now); oneMonthAgo.setMonth(now.getMonth() - 1);
    const oneYearAgo = new Date(now); oneYearAgo.setFullYear(now.getFullYear() - 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Apply end of day to month/year/YTD dates too
    const oneMonthAgoEOD = endOfDay(oneMonthAgo);
    const oneYearAgoEOD = endOfDay(oneYearAgo);
    const startOfYearEOD = endOfDay(startOfYear);

    // Helper to find price closest to date
    const findPriceAt = async (targetDate: Date): Promise<number | null> => {
        // Find first record ON or BEFORE targetDate
        const record = await prisma.assetPriceHistory.findFirst({
            where: {
                symbol,
                date: { lte: targetDate }
            },
            orderBy: { date: 'desc' },
            select: { price: true, date: true }
        });

        if (!record) return null;

        if (isDifferent) {
            // Pair Construction: Target + Asset + =X => EURTRY=X
            const pairSymbol = `${targetCurrency}${assetCurrency}=X`;

            // Find historical FX rate
            const fxRecord = await prisma.assetPriceHistory.findFirst({
                where: {
                    symbol: pairSymbol,
                    date: { lte: targetDate }
                },
                orderBy: { date: 'desc' },
                select: { price: true }
            });

            // If we have history, use it. Else fallback to current rate or 1
            const rate = fxRecord?.price || exchangeRates?.[assetCurrency] || 1;

            // Convert: Asset / FX = Value in Target
            // e.g. 100 TRY / 38.5 = 2.59 EUR
            return record.price / rate;
        }

        return record.price;
    };

    // Current Price Conversion
    let adjustedCurrentPrice = currentPrice;
    if (isDifferent) {
        const currentRate = exchangeRates?.[assetCurrency] || 1;
        adjustedCurrentPrice = currentPrice / currentRate;
    }

    const [p1D, p1W, p1M, pYTD, p1Y] = await Promise.all([
        findPriceAt(oneDayAgo),      // Already has endOfDay applied
        findPriceAt(oneWeekAgo),     // Already has endOfDay applied
        findPriceAt(oneMonthAgoEOD),
        findPriceAt(startOfYearEOD),
        findPriceAt(oneYearAgoEOD)
    ]);

    const calc = (oldPrice: number | null) => {
        if (!oldPrice || oldPrice === 0) return 0;
        return ((adjustedCurrentPrice - oldPrice) / oldPrice) * 100;
    };

    // Calculate 1D change
    // PRIORITY: Use Yahoo's previousClose when provided (most accurate for 1D)
    // Fallback to historical data only when previousClose is not available
    let final1DPercent: number;

    if (previousClose && previousClose > 0) {
        // Use Yahoo's previousClose - convert to target currency if needed
        let adjustedPreviousClose = previousClose;
        if (isDifferent) {
            const currentRate = exchangeRates?.[assetCurrency] || 1;
            adjustedPreviousClose = previousClose / currentRate;
        }
        final1DPercent = ((adjustedCurrentPrice - adjustedPreviousClose) / adjustedPreviousClose) * 100;

        // Debug log
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Performance] ${symbol}: current=${adjustedCurrentPrice.toFixed(2)}, prevClose=${adjustedPreviousClose.toFixed(2)}, 1D%=${final1DPercent.toFixed(2)} (Yahoo)`);
        }
    } else {
        // Fallback to historical data
        final1DPercent = calc(p1D);

        // Debug log
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Performance] ${symbol}: current=${adjustedCurrentPrice.toFixed(2)}, p1D=${p1D?.toFixed(2) || 'null'}, 1D%=${final1DPercent.toFixed(2)} (History)`);
        }
    }

    return {
        changePercent1D: final1DPercent,
        changePercent1W: calc(p1W),
        changePercent1M: calc(p1M),
        changePercentYTD: calc(pYTD),
        changePercent1Y: calc(p1Y)
    };
}
