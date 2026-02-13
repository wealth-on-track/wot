export interface AssetDisplay {
    id: string;
    symbol: string;
    name?: string | null;
    originalName?: string | null;  // Original name from search API (immutable)
    type: string;
    quantity: number;
    buyPrice: number;
    currency: string;
    previousClose: number;
    currentPrice?: number;
    totalValueEUR: number;
    totalCostEUR?: number;   // Server-calculated cost in EUR
    plValueEUR?: number;     // Server-calculated P&L value in EUR
    plPercentage: number;
    exchange: string;
    sector: string;
    country: string;
    platform?: string;
    customGroup?: string | null;
    logoUrl?: string | null;
    updatedAt?: Date | string;
    metadata?: any;  // For BES and other special asset types
    // Daily change
    dailyChange?: number;
    dailyChangePercentage?: number;
    marketState?: string;
    nextOpen?: Date | null;
    nextClose?: Date | null;
    // Historical performance (server-calculated in EUR)
    changePercent1D?: number;
    changePercent1W?: number;
    changePercent1M?: number;
    changePercentYTD?: number;
    changePercent1Y?: number;
    // Value in asset's original currency
    totalValueInAssetCurrency?: number;
    totalCostInAssetCurrency?: number;
}
