import { prisma } from "@/lib/prisma";

export interface RatesMap {
    [currency: string]: number;
}

export async function getExchangeRates(): Promise<RatesMap> {
    // 0. Detect Required Currencies dynamically from Assets
    const activeAssets = await prisma.asset.findMany({
        where: { quantity: { gt: 0 } },
        select: { currency: true },
        distinct: ['currency']
    });

    const activeCurrencies = activeAssets.map(a => a.currency).filter(c => c !== 'EUR');
    const requiredCurrencies = Array.from(new Set([...activeCurrencies, 'USD', 'TRY'])); // Ensure USD/TRY always present
    // EUR is base 1 always.

    // 1. Check DB
    const storedRates = await prisma.exchangeRate.findMany();

    let rates: RatesMap = { EUR: 1 };
    let needsUpdate = false;

    // Populate rates from DB
    storedRates.forEach(r => {
        rates[r.currency] = r.rate;
    });

    // Helper to determine if rates are stale (Hourly update requested)
    // Rule: Update if the last update belongs to a previous hour (i.e., we are in a new hour).
    // RULE 2: Quiet Hours (00:00 - 08:00 CET). Do not update during night.
    const isStale = (lastUpdateUTC: Date) => {
        const now = new Date();
        const currentHour = now.getHours();

        // Quiet Hours Check
        if (currentHour >= 0 && currentHour < 8) return false;

        const currentHourFloor = new Date(now);
        currentHourFloor.setMinutes(0, 0, 0); // Reset to XX:00:00.000

        // If last update was BEFORE the start of this hour, it's stale.
        return lastUpdateUTC.getTime() < currentHourFloor.getTime();
    }

    // Check freshness
    if (storedRates.length === 0) {
        needsUpdate = true;
    } else {
        // Check if any REQUIRED currency is missing or stale
        for (const cur of requiredCurrencies) {
            const r = storedRates.find(x => x.currency === cur);
            if (!r) {
                console.log(`Missing rate for active currency: ${cur}, triggering update.`);
                needsUpdate = true;
                break;
            }
            if (isStale(r.updatedAt)) {
                // console.log(`Exchange Rates (${cur}) stale.`);
                needsUpdate = true;
                break;
            }
        }
    }

    if (needsUpdate) {
        try {
            console.log(`Fetching new exchange rates from Yahoo Finance for: ${requiredCurrencies.join(', ')}`);

            // Construct Yahoo Symbols
            // EURUSD=X -> Price of 1 EUR in USD
            const yahooSymbols = requiredCurrencies.map(c => `EUR${c}=X`);

            const { getYahooQuotes } = await import('@/services/yahooApi');

            // PERFORMANCE FIX: Add timeout to prevent long loading times
            // Reduced to 2.5s for better mobile experience (was 5s)
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Yahoo Finance API timeout')), 2500)
            );

            const quotes = await Promise.race([
                getYahooQuotes(yahooSymbols),
                timeoutPromise
            ]);

            const newRates: Record<string, number> = {};

            // Map Yahoo Results
            for (const cur of requiredCurrencies) {
                const sym = `EUR${cur}=X`;
                const quote = quotes[sym];
                if (quote && quote.regularMarketPrice) {
                    newRates[cur] = quote.regularMarketPrice;
                }
            }

            // Update DB in parallel for speed
            await Promise.all(Object.entries(newRates).map(async ([currency, rate]) => {
                if (typeof rate === 'number') {
                    await prisma.exchangeRate.upsert({
                        where: { currency },
                        create: { currency, rate },
                        update: { rate } // updatedAt updates automatically
                    });
                    rates[currency] = rate;
                }
            }));

            console.log("Exchange rates updated successfully from Yahoo.");
        } catch (e) {
            console.error("Error updating rates from Yahoo:", e);
        }
    }

    // FINAL SAFETY CHECK: Ensure we absolutely have USD and TRY rates
    if (!rates['USD']) {
        console.warn("Using emergency fallback rate for USD");
        rates['USD'] = 1.09;
    }
    if (!rates['TRY']) {
        console.warn("Using emergency fallback rate for TRY");
        rates['TRY'] = 37.5;
    }

    return rates;
}
