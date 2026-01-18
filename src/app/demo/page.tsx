
import { Navbar } from "@/components/Navbar";
import { ClientWrapper } from "@/components/ClientWrapper";

// PERFORMANCE: Use ISR with 1-hour revalidation instead of force-dynamic
// This eliminates the 15-20 second loading delay from getExchangeRates()
export const revalidate = 3600; // Revalidate every 1 hour

export default async function DemoPage() {
    // PERFORMANCE FIX: Use static exchange rates for demo page
    // This eliminates the slow database + API calls on every page load
    // Rates are approximate and updated via ISR every hour
    const rates: Record<string, number> = {
        EUR: 1,
        USD: 1.09,
        TRY: 37.5,
        GBP: 0.85,
        JPY: 160,
        CHF: 0.95
    };

    // 2. Mock Data Construction
    const mockAssets = [
        {
            id: 'demo-btc',
            symbol: 'BTC',
            name: 'Bitcoin',
            type: 'CRYPTO',
            quantity: 0.45,
            buyPrice: 42000, // Bought cheap
            currentPrice: 98000, // High current price
            currency: 'USD',
            exchange: 'Crypto',
            logoUrl: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=026',
            category: 'CRYPTO'
        },
        {
            id: 'demo-nvda',
            symbol: 'NVDA',
            name: 'NVIDIA Corp',
            type: 'STOCK',
            quantity: 50,
            buyPrice: 450,
            currentPrice: 920,
            currency: 'USD',
            exchange: 'NASDAQ',
            category: 'US_MARKETS'
        },
        {
            id: 'demo-eth',
            symbol: 'ETH',
            name: 'Ethereum',
            type: 'CRYPTO',
            quantity: 12.5,
            buyPrice: 1800,
            currentPrice: 3400,
            currency: 'USD',
            exchange: 'Crypto',
            category: 'CRYPTO'
        },
        {
            id: 'demo-sp500',
            symbol: 'VOO',
            name: 'Vanguard S&P 500 ETF',
            type: 'ETF',
            quantity: 100,
            buyPrice: 350,
            currentPrice: 480,
            currency: 'USD',
            exchange: 'NYSE',
            category: 'US_MARKETS'
        },
        {
            id: 'demo-tesla',
            symbol: 'TSLA',
            name: 'Tesla Inc',
            type: 'STOCK',
            quantity: 200,
            buyPrice: 240,
            currentPrice: 180, // Loss example
            currency: 'USD',
            exchange: 'NASDAQ',
            category: 'US_MARKETS'
        }
    ];

    // 3. Enrich Assets with Calculations matches ProfilePage logic
    const preparedAssets = mockAssets.map(asset => {
        const rate = rates[asset.currency] || 1; // EUR rate
        // Price in Base Currency
        const currentPriceBase = asset.currentPrice;
        const buyPriceBase = asset.buyPrice;

        // Convert to EUR
        // Rate is EUR/X. So divide.
        // wait, getExchangeRates returns EUR price? 
        // No, lib/exchangeRates returns values like USD=1.09 (meaning 1 EUR = 1.09 USD).
        // So to get EUR, we divide by rate.
        const pxInEUR = currentPriceBase / rate;
        const costInEUR = buyPriceBase / rate;

        const totalValueEUR = asset.quantity * pxInEUR;
        const totalCostEUR = asset.quantity * costInEUR;

        const pl = totalValueEUR - totalCostEUR;
        const plPercentage = (pl / totalCostEUR) * 100;

        return {
            ...asset,
            currentPrice: currentPriceBase, // Keep original currency price for display
            totalValueEUR,
            totalCostEUR,
            pl,
            plPercentage,
            dailyChange: asset.currentPrice * 0.02, // Mock 2% change
            dailyChangePercentage: 2.0,
            marketState: 'OPEN'
        };
    });

    const totalPortfolioValueEUR = preparedAssets.reduce((acc, curr) => acc + curr.totalValueEUR, 0);

    const mockGoals = [
        {
            id: 'goal-1',
            name: 'Retirement Fund',
            targetAmount: 1000000,
            currentAmount: totalPortfolioValueEUR * 0.8, // 80% allocated
            currency: 'EUR',
            category: 'RETIREMENT',
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: 'goal-2',
            name: 'New House',
            targetAmount: 300000,
            currentAmount: 150000,
            currency: 'EUR',
            category: 'SAVINGS',
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    return (
        <ClientWrapper
            username="demo"
            isOwner={true} // Enable full UI
            totalValueEUR={totalPortfolioValueEUR}
            assets={preparedAssets}
            goals={mockGoals}
            exchangeRates={rates}
            navbar={
                <Navbar
                    totalBalance={totalPortfolioValueEUR}
                    username="Demo User"
                    isOwner={true}
                />
            }
        />
    );
}
