// Simple synchronous function - just returns URL string
// Tracking is done at the point of actual usage
export const getLogoUrl = (symbol: string, type: string, exchange?: string, country?: string): string | null => {
    let s = symbol.toUpperCase();
    const t = type.toUpperCase();
    const ex = exchange?.toUpperCase();

    // 0. TEFAS FUNDS: Use first letter placeholder (avoid wrong company logos)
    // TEFAS funds are mutual funds in Turkey, they should NOT get corporate logos
    if (ex === 'TEFAS' || (t === 'FUND' && ex === 'TEFAS')) {
        // Return null to use the default letter-based placeholder
        return null;
    }

    // 1. CRYPTO: Use CoinCap (Symbol-based)
    if (t === 'CRYPTO') {
        // CoinCap uses lowercase symbols (btc, eth, sol)
        // Strip suffixes like -EUR, -USD (e.g. BTC-EUR -> btc)
        const cleanSymbol = s.split('-')[0].toLowerCase();
        return `https://assets.coincap.io/assets/icons/${cleanSymbol}@2x.png`;
    }

    // 2. CASH / CURRENCIES: Use LOCAL Public Icons (100% Reliability)
    if (t === 'CASH' || t === 'CURRENCY') {
        const currencyMap: Record<string, string> = {
            'USD': '/icons/currency/usd.svg',
            'EUR': '/icons/currency/eur.svg',
            'TRY': '/icons/currency/try.svg',
            'GBP': '/icons/currency/gbp.svg',
            'JPY': '/icons/currency/generic.svg', // Fallbacks until specific SVG added
            'CNY': '/icons/currency/generic.svg',
            'CHF': '/icons/currency/generic.svg',
            'CAD': '/icons/currency/usd.svg', // Re-use USD for dollar sign
            'AUD': '/icons/currency/usd.svg',
            'NZD': '/icons/currency/usd.svg',
            'INR': '/icons/currency/generic.svg',
            'BRL': '/icons/currency/usd.svg',
            'RUB': '/icons/currency/generic.svg',
            'MXN': '/icons/currency/usd.svg',
            'SEK': '/icons/currency/generic.svg',
        };

        return currencyMap[s] || '/icons/currency/generic.svg';
    }



    // 3. COMMODITIES: Static High-Quality Icons
    if (t === 'GOLD' || t === 'COMMODITY') {
        // Updated to a cleaner, professional gold icon (Bars/Ingots)
        if (s === 'XAU' || s === 'GAUTRY' || s.includes('GOLD')) return 'https://img.icons8.com/color/96/gold-bars.png';
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

    // 4. STOCKS / ETFs / FUNDS: Use Logo.dev API (ticker-based, works great!)
    if (t === 'STOCK' || t === 'ETF' || t === 'FUND') {
        const cleanSymbol = symbol.split('.')[0].toUpperCase();

        // For Turkish BIST stocks (.IS), use GitHub CDN
        if (symbol.includes('.IS')) {
            return `https://cdn.jsdelivr.net/gh/ahmeterenodaci/Istanbul-Stock-Exchange--BIST--including-symbols-and-logos/logos/${cleanSymbol}.png`;
        }

        // For BES funds, return null (will use placeholder)
        if (['BES', 'HISA'].some(prefix => symbol.startsWith(prefix))) {
            return null;
        }

        // Logo.dev provides high-quality logos for stocks using ticker symbols
        const apiKey = process.env.NEXT_PUBLIC_LOGODEV_API_KEY || 'pk_OYRe85gjScGyAdhJcb1Jag';
        return `https://img.logo.dev/ticker/${cleanSymbol}?token=${apiKey}`;
    }

    return null;
};

// Helper to determine which provider a logo URL belongs to
export const getLogoProvider = (logoUrl: string | null): string | null => {
    if (!logoUrl) return null;

    if (logoUrl.includes('coincap.io')) return 'COINCAP';
    if (logoUrl.includes('flagcdn.com')) return 'FLAGCDN';
    if (logoUrl.includes('icons8.com')) return 'ICONS8';
    if (logoUrl.includes('flaticon.com')) return 'FLATICON';
    if (logoUrl.includes('jsdelivr.net')) return 'GITHUB_CDN';
    if (logoUrl.includes('logo.dev')) return 'LOGODEV';
    if (logoUrl.includes('parqet.com')) return 'PARQET';
    if (logoUrl.includes('linkedin.com')) return 'LINKEDIN';

    return 'UNKNOWN';
};

// Get logo with tracking
export const getLogoUrlWithTracking = async (
    symbol: string,
    type: string,
    exchange?: string,
    country?: string,
    userId?: string,
    username?: string
): Promise<string | null> => {
    const logoUrl = getLogoUrl(symbol, type, exchange, country);

    // Track logo URL generation
    if (logoUrl) {
        const provider = getLogoProvider(logoUrl);

        // Import dynamically to avoid circular dependencies
        const { trackActivity } = await import('@/services/telemetry');

        await trackActivity('SYSTEM', 'VIEW', {
            userId,
            username,
            targetType: 'Logo',
            details: {
                symbol,
                type,
                exchange,
                provider,
                url: logoUrl
            }
        });
    }

    return logoUrl;
};
