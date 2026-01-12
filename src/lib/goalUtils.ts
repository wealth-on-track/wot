
import { prisma } from "@/lib/prisma";

// Force rebuild after schema change
export async function ensureThresholdGoal(portfolioId: string, currentTotalValue: number) {
    // defined thresholds
    const thresholds = [50000, 100000, 250000, 500000, 1000000, 2500000, 5000000];

    // Find next target with "smart" proximity logic
    let target = thresholds.find(t => t > currentTotalValue);

    // If we've surpassed all thresholds, default to next 1M step
    if (!target) {
        target = Math.ceil(currentTotalValue / 1000000) * 1000000 + 1000000;
    } else {
        // Smart skip: if we are more than 95% of the way to the target, aim for the next one
        if (currentTotalValue / target > 0.95) {
            const nextIndex = thresholds.indexOf(target) + 1;
            if (nextIndex < thresholds.length) {
                target = thresholds[nextIndex];
            } else {
                target = target * 2; // Fallback doubling
            }
        }
    }

    const systemTag = "SYSTEM_THRESHOLD";
    const defaultName = "Next Threshold";

    // Migration & Cleanup: 
    // Find any goals that SHOULD be system goals but aren't tagged yet,
    // or are already tagged.
    const potentialSystemGoals = await prisma.goal.findMany({
        where: {
            portfolioId,
            OR: [
                { type: systemTag },
                { name: "Next Threshold" },
                { name: "Next Target" }
            ]
        },
        orderBy: { createdAt: 'asc' }
    });

    let activeGoal = potentialSystemGoals[0];

    // If we found duplicates/legacy named goals, cleanup and ensure the first one is tagged correctly
    if (potentialSystemGoals.length > 0) {
        if (potentialSystemGoals.length > 1) {
            const idsToDelete = potentialSystemGoals.slice(1).map(g => g.id);
            await prisma.goal.deleteMany({
                where: { id: { in: idsToDelete } }
            });
        }

        // Ensure the active one is tagged so user renaming doesn't break it again
        if (activeGoal.type !== systemTag) {
            activeGoal = await prisma.goal.update({
                where: { id: activeGoal.id },
                data: { type: systemTag }
            });
        }
    }

    if (activeGoal) {
        // Update existing goal if needed
        // Note: we DON'T force update the name here, so the user's custom name ("Next Target") persists
        if (activeGoal.targetAmount !== target || Math.abs(activeGoal.currentAmount - currentTotalValue) > 1) {
            await prisma.goal.update({
                where: { id: activeGoal.id },
                data: {
                    targetAmount: Math.round(target),
                    currentAmount: Math.round(currentTotalValue)
                }
            });
        }
    } else {
        // Create new system goal
        await prisma.goal.create({
            data: {
                portfolioId,
                name: defaultName,
                type: systemTag,
                targetAmount: Math.round(target),
                currentAmount: Math.round(currentTotalValue),
                currency: "EUR"
            }
        });
    }
}
