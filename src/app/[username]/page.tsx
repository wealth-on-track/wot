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

    // @ts-ignore - Prisma Client type mismatch workaround
    let user = await prisma.user.findFirst({
        where: {
            OR: [
                { username: decodedUsername },
                { email: decodedUsername }
            ]
        },
        include: {
            Portfolio: { // Capitalized Relation workaround
                include: {
                    Asset: { // Capitalized Relation workaround
                        orderBy: [
                            { sortOrder: 'asc' },
                            { createdAt: 'desc' }  // Newest assets first
                        ]
                    },
                    Goal: { orderBy: { createdAt: 'asc' } } // Capitalized
                }
            }
        }
    });

    // Workaround: Map capitalized Portfolio back to lowercase property for compatibility
    if (user && (user as any).Portfolio) {
        (user as any).portfolio = (user as any).Portfolio;
        // Map capitalized relations
        if ((user as any).portfolio.Asset) {
            (user as any).portfolio.assets = (user as any).portfolio.Asset;
        }
        if ((user as any).portfolio.Goal) {
            (user as any).portfolio.goals = (user as any).portfolio.Goal;
        }
    }

    if (!user || !(user as any).portfolio) {
        console.warn(`[Dashboard] User not found by username "${decodedUsername}". Trying email fallback...`);
        // @ts-ignore - Prisma Client type mismatch workaround
        const fallbackUser = await prisma.user.findFirst({
            where: { email: decodedUsername },
            include: {
                Portfolio: { // Capitalized Relation workaround
                    include: {
                        Asset: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] },
                        Goal: { orderBy: { createdAt: 'asc' } }
                    }
                }
            }
        });

        if (fallbackUser && (fallbackUser as any).Portfolio) {
            (fallbackUser as any).portfolio = (fallbackUser as any).Portfolio;
            // Map capitalized relations
            if ((fallbackUser as any).portfolio.Asset) {
                (fallbackUser as any).portfolio.assets = (fallbackUser as any).portfolio.Asset;
            }
            if ((fallbackUser as any).portfolio.Goal) {
                (fallbackUser as any).portfolio.goals = (fallbackUser as any).portfolio.Goal;
            }
        }

        if (!fallbackUser || !(fallbackUser as any).portfolio) {
            // User not found - redirect to login with error
            redirect('/login?error=UserNotFound');
        }
        user = fallbackUser;
    }

    const isOwner = session?.user?.email === user.email;

    // SECURITY: Prevent unauthorized access to private portfolios
    // Only allow access if user is viewing their own portfolio
    // Exception: demo portfolio is publicly accessible
    if (!isOwner && decodedUsername.toLowerCase() !== 'demo') {
        // User is trying to view someone else's portfolio - redirect to login
        // User is trying to view someone else's portfolio - redirect to login
        redirect('/login');
    }

    // Fetch exchange rates first, then calculate portfolio with REAL rates
    // This ensures server-side values match client-side recalculations
    const rates = await getExchangeRates();

    let portfolioResult: { success: true; totalValueEUR: number; assetsWithValues: any[] } | { success: false; error: unknown };
    try {
        const result = await getPortfolioMetricsOptimized(
            (user as any).portfolio!.assets,
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
        assetsWithValues = (user as any).portfolio!.assets.map((a: any) => {
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
    // Fire-and-forget: ensureThresholdGoal updates DB, next page load will show updated goals
    import("@/lib/goalUtils").then(m => m.ensureThresholdGoal((user as any).portfolio!.id, totalPortfolioValueEUR)).catch(() => { });

    // FETCH TRANSACTIONS & ATTACH TO ASSETS (Server-Side)
    // This allows FullScreenLayout to display transaction history for open positions
    const transactions = await prisma.assetTransaction.findMany({
        where: { portfolioId: (user as any).portfolio!.id },
        orderBy: { date: 'desc' }
    });

    // Attach transactions to assets using the same fuzzy matching logic as actions.ts
    assetsWithValues = assetsWithValues.map(asset => {
        const assetGroup = (asset as any).customGroup || null;

        const assetTxs = transactions.filter(t => {
            const txGroup = t.customGroup || null;

            // CRITICAL: First check customGroup matches (EAK vs TAK)
            // This prevents transactions from one sub-portfolio appearing in another
            if (assetGroup !== txGroup) return false;

            // 1. Strict Symbol Match
            if (t.symbol === asset.symbol) return true;
            // 2. Original Name/Symbol Match (if imported)
            if (asset.originalName && (t.symbol === asset.originalName || t.name === asset.originalName)) return true;
            // 3. Name Match (fallback)
            if (t.name === asset.name) return true;

            return false;
        });

        return {
            ...asset,
            transactions: assetTxs
        };
    });


    // Use goals from initial query (already fetched with user.portfolio.goals)
    const displayedGoals = (user as any).portfolio!.goals;

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
