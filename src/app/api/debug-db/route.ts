
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET() {
    try {
        // Bypass auth for debug
        const user = await prisma.user.findFirst({
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) return NextResponse.json({ error: 'Portfolio not found' });

        const assets = await prisma.asset.findMany({
            where: { portfolioId: user.Portfolio.id },
            select: { symbol: true, quantity: true, customGroup: true, id: true }
        });

        // Select specific fields to avoid "Unknown field" error if runtime is still stale
        // But we WANT to check if customGroup exists. 
        // We'll try to select it. If it fails, we know runtime is stale.
        const transactions = await prisma.assetTransaction.findMany({
            where: { portfolioId: user.Portfolio.id },
            // select: { symbol: true, quantity: true, type: true, customGroup: true, date: true } // Commented out to just get all and see what happens or specific
        });

        return NextResponse.json({
            user: user.email,
            assets,
            transactions: transactions.slice(0, 10).map(t => ({
                ...t,
                customGroup: (t as any).customGroup // Cast to any to see if it exists at runtime
            }))
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.toString() }, { status: 500 });
    }
}
