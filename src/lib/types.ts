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
}
