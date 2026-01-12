import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { MobileClientWrapper } from "@/components/mobile/MobileClientWrapper";
import { getPortfolioMetrics } from "@/lib/portfolio";
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
            totalValueEUR: a.quantity * a.buyPrice,
            plPercentage: 0,
            dailyChange: 0,
            dailyChangePercentage: 0,
            marketState: 'CLOSED'
        }));
        totalPortfolioValueEUR = assetsWithValues.reduce((sum, a) => sum + a.totalValueEUR, 0);
    }

    // "Next Threshold" Goal Logic
    await import("@/lib/goalUtils").then(m => m.ensureThresholdGoal(user.portfolio!.id, totalPortfolioValueEUR));

    // Re-fetch goals to reflect any potential updates from ensureThresholdGoal
    const displayedGoals = await prisma.goal.findMany({
        where: { portfolioId: user.portfolio!.id },
        orderBy: { createdAt: 'asc' }
    });

    return (
        <MobileClientWrapper
            username={username}
            isOwner={isOwner}
            totalValueEUR={totalPortfolioValueEUR}
            assets={assetsWithValues}
            goals={displayedGoals}
            exchangeRates={rates}
        />
    );
}
