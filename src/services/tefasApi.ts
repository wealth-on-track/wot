
import { TefasClient } from "@firstthumb/tefas-api";
import { trackApiRequest } from "./telemetry";

export interface TefasFund {
    code: string;
    title: string;
    price: number;
    lastUpdated?: string;
}

const client = new TefasClient();

export async function getTefasFundInfo(code: string): Promise<TefasFund | null> {
    const startTime = Date.now();
    const cleanCode = code.toUpperCase().trim();

    try {
        // 1. Search to verify existence and get Title
        const searchRes = await client.searchFund(cleanCode);
        const match = searchRes.results?.find(r => r.fundCode === cleanCode);

        if (!match) {
            await trackApiRequest('TEFAS', false, {
                endpoint: 'fund_info',
                params: cleanCode,
                error: 'Fund not found'
            });
            return null;
        }

        // 2. Try to get Price
        let price = 0;
        let lastUpdated: string | undefined = undefined;

        try {
            // Fetch last 7 days to ensure we get a valid price (holidays/weekends)
            const now = new Date();
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 7);

            const endDateStr = now.toISOString().split('T')[0];
            const startDateStr = weekAgo.toISOString().split('T')[0];

            // Use getFund with date range and fund code
            // Note: getFund returns { results: [...] } based on our test
            const fundData = await client.getFund(startDateStr, endDateStr, cleanCode);

            if (fundData && fundData.results && fundData.results.length > 0) {
                // Sort by date descending to get latest
                // The results seem to have 'date' string "YYYY-MM-DD"
                const sorted = fundData.results.sort((a, b) => {
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                });

                const latest = sorted[0];
                price = latest.price || 0;
                lastUpdated = latest.date;
            }

        } catch (e) {
            console.warn("TEFAS Price fetch failed:", e);
            await trackApiRequest('TEFAS', false, {
                endpoint: 'fund_price',
                params: cleanCode,
                error: String(e)
            });
        }

        const duration = Date.now() - startTime;
        await trackApiRequest('TEFAS', true, {
            endpoint: 'fund_info',
            params: cleanCode,
            duration
        });

        return {
            code: cleanCode,
            title: match.fundName,
            price: price,
            lastUpdated: lastUpdated || new Date().toLocaleDateString()
        };

    } catch (error) {
        console.error("Error fetching TEFAS data:", error);
        const duration = Date.now() - startTime;
        await trackApiRequest('TEFAS', false, {
            endpoint: 'fund_info',
            params: cleanCode,
            error: String(error),
            duration
        });
        return null;
    }
}


export interface TefasHistoryItem {
    date: Date;
    price: number;
}

export async function getTefasHistory(code: string, startDate: Date): Promise<TefasHistoryItem[]> {
    const startTime = Date.now();
    const cleanCode = code.toUpperCase().trim();

    try {
        const endDateStr = new Date().toISOString().split('T')[0];
        const startDateStr = startDate.toISOString().split('T')[0];

        // Fetch history
        const fundData = await client.getFund(startDateStr, endDateStr, cleanCode);

        if (!fundData || !fundData.results || fundData.results.length === 0) {
            return [];
        }

        const history: TefasHistoryItem[] = fundData.results
            .map(item => ({
                date: new Date(item.date),
                price: item.price ?? 0 // Default to 0 if null
            }))
            .filter(item => item.price > 0) // Filter out 0/null prices
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        const duration = Date.now() - startTime;
        await trackApiRequest('TEFAS', true, {
            endpoint: 'history',
            params: `${cleanCode} (${startDateStr})`,
            duration
        });

        return history;

    } catch (error) {
        console.error(`Error fetching TEFAS history for ${cleanCode}:`, error);
        await trackApiRequest('TEFAS', false, {
            endpoint: 'history',
            params: cleanCode,
            error: String(error)
        });
        return [];
    }
}
