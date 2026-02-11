import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { MobileClientWrapper } from "@/components/mobile/MobileClientWrapper";
import { getPortfolioMetricsOptimized } from "@/lib/portfolio-optimized";
import { prisma } from "@/lib/prisma";
import { getExchangeRates } from "@/lib/exchangeRates";

export const dynamic = 'force-dynamic';

export default async function MobilePortfolioPage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    const session = await auth();

    const decodedUsername = decodeURIComponent(username);

    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { username: decodedUsername },
                { email: decodedUsername }
            ]
        },
        include: {
            Portfolio: {
                include: {
                    Asset: {
                        orderBy: [
                            { sortOrder: 'asc' },
                            { createdAt: 'desc' }  // Newest assets first
                        ]
                    },
                    Goal: { orderBy: { createdAt: 'asc' } }
                }
            }
        }
    });

    if (!user || !user.Portfolio) {
        notFound();
    }

    const isOwner = session?.user?.email === user.email;

    // SECURITY: Prevent unauthorized access to private portfolios
    // Only allow access if user is viewing their own portfolio
    // Exception: demo portfolio is publicly accessible
    if (!isOwner && decodedUsername.toLowerCase() !== 'demo') {
        // User is trying to view someone else's portfolio - redirect to login
        redirect('/login');
    }

    // Fetch exchange rates first, then calculate portfolio with REAL rates
    // This ensures mobile and web views show consistent values
    const rates = await getExchangeRates();

    let portfolioResult: { success: true; totalValueEUR: number; assetsWithValues: any[] } | { success: false; error: unknown };
    try {
        const result = await getPortfolioMetricsOptimized(
            user.Portfolio!.Asset,
            rates,  // Use REAL rates, not emergency fallback
            false,
            session?.user?.name || session?.user?.email || 'System'
        );
        portfolioResult = { success: true as const, totalValueEUR: result.totalValueEUR, assetsWithValues: result.assetsWithValues };
    } catch (e) {
        console.error("Critical: Failed to calculate portfolio metrics", e);
        portfolioResult = { success: false as const, error: e };
    }

    let totalPortfolioValueEUR = 0;
    let assetsWithValues: any[] = [];

    if (portfolioResult.success) {
        totalPortfolioValueEUR = portfolioResult.totalValueEUR;
        assetsWithValues = portfolioResult.assetsWithValues;
    } else {
        // Fallback: Show assets with buy prices to prevent page crash
        // CRITICAL: Must convert to EUR using exchange rates!
        assetsWithValues = user.Portfolio!.Asset.map(a => {
            const valueInCurrency = a.quantity * a.buyPrice;
            const rate = rates[a.currency] || 1;
            const valueEUR = valueInCurrency / rate;
            return {
                ...a,
                name: a.name || a.symbol,
                currentPrice: a.buyPrice,
                totalValueEUR: valueEUR,
                plPercentage: 0,
                dailyChange: 0,
                dailyChangePercentage: 0,
                marketState: 'CLOSED'
            };
        });
        totalPortfolioValueEUR = assetsWithValues.reduce((sum, a) => sum + a.totalValueEUR, 0);
    }

    // "Next Threshold" Goal Logic - Run in background (don't block page load)
    import("@/lib/goalUtils").then(m => m.ensureThresholdGoal(user.Portfolio!.id, totalPortfolioValueEUR)).catch(() => { });

    // Use goals from initial query (already fetched)
    const displayedGoals = user.Portfolio.Goal;

    return (
        <MobileClientWrapper
            username={username}
            isOwner={isOwner}
            totalValueEUR={totalPortfolioValueEUR}
            assets={assetsWithValues}
            goals={displayedGoals}
            exchangeRates={rates}
            preferences={user.preferences}
        />
    );
}
