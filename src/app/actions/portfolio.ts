"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getUserPortfolios() {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, portfolios: [] };
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { Portfolio: true }
    });

    if (!user) {
        return { success: false, portfolios: [] };
    }

    // For now, return the user's default portfolio
    // In future when you support multiple portfolios, fetch them all here
    const portfolios = user.Portfolio ? [{
        id: user.Portfolio.id,
        name: user.username, // Just username
        isDefault: true
    }] : [];

    return { success: true, portfolios };
}
