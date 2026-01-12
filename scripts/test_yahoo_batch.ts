
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey'],
});

async function main() {
    console.log('Testing Yahoo Finance Batch (Corrected)...');
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'ASML.AS', 'TAVHL.IS'];

    try {
        console.log('1. Testing Library Batch (yahooFinance.quote)...');
        const results = await yahooFinance.quote(symbols);
        console.log(`Success! Got ${results.length} results.`);
        results.forEach(r => console.log(` - ${r.symbol}: ${r.regularMarketPrice} ${r.currency}`));
    } catch (e: any) {
        console.error('Library Batch Failed:', e.message);
        if (e.errors) {
            console.error('Errors:', JSON.stringify(e.errors, null, 2));
        }
    }
}

main();
