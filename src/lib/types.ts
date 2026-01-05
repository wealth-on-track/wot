export interface AssetDisplay {
    id: string;
    symbol: string;
    name?: string | null;
    type: string;
    quantity: number;
    buyPrice: number;
    currency: string;
    currentPrice: number;
    totalValueEUR: number;
    plPercentage: number;
    exchange?: string;
    sector?: string;
    country?: string;
    dailyChange?: number;
    dailyChangePercentage?: number;
    platform?: string;
    customGroup?: string | null;
    rank?: number;
    location?: string | null;
    ownerCode?: string | null;
    assetClass?: string | null;
    assetSubClass?: string | null;
    market?: string | null;
    nextEarningsDate?: Date | null;
    marketState?: string;
}
