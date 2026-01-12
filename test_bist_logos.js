async function testBISTLogos() {
    console.log('\n=== Testing BIST Logo URLs ===\n');

    const testSymbols = [
        'THYAO',  // Türk Hava Yolları
        'AKBNK',  // Akbank
        'GARAN',  // Garanti BBVA
        'ISCTR',  // İş Bankası (C)
        'EREGL',  // Ereğli Demir Çelik
        'SAHOL',  // Sabancı Holding
        'ASELS'   // Aselsan
    ];

    for (const symbol of testSymbols) {
        const url = `https://cdn.jsdelivr.net/gh/ahmeterenodaci/Istanbul-Stock-Exchange--BIST--including-symbols-and-logos/logos/${symbol}.png`;

        try {
            const response = await fetch(url);
            const status = response.status === 200 ? '✅' : '❌';
            console.log(`${status} ${symbol}`);
            console.log(`  URL: ${url}`);
            console.log(`  Status: ${response.status} ${response.statusText}`);
            console.log('');
        } catch (error) {
            console.log(`❌ ${symbol}`);
            console.log(`  Error: ${error.message}`);
            console.log('');
        }
    }
}

testBISTLogos().catch(console.error);
