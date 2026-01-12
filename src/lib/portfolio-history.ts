
import { prisma } from "@/lib/prisma";

/**
 * Saves or updates a daily snapshot of the total portfolio value.
 * This should be called whenever portfolio prices are successfully refreshed.
 */
export async function savePortfolioSnapshot(portfolioId: string, totalValueEUR: number) {
    if (!portfolioId) return;

    // Normalize date to today at midnight UTC to ensure uniqueness per day
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    try {
        await prisma.portfolioSnapshot.upsert({
            where: {
                portfolioId_date: {
                    portfolioId,
                    date: today
                }
            },
            update: {
                totalValue: totalValueEUR,
                // We update createdAt or maybe add an updatedAt field later if needed,
                // but just updating totalValue is enough to keep the latest value for "today".
            },
            create: {
                portfolioId,
                date: today,
                totalValue: totalValueEUR
            }
        });
        console.log(`[Snapshot] Saved for portfolio ${portfolioId} value: €${totalValueEUR}`);
    } catch (error) {
        console.error("[Snapshot] Failed to save portfolio snapshot:", error);
    }
}
