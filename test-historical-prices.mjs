// Test script for 1W and 1M price changes
import { getPriceNDaysAgo, getHistoricalPrices } from './src/services/yahooApi';

async function testHistoricalPrices() {
    console.log('🧪 Testing Historical Price Fetching...\n');

    const testSymbols = ['AAPL', 'MSFT', 'THYAO.IS'];

    for (const symbol of testSymbols) {
        console.log(`\n📊 Testing ${symbol}:`);
        console.log('─'.repeat(50));

        try {
            // Test 7 days ago
            const price7d = await getPriceNDaysAgo(symbol, 7);
            console.log(`  7 days ago: $${price7d?.toFixed(2) || 'N/A'}`);

            // Test 30 days ago
            const price30d = await getPriceNDaysAgo(symbol, 30);
            console.log(`  30 days ago: $${price30d?.toFixed(2) || 'N/A'}`);

            // Get full historical data
            const historical = await getHistoricalPrices(symbol, 35);
            console.log(`  Historical data points: ${historical.length}`);

            if (historical.length > 0) {
                const latest = historical[historical.length - 1];
                const oldest = historical[0];
                console.log(`  Date range: ${oldest.date.toLocaleDateString()} to ${latest.date.toLocaleDateString()}`);
                console.log(`  Latest close: $${latest.close.toFixed(2)}`);

                if (price7d && price30d) {
                    const change7d = ((latest.close - price7d) / price7d) * 100;
                    const change30d = ((latest.close - price30d) / price30d) * 100;
                    console.log(`  ✅ 1W Change: ${change7d >= 0 ? '+' : ''}${change7d.toFixed(2)}%`);
                    console.log(`  ✅ 1M Change: ${change30d >= 0 ? '+' : ''}${change30d.toFixed(2)}%`);
                }
            }

        } catch (error) {
            console.error(`  ❌ Error: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Test completed!');
}

testHistoricalPrices().catch(console.error);
