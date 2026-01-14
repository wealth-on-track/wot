
import { NextResponse } from 'next/server';
import { getYahooQuote } from '@/services/yahooApi';
import * as finnhub from '@/services/finnhubApi';

export async function GET() {
    const symbol = 'VOO';
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    log(`Debug Price Fetch for ${symbol}`);

    // 1. Check Env Vars
    const finnhubKey = process.env.FINNHUB_API_KEY;
    const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;

    log(`FINNHUB_API_KEY: ${finnhubKey ? `${finnhubKey.substring(0, 4)}... (Length: ${finnhubKey.length})` : 'MISSING'}`);
    log(`ALPHA_VANTAGE_API_KEY: ${alphaKey ? `${alphaKey.substring(0, 4)}... (Length: ${alphaKey.length})` : 'MISSING'}`);

    // 2. Test Finnhub Directly
    try {
        log('--- Testing Finnhub Direct ---');
        const fQuote = await finnhub.getQuote(symbol);
        log(`Finnhub Result: ${JSON.stringify(fQuote)}`);
    } catch (e: any) {
        log(`Finnhub Error: ${e.message}`);
    }

    // 3. Test Alpha Vantage Directly
    try {
        log('--- Testing Alpha Vantage Direct ---');
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${alphaKey}`;
        const res = await fetch(url);
        const data = await res.json();
        log(`Alpha Vantage Result: ${JSON.stringify(data)}`);
    } catch (e: any) {
        log(`Alpha Vantage Error: ${e.message}`);
    }

    // 4. Test Full Service (getYahooQuote)
    try {
        log('--- Testing getYahooQuote (Service) ---');
        const quote = await getYahooQuote(symbol, true); // Force Refresh
        log(`Service Result: ${JSON.stringify(quote)}`);
    } catch (e: any) {
        log(`Service Error: ${e.message}`);
    }

    return NextResponse.json({ logs }, { status: 200 });
}
