async function testLogoDevAPI() {
    console.log('\n=== Testing Logo.dev API ===\n');

    const apiKey = 'pk_OYRe85gjScGyAdhJcb1Jag';

    const testCases = [
        { symbol: 'BABA', name: 'Alibaba' },
        { symbol: 'AAPL', name: 'Apple' },
        { symbol: 'GOOGL', name: 'Google' },
        { symbol: 'MSFT', name: 'Microsoft' },
        { symbol: 'TSLA', name: 'Tesla' },
        { symbol: 'NVDA', name: 'Nvidia' }
    ];

    for (const test of testCases) {
        const url = `https://img.logo.dev/ticker/${test.symbol}?token=${apiKey}`;
        try {
            const response = await fetch(url);
            const status = response.status === 200 ? '✅' : '❌';
            console.log(`${status} ${test.name} (${test.symbol})`);
            console.log(`  URL: ${url}`);
            console.log(`  Status: ${response.status} ${response.statusText}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            console.log('');
        } catch (error) {
            console.log(`❌ ${test.name} (${test.symbol})`);
            console.log(`  Error: ${error.message}`);
            console.log('');
        }
    }
}

testLogoDevAPI().catch(console.error);
