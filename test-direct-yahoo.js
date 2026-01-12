
async function searchDirect(query) {
    try {
        console.log(`[Test] Direct Search: ${query}`);
        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-US&region=US&quotesCount=6&newsCount=0`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://finance.yahoo.com',
                'Referer': 'https://finance.yahoo.com/',
            }
        });

        if (!response.ok) {
            console.warn(`[Test] Direct search failed: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data.quotes;
    } catch (e) {
        console.error('[Test] Error:', e);
    }
}

async function getDirectQuoteFallback(symbol) {
    try {
        console.log(`[Test] Direct Chart Fallback for ${symbol}`);
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data.chart?.result?.[0]?.meta;
        } else {
            console.warn(`[Test] Direct Fallback Failed for ${symbol}: Status ${response.status} ${response.statusText}`);
        }
    } catch (e) {
        console.warn(`[Test] Direct Chart fallback failed for ${symbol}:`, e);
    }
    return null;
}

async function run() {
    const search = await searchDirect('ASML');
    console.log('Search results:', search?.length);
    if (search) console.log('First result:', search[0]?.symbol);

    const quote = await getDirectQuoteFallback('ASML.AS');
    console.log('Quote result price:', quote?.regularMarketPrice);
}

run();
