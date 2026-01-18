export const cleanAssetName = (name: string): string => {
    let cleaned = name.trim();

    // 1. Clean British stock nominal value patterns FIRST (e.g., "ORD 28 101/108P", "ORD 25P", "ORD GBP0.10")
    // These appear in LSE stock names like "DIAGEO PLC ORD 28 101/108P"
    const britishPatterns = [
        / ORD \d+[\s\/]*\d*P?$/i,           // "ORD 28 101/108P", "ORD 25P"
        / ORD [\d\.\/]+P$/i,                 // "ORD 0.25P"
        / ORD GBP[\d\.]+$/i,                 // "ORD GBP0.10"
        / ORD USD[\d\.]+$/i,                 // "ORD USD0.01"
        / ORD EUR[\d\.]+$/i,                 // "ORD EUR0.01"
        / ORD \$[\d\.]+$/i,                  // "ORD $0.01"
        / ORD £[\d\.]+$/i,                   // "ORD £0.10"
        / ORD€[\d\.]+$/i,                    // "ORD€0.01"
        / ORD$/i,                            // Just "ORD" at the end
        / ORDINARY SHARES?$/i,               // "ORDINARY SHARES"
        / COM(MON)?$/i,                      // "COM" or "COMMON"
        / CL(ASS)? [A-Z]$/i,                 // "CLASS A", "CL A"
        / ADR$/i,                            // American Depositary Receipt
        / ADS$/i,                            // American Depositary Shares
        / REIT$/i,                           // Real Estate Investment Trust
    ];

    britishPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '').trim();
    });

    // 2. Clean common formal suffixes
    // We remove these disregarding case, allowing for optional trailing whitespace/dots
    const suffixes = [
        / Inc\.?$/i,
        / Corp\.?$/i,
        / Corporation$/i,
        / Ltd\.?$/i,
        / Limited$/i,
        / A\.S\.?$/i,
        / A\.Ş\.?$/i,
        / AS$/i,
        / Holding\.?$/i,
        / N\.V\.?$/i,
        / PLC\.?$/i,
        / S\.A\.?$/i,
        / S\.A\.A\.?$/i,
        / SAA$/i,
        / Group$/i,
        / GmbH$/i,
        / GMBH$/i,
        / Sanayi$/i,
        / ve Ticaret$/i,
        / San\.?$/i,
        / Tic\.?$/i,
        / AG\.?$/i,    // Added optional dot
        / A\/S$/i,
        / SE$/i,
        / SpA$/i,
        / NV$/i,
        / Oy$/i,
        / Oyi$/i,
        / Abp$/i,
        / ASA$/i,
        / AB$/i,
        / Co\.?$/i,
        / Company$/i,
        / \& Co\.?$/i,
        // Crypto/Currency Suffixes (e.g. "Bitcoin EUR", "Apple USD")
        / EUR$/i,
        / USD$/i,
        / TRY$/i,
        / GBP$/i,
        / CAD$/i,
        / AUD$/i,
        / CHF$/i,
    ];

    // Iteratively clean until no change (to handle "Company AG EUR")
    let prev;
    do {
        prev = cleaned;
        suffixes.forEach(suffix => {
            // Regex handles the end, so we replace and trim immediately
            cleaned = cleaned.replace(suffix, '').trim();
        });

        // Clean up trailing separators
        cleaned = cleaned.replace(/ ve$/i, '').replace(/ &$/i, '').replace(/-$/i, '').replace(/,$/i, '').trim();
    } while (cleaned !== prev);

    return cleaned;
};

export const getCompanyName = (symbol: string, type: string, fullName?: string | null): string => {
    // Return "Cash" for cash assets
    if (type === 'CASH' || symbol.toUpperCase().endsWith('-CASH')) {
        return 'Cash';
    }

    // 1. Prioritize mapped names
    const names: Record<string, string> = {
        'AAPL': 'Apple',
        'MSFT': 'Microsoft',
        'GOOGL': 'Alphabet',
        'TSLA': 'Tesla',
        'AMZN': 'Amazon',
        'BTC': 'Bitcoin',
        'ETH': 'Ethereum',
        'XAU': 'Gold',
        'TAVHL': 'TAV Havalimanları',
        'SISE': 'Şişecam',
        'THYAO': 'Türk Hava Yolları',
        'GARAN': 'Garanti BBVA',
        'AKBNK': 'Akbank',
        'KCHOL': 'Koç Holding',
        'SAHOL': 'Sabancı Holding',
        'BTC-EUR': 'Bitcoin',
        'ETH-EUR': 'Ethereum',
        'SOL-EUR': 'Solana',
    };

    let name = names[symbol.toUpperCase()] || fullName || symbol;

    return cleanAssetName(name);
};
