export const getLogoUrl = (symbol: string, type: string, exchange?: string, country?: string) => {
    let s = symbol.toUpperCase();
    const t = type.toUpperCase();

    // 1. CRYPTO: Use CoinCap (Symbol-based)
    if (t === 'CRYPTO') {
        // CoinCap uses lowercase symbols (btc, eth, sol)
        // Strip suffixes like -EUR, -USD (e.g. BTC-EUR -> btc)
        const cleanSymbol = s.split('-')[0].toLowerCase();
        return `https://assets.coincap.io/assets/icons/${cleanSymbol}@2x.png`;
    }

    // 2. CASH / CURRENCIES: Use FlagCDN
    if (t === 'CASH' || t === 'CURRENCY') {
        const currencyMap: Record<string, string> = {
            'USD': 'us', 'EUR': 'eu', 'TRY': 'tr', 'GBP': 'gb',
            'JPY': 'jp', 'CNY': 'cn', 'CHF': 'ch', 'CAD': 'ca',
            'AUD': 'au', 'NZD': 'nz', 'INR': 'in', 'BRL': 'br'
        };
        const code = currencyMap[s] || 'un';
        return `https://flagcdn.com/w80/${code}.png`;
    }

    // 3. COMMODITIES: Static High-Quality Icons
    if (t === 'GOLD' || t === 'COMMODITY') {
        // Updated to a cleaner, professional gold icon (Bars/Ingots)
        if (s === 'XAU' || s === 'GAUTRY' || s.includes('GOLD')) return 'https://cdn-icons-png.flaticon.com/512/9334/9334575.png';
        if (s === 'XAG' || s === 'XAGTRY' || s.includes('SILVER')) return 'https://cdn-icons-png.flaticon.com/512/2908/2908842.png'; // Silver Bar
        if (s.includes('OIL') || s === 'BRENT' || s === 'WTI') return 'https://cdn-icons-png.flaticon.com/512/2908/2908848.png'; // Oil Drop
    }

    // Special Overrides for known missing logos
    if (s.startsWith('SOH1') || s.startsWith('SOI.PA')) return 'https://assets.parqet.com/logos/symbol/SOI.PA?format=png';

    // BES (Individual Pension System) Funds - Often lack individual logos, use provider/generic
    if (s.startsWith('BES')) {
        // Many BES assets in this context might be TEB Portfolio
        return 'https://media.licdn.com/dms/image/v2/C4D0BAQG0YyP-lF0L7g/company-logo_200_200/company-logo_200_200/0/1630572851493/teb_portfy_y_yonetimi_a_logo?e=2147483647&v=beta&t=mS8P06pWn6lI-C-U89Xz8r-Yy7cO-n8v6Z-zI6h_0vE';
    }

    // 4. STOCKS / ETFs / FUNDS: Parqet API with Exchange Suffix Mapping
    if (t === 'STOCK' || t === 'ETF' || t === 'FUND') {
        // Exchange -> Suffix Map
        const SUFFIX_MAP: Record<string, string> = {
            'IST': '.IS', 'BIST': '.IS', 'ISTANBUL': '.IS',
            'LSE': '.L', 'LONDON': '.L',
            'PAR': '.PA', 'PARIS': '.PA', 'EPA': '.PA',
            'FRA': '.DE', 'FRANKFURT': '.DE', 'XETRA': '.DE', 'GER': '.DE', 'EDG': '.DE',
            'AMS': '.AS', 'AMSTERDAM': '.AS',
            'BRU': '.BR', 'BRUSSELS': '.BR', 'EBR': '.BR',
            'LIS': '.LS', 'LISBON': '.LS',
            'MAD': '.MC', 'MADRID': '.MC', 'BME': '.MC',
            'MIL': '.MI', 'MILAN': '.MI',
            'NASDAQ': '', 'NYSE': '', 'AMEX': '', 'US': '', // US often doesn't need suffix on Parqet
            'HKG': '.HK', 'HONG KONG': '.HK',
            'SHH': '.SS', 'SHANGHAI': '.SS',
            'SHE': '.SZ', 'SHENZHEN': '.SZ',
            'TSE': '.TO', 'TORONTO': '.TO', 'TOR': '.TO',
            'SWX': '.SW', 'ZURICH': '.SW', 'SIX': '.SW',
            'OSL': '.OL', 'OSLO': '.OL',
            'STO': '.ST', 'STOCKHOLM': '.ST',
            'CPH': '.CO', 'COPENHAGEN': '.CO',
            'HEL': '.HE', 'HELSINKI': '.HE',
            'VIE': '.VI', 'VIENNA': '.VI',
            'ATH': '.AT', 'ATHENS': '.AT',
            'DUB': '.IR', 'DUBLIN': '.IR',
            'JSE': '.JO', 'JOHANNESBURG': '.JO',
            'ASX': '.AX', 'SYDNEY': '.AX',
            'NSE': '.NS', 'BSE': '.BO', 'INDIA': '.NS',
            'KLS': '.KL', 'MALAYSIA': '.KL',
            'SGX': '.SI', 'SINGAPORE': '.SI',
            'KRX': '.KS', 'KOREA': '.KS',
            'TPE': '.TW', 'TAIWAN': '.TW',
        };

        if (exchange) {
            const exUpper = exchange.toUpperCase();
            // Find a matching suffix key
            const matchedKey = Object.keys(SUFFIX_MAP).find(k => exUpper.includes(k));

            if (matchedKey) {
                const suffix = SUFFIX_MAP[matchedKey];
                // Check if the symbol already ends with the suffix to avoid double suffixing
                // Also handle case where symbol has a different suffix (potentially) - tough without strip, 
                // but usually the issue is SOH1.F becoming SOH1.F.DE. 
                // Let's check if it ends with .[something] and that something is not our target suffix? 
                // Creating a cleaner symbol:

                // If it already ends with our target suffix, do nothing.
                if (!s.endsWith(suffix)) {
                    // If it ends with a different suffix (e.g. .F), we might want to replace it IF we are sure.
                    // But for now, just appending blindly was the issue. 
                    // Example: SOH1.F + .DE -> SOH1.F.DE (Bad)
                    // If we detect a "dot" suffix already, we should probably strip it if we are re-suffixing?
                    // Or maybe the symbol SOH1.F IS the Frankfurt symbol?
                    // Parqet expects "Symbol.Suffix".
                    // If we have SOH1.F and we want .DE.
                    // SOH1.F isn't valid for Parqet normally if they want .DE.
                    // Try: SOH1.DE.

                    const dotIndex = s.lastIndexOf('.');
                    if (dotIndex !== -1) {
                        // It has a dot.
                        // Assume we replace the suffix?
                        s = s.substring(0, dotIndex) + suffix;
                    } else {
                        s += suffix;
                    }
                }
            }
        }

        return `https://assets.parqet.com/logos/symbol/${s}?format=png`;
    }

    return null;
};
