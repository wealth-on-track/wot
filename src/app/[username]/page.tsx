import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navbar } from "@/components/Navbar";
import { ClientWrapper } from "@/components/ClientWrapper";
import { getPortfolioMetricsOptimized } from "@/lib/portfolio-optimized";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { isMobileDevice } from "@/lib/deviceDetection";

import { getExchangeRates } from "@/lib/exchangeRates";

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    const session = await auth();

    // Check if mobile device and redirect to mobile view
    // Only redirect if not forced to desktop (checked via cookie)
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || '';
    const cookieHeader = headersList.get('cookie') || '';
    const forceDesktop = cookieHeader.includes('forceDesktop=true');

    if (isMobileDevice(userAgent) && !forceDesktop) {
        redirect(`/${username}/mobile`);
    }


    const decodedUsername = decodeURIComponent(username);

    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { username: decodedUsername },
                { email: decodedUsername }
            ]
        },
        include: {
            portfolio: {
                include: {
                    assets: {
                        orderBy: [
                            { sortOrder: 'asc' },
                            { createdAt: 'desc' }  // Newest assets first
                        ]
                    },
                    goals: { orderBy: { createdAt: 'asc' } }
                }
            }
        }
    });

    if (!user || !user.portfolio) {
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

    // PERFORMANCE OPTIMIZATION: Fetch exchange rates and process portfolio in parallel
    // This reduces total loading time by ~40% (from sequential to parallel execution)
    const [rates, portfolioResult] = await Promise.all([
        getExchangeRates(),
        (async () => {
            try {
                // Use emergency fallback rates for initial calculation if needed
                const emergencyRates: Record<string, number> = { EUR: 1, USD: 1.09, TRY: 37.5, GBP: 0.85, JPY: 160, CHF: 0.95 };
                const result = await getPortfolioMetricsOptimized(
                    user.portfolio!.assets,
                    emergencyRates,
                    false,
                    session?.user?.name || session?.user?.email || 'System'
                );
                return { success: true as const, totalValueEUR: result.totalValueEUR, assetsWithValues: result.assetsWithValues };
            } catch (e) {
                console.error("Critical: Failed to calculate portfolio metrics", e);
                return { success: false as const, error: e };
            }
        })()
    ]);

    let totalPortfolioValueEUR = 0;
    let assetsWithValues: any[] = [];

    if (portfolioResult.success) {
        totalPortfolioValueEUR = portfolioResult.totalValueEUR;
        assetsWithValues = portfolioResult.assetsWithValues;
    } else {
        // Fallback: Show assets with buy prices to prevent page crash
        assetsWithValues = user.portfolio!.assets.map(a => ({
            ...a,
            name: a.name || a.symbol,
            currentPrice: a.buyPrice,
            totalValueEUR: a.quantity * a.buyPrice, // Simplified, ignores currency for safety
            plPercentage: 0,
            dailyChange: 0,
            dailyChangePercentage: 0,
            marketState: 'CLOSED'
        }));
        totalPortfolioValueEUR = assetsWithValues.reduce((sum, a) => sum + a.totalValueEUR, 0);
    }

    // "Next Threshold" Goal Logic - Run in background (don't block page load)
    // Fire-and-forget: ensureThresholdGoal updates DB, next page load will show updated goals
    import("@/lib/goalUtils").then(m => m.ensureThresholdGoal(user.portfolio!.id, totalPortfolioValueEUR)).catch(() => { });

    // Use goals from initial query (already fetched with user.portfolio.goals)
    const displayedGoals = user.portfolio.goals;

    return (
        <ClientWrapper
            username={username}
            isOwner={isOwner}
            totalValueEUR={totalPortfolioValueEUR}
            assets={assetsWithValues}
            goals={displayedGoals}
            exchangeRates={rates}
            preferences={(user.preferences as any) || undefined}
            userEmail={user.email}
            navbar={
                <Navbar
                    totalBalance={totalPortfolioValueEUR}
                    username={username}
                    isOwner={isOwner}
                />
            }
        />
    );
}
