"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getGoals() {
    const session = await auth();
    let userId = session?.user?.id;

    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        userId = user?.id;
    }

    if (!userId) return [];

    const portfolio = await prisma.portfolio.findUnique({
        where: { userId },
        include: { goals: { orderBy: { createdAt: 'asc' } } }
    });

    return portfolio?.goals || [];
}


export async function createGoal(data: { name: string; targetAmount: number; currentAmount?: number; currency?: string; deadline?: Date; icon?: string }) {
    const session = await auth();
    let userId = session?.user?.id;

    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        userId = user?.id;
    }

    if (!userId) {
        console.warn("Unauthorized: No user ID found in session or DB fallback");
        throw new Error("Unauthorized");
    }

    const portfolio = await prisma.portfolio.findUnique({
        where: { userId }
    });

    if (!portfolio) throw new Error("Portfolio not found");

    await prisma.goal.create({
        data: {
            portfolioId: portfolio.id,
            name: data.name,
            targetAmount: data.targetAmount,
            currentAmount: data.currentAmount || 0,
            currency: data.currency || "EUR",
            deadline: data.deadline,
            icon: data.icon || "target"
        }
    });

    revalidatePath("/");
}

export async function updateGoal(id: string, data: { name?: string; targetAmount?: number; currentAmount?: number; isCompleted?: boolean; icon?: string }) {
    const session = await auth();
    let userId = session?.user?.id;

    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        userId = user?.id;
    }

    if (!userId) throw new Error("Unauthorized");

    await prisma.goal.update({
        where: { id },
        data
    });

    revalidatePath("/");
}

export async function deleteGoal(id: string) {
    const session = await auth();
    let userId = session?.user?.id;

    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        userId = user?.id;
    }

    if (!userId) throw new Error("Unauthorized");

    await prisma.goal.delete({
        where: { id }
    });

    revalidatePath("/");
}

