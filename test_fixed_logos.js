const fs = require('fs');
const path = require('path');

// Manual .env parser
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
});

async function testFixedLogoUrls() {
    console.log('\n=== Testing FIXED Logo URLs ===\n');

    const testCases = [
        {
            name: 'BABA (Alibaba - Clearbit)',
            url: 'https://logo.clearbit.com/alibaba.com'
        },
        {
            name: 'AAPL (Apple - Clearbit)',
            url: 'https://logo.clearbit.com/apple.com'
        },
        {
            name: 'EUR (FlagCDN)',
            url: 'https://flagcdn.com/w80/eu.png'
        },
        {
            name: 'USD (FlagCDN)',
            url: 'https://flagcdn.com/w80/us.png'
        },
        {
            name: 'BTC (CoinCap)',
            url: 'https://assets.coincap.io/assets/icons/btc@2x.png'
        }
    ];

    for (const test of testCases) {
        try {
            const response = await fetch(test.url);
            const status = response.status === 200 ? '✅' : '❌';
            console.log(`${status} ${test.name}`);
            console.log(`  URL: ${test.url}`);
            console.log(`  Status: ${response.status} ${response.statusText}`);
            console.log('');
        } catch (error) {
            console.log(`❌ ${test.name}`);
            console.log(`  URL: ${test.url}`);
            console.log(`  Error: ${error.message}`);
            console.log('');
        }
    }
}

testFixedLogoUrls().catch(console.error);
