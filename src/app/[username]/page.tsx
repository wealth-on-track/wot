import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import Dashboard from "@/components/DashboardV2";
import { Navbar } from "@/components/Navbar";
import { ClientWrapper } from "@/components/ClientWrapper";
import { getPortfolioMetrics } from "@/lib/portfolio";
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

    // Fetch dynamic rates
    const rates = await getExchangeRates();

    // Process Assets using shared logic with dynamic rates
    let totalPortfolioValueEUR = 0;
    let assetsWithValues: any[] = [];

    try {
        const result = await getPortfolioMetrics(user.portfolio.assets, rates, false, session?.user?.name || session?.user?.email || 'System');
        totalPortfolioValueEUR = result.totalValueEUR;
        assetsWithValues = result.assetsWithValues;
    } catch (e) {
        console.error("Critical: Failed to calculate portfolio metrics", e);
        // Fallback: Show assets with buy prices to prevent page crash
        assetsWithValues = user.portfolio.assets.map(a => ({
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

    // "Next Threshold" Goal Logic
    // Automatically manage the smart goal based on current portfolio value
    await import("@/lib/goalUtils").then(m => m.ensureThresholdGoal(user.portfolio!.id, totalPortfolioValueEUR));

    // Re-fetch goals to reflect any potential updates from ensureThresholdGoal
    const displayedGoals = await prisma.goal.findMany({
        where: { portfolioId: user.portfolio!.id },
        orderBy: { createdAt: 'asc' }
    });

    return (
        <ClientWrapper
            username={username}
            isOwner={isOwner}
            totalValueEUR={totalPortfolioValueEUR}
            assets={assetsWithValues}
            goals={displayedGoals}
            exchangeRates={rates}
            preferences={(user.preferences as any) || undefined}
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
