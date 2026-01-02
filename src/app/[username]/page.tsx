import { notFound } from "next/navigation";
import { auth } from "@/auth";
import Dashboard from "@/components/DashboardV2";
import { Navbar } from "@/components/Navbar";
import { ClientWrapper } from "@/components/ClientWrapper";
import { getPortfolioMetrics } from "@/lib/portfolio";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    const session = await auth();

    const user = await prisma.user.findUnique({
        where: { username },
        include: {
            portfolio: {
                include: { assets: true }
            }
        }
    });

    if (!user || !user.portfolio) {
        notFound();
    }

    const isOwner = session?.user?.email === user.email;

    // Process Assets using shared logic
    const { totalValueEUR: totalPortfolioValueEUR, assetsWithValues } = await getPortfolioMetrics(user.portfolio.assets);
    return (
        <ClientWrapper
            username={username}
            isOwner={isOwner}
            totalValueEUR={totalPortfolioValueEUR}
            assets={assetsWithValues}
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
