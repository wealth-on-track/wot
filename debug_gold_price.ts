
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function testGoldPrice() {
    const symbols = ["XAUTRY=X", "XAU-TRY", "GC=F", "TRY=X"];

    for (const sym of symbols) {
        console.log(`Testing ${sym}...`);
        try {
            const quote = await yahooFinance.quote(sym);
            console.log(`SUCCESS ${sym}:`, quote.regularMarketPrice, quote.currency);
        } catch (e: any) {
            console.log(`FAIL ${sym}:`, e.message);
        }
    }
}

testGoldPrice();
