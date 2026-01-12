interface SymbolProfile {
    country: string;
    sector: string;
    industry?: string;
}

const MANUAL_MAPPINGS: Record<string, SymbolProfile> = {
    // Turkish Stocks (BIST)
    'FROTO.IS': { country: 'Turkey', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' },
    'TCELL.IS': { country: 'Turkey', sector: 'Communication Services', industry: 'Telecom Services' },
    'THYAO.IS': { country: 'Turkey', sector: 'Industrials', industry: 'Airlines' },
    'GARAN.IS': { country: 'Turkey', sector: 'Financial Services', industry: 'Banks' },
    'AKBNK.IS': { country: 'Turkey', sector: 'Financial Services', industry: 'Banks' },
    'EREGL.IS': { country: 'Turkey', sector: 'Basic Materials', industry: 'Steel' },
    'KCHOL.IS': { country: 'Turkey', sector: 'Financial Services', industry: 'Financial Conglomerates' },
    'SAHOL.IS': { country: 'Turkey', sector: 'Financial Services', industry: 'Financial Conglomerates' },
    'SISE.IS': { country: 'Turkey', sector: 'Basic Materials', industry: 'Glass & Glass Products' },
    'BIMAS.IS': { country: 'Turkey', sector: 'Consumer Cyclical', industry: 'Retail' },
    'ASELS.IS': { country: 'Turkey', sector: 'Industrials', industry: 'Aerospace & Defense' },
    'RYGYO.IS': { country: 'Turkey', sector: 'Real Estate', industry: 'REIT - Diversified' },
    'TUPRS.IS': { country: 'Turkey', sector: 'Basic Materials', industry: 'Chemicals' },
    'PETKM.IS': { country: 'Turkey', sector: 'Energy', industry: 'Oil & Gas Refining' },
    'YKBNK.IS': { country: 'Turkey', sector: 'Financial Services', industry: 'Banks' },
    'ISCTR.IS': { country: 'Turkey', sector: 'Financial Services', industry: 'Banks' },
    'VAKBN.IS': { country: 'Turkey', sector: 'Financial Services', industry: 'Banks' },
    'HALKB.IS': { country: 'Turkey', sector: 'Financial Services', industry: 'Banks' },
    'EKGYO.IS': { country: 'Turkey', sector: 'Real Estate', industry: 'REIT - Diversified' },
    'TTKOM.IS': { country: 'Turkey', sector: 'Communication Services', industry: 'Telecom Services' },
    'ENKAI.IS': { country: 'Turkey', sector: 'Industrials', industry: 'Engineering & Construction' },
    'VESTL.IS': { country: 'Turkey', sector: 'Consumer Cyclical', industry: 'Apparel Manufacturing' },
    'ARCLK.IS': { country: 'Turkey', sector: 'Consumer Cyclical', industry: 'Furnishings, Fixtures & Appliances' },
    'TOASO.IS': { country: 'Turkey', sector: 'Consumer Cyclical', industry: 'Auto Parts' },
    'MGROS.IS': { country: 'Turkey', sector: 'Consumer Defensive', industry: 'Grocery Stores' },
    'PGSUS.IS': { country: 'Turkey', sector: 'Industrials', industry: 'Airlines' },
    'SOKM.IS': { country: 'Turkey', sector: 'Consumer Defensive', industry: 'Discount Stores' },
    'AEFES.IS': { country: 'Turkey', sector: 'Consumer Defensive', industry: 'Beverages - Brewers' },
    'DOHOL.IS': { country: 'Turkey', sector: 'Financial Services', industry: 'Financial Conglomerates' },
    'TAVHL.IS': { country: 'Turkey', sector: 'Industrials', industry: 'Airports & Air Services' },

    // Commodities - ALL commodities have country: Global
    'GC=F': { country: 'Global', sector: 'Commodity', industry: 'Precious Metals' },
    'SI=F': { country: 'Global', sector: 'Commodity', industry: 'Precious Metals' },
    'GAUTRY': { country: 'Global', sector: 'Commodity', industry: 'Gold' },
    'XAGTRY': { country: 'Global', sector: 'Commodity', industry: 'Silver' },
    'XAU': { country: 'Global', sector: 'Commodity', industry: 'Gold' },
    'CL=F': { country: 'Global', sector: 'Commodity', industry: 'Crude Oil' },
    'NG=F': { country: 'Global', sector: 'Commodity', industry: 'Natural Gas' },

    // Cryptocurrency
    'BTC-USD': { country: 'Global', sector: 'Cryptocurrency', industry: 'Digital Currency' },
    'ETH-USD': { country: 'Global', sector: 'Cryptocurrency', industry: 'Digital Currency' },
    'BTC-EUR': { country: 'Global', sector: 'Cryptocurrency', industry: 'Digital Currency' },
    'ETH-EUR': { country: 'Global', sector: 'Cryptocurrency', industry: 'Digital Currency' },
    'XRP-USD': { country: 'Global', sector: 'Cryptocurrency', industry: 'Digital Currency' },
    'ADA-USD': { country: 'Global', sector: 'Cryptocurrency', industry: 'Digital Currency' },
    'SOL-USD': { country: 'Global', sector: 'Cryptocurrency', industry: 'Digital Currency' },

    // European Stocks
    'ASML.AS': { country: 'Netherlands', sector: 'Technology', industry: 'Semiconductor Equipment & Materials' },
    'RABO.AS': { country: 'Netherlands', sector: 'Financial Services', industry: 'Banks' },
    'SHELL.AS': { country: 'Netherlands', sector: 'Energy', industry: 'Oil & Gas Integrated' },
    'ADYEN.AS': { country: 'Netherlands', sector: 'Technology', industry: 'Software - Infrastructure' },
};

export function getManualMapping(originalSymbol: string, searchSymbol: string): SymbolProfile | null {
    // Try exact match on search symbol first
    if (MANUAL_MAPPINGS[searchSymbol]) {
        return MANUAL_MAPPINGS[searchSymbol];
    }

    // Try original symbol
    if (MANUAL_MAPPINGS[originalSymbol]) {
        return MANUAL_MAPPINGS[originalSymbol];
    }

    // Try without exchange suffix (e.g., FROTO → FROTO.IS)
    const baseSymbol = searchSymbol.split('.')[0];
    const withIS = `${baseSymbol}.IS`;
    if (MANUAL_MAPPINGS[withIS]) {
        return MANUAL_MAPPINGS[withIS];
    }

    // Try uppercase variations
    const upperSearch = searchSymbol.toUpperCase();
    if (MANUAL_MAPPINGS[upperSearch]) {
        return MANUAL_MAPPINGS[upperSearch];
    }

    return null;
}

export function addManualMapping(symbol: string, profile: SymbolProfile): void {
    MANUAL_MAPPINGS[symbol] = profile;
}

export function getAllManualMappings(): Record<string, SymbolProfile> {
    return { ...MANUAL_MAPPINGS };
}
