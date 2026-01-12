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

async function testLogoUrls() {
    console.log('\n=== Testing Logo URLs ===\n');

    const testCases = [
        {
            name: 'BABA (Alibaba Stock)',
            url: 'https://s3-symbol-logo.tradingview.com/BABA--big.svg'
        },
        {
            name: 'EUR (Cash/Currency)',
            url: 'https://raw.githubusercontent.com/ErikThiart/cryptocurrency-icons/master/64/euro.png'
        },
        {
            name: 'EUR (FlagCDN Fallback)',
            url: 'https://flagcdn.com/w80/eu.png'
        },
        {
            name: 'BTC (Crypto)',
            url: 'https://assets.coincap.io/assets/icons/btc@2x.png'
        }
    ];

    for (const test of testCases) {
        try {
            const response = await fetch(test.url);
            console.log(`✓ ${test.name}`);
            console.log(`  URL: ${test.url}`);
            console.log(`  Status: ${response.status} ${response.statusText}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            console.log('');
        } catch (error) {
            console.log(`✗ ${test.name}`);
            console.log(`  URL: ${test.url}`);
            console.log(`  Error: ${error.message}`);
            console.log('');
        }
    }
}

testLogoUrls().catch(console.error);
