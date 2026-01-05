
const YahooFinance = require('yahoo-finance2').default;
const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function check() {
    try {
        console.log("Checking ASML.AS...");
        const quoteAs = await yahoo.quote('ASML.AS');
        console.log("ASML.AS price:", quoteAs.regularMarketPrice, quoteAs.currency);

        console.log("Checking ASML (US)...");
        const quoteUs = await yahoo.quote('ASML');
        console.log("ASML (US) price:", quoteUs.regularMarketPrice, quoteUs.currency);
    } catch (err) {
        console.error("Error:", err);
    }
}

check();
