
// Load env vars if needed, but yahoo-finance2 might not need keys
const { getYahooAssetProfile } = require('./src/services/yahooApi');

async function test() {
    console.log("Fetching asset profile for MC.PA...");
    try {
        const data = await getYahooAssetProfile('MC.PA');
        console.log("Result:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
