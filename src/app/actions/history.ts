"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMarketPrice } from "@/services/marketData";

export interface ClosedPosition {
    symbol: string;
    name: string;
    totalQuantityBought: number;
    totalQuantitySold: number;
    totalInvested: number;
    totalRealized: number;
    realizedPnl: number;
    currency: string;
    lastTradeDate: Date;
    exchange?: string;
    platform?: string;
    customGroup?: string;
    type?: string;     // Added
    logoUrl?: string;  // Added
    transactionCount: number;
    transactions: Array<{
        id: string;
        type: 'BUY' | 'SELL' | 'DIVIDEND' | 'INTEREST' | 'COUPON' | 'STAKING';
        quantity: number;
        price: number;
        date: Date;
        currency: string;
    }>;
    // Rewards summary
    totalRewards: number;  // Total quantity received as rewards
    rewardCount: number;   // Number of reward transactions
    currentPrice?: number;
}

/**
 * Fetch closed positions by aggregating transactions
 */
export async function getClosedPositions(): Promise<ClosedPosition[]> {
    const session = await auth();
    if (!session?.user?.email) return [];

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            Portfolio: {
                include: {
                    Asset: {
                        select: { symbol: true, type: true, exchange: true, category: true, quantity: true, customGroup: true, logoUrl: true }
                    }
                }
            }
        }
    });

    if (!user?.Portfolio) return [];

    // Map assets for type lookup and quantity check using COMPOSITE KEY
    const assetMap = new Map<string, { type: string, exchange: string, category: string, customGroup?: string, logoUrl?: string }>();
    const quantityMap = new Map<string, number>();

    user.Portfolio.Asset.forEach(a => {
        const key = `${a.symbol}|${a.customGroup || ''}`;
        assetMap.set(key, {
            type: a.type,
            exchange: a.exchange,
            category: a.category,
            customGroup: a.customGroup || undefined,
            logoUrl: a.logoUrl || undefined
        });
        quantityMap.set(key, a.quantity);
    });

    // Get all transactions
    const transactions = await prisma.assetTransaction.findMany({
        where: { portfolioId: user.Portfolio.id },
        orderBy: { date: 'asc' }
    });

    // Group by symbol AND customGroup
    const grouped = new Map<string, {
        symbol: string;
        name: string;
        buys: { id: string; qty: number; price: number; date: Date }[];
        sells: { id: string; qty: number; price: number; date: Date }[];
        rewards: { id: string; qty: number; price: number; date: Date; type: 'DIVIDEND' | 'INTEREST' | 'COUPON' | 'STAKING' }[];
        currency: string;
        lastDate: Date;
        exchange?: string;
        platform?: string;
        customGroup?: string;
    }>();

    for (const tx of transactions) {
        // key includes customGroup to separate same-symbol assets in different groups
        const key = `${tx.symbol}|${tx.customGroup || ''}`;

        if (!grouped.has(key)) {
            grouped.set(key, {
                symbol: tx.symbol,
                name: tx.name || tx.symbol,
                buys: [],
                sells: [],
                rewards: [],
                currency: tx.currency,
                lastDate: tx.date,
                exchange: tx.exchange || undefined,
                platform: tx.platform || undefined,
                customGroup: tx.customGroup || undefined
            });
        }

        const group = grouped.get(key)!;
        if (tx.date > group.lastDate) group.lastDate = tx.date;
        if (tx.name) group.name = tx.name; // Update to latest name

        if (tx.type === 'BUY') {
            group.buys.push({ id: tx.id, qty: tx.quantity, price: tx.price, date: tx.date });
        } else if (tx.type === 'SELL') {
            group.sells.push({ id: tx.id, qty: tx.quantity, price: tx.price, date: tx.date });
        } else if (tx.type === 'DIVIDEND' || tx.type === 'INTEREST' || tx.type === 'COUPON' || tx.type === 'STAKING') {
            group.rewards.push({ id: tx.id, qty: tx.quantity, price: tx.price, date: tx.date, type: tx.type as 'DIVIDEND' | 'INTEREST' | 'COUPON' | 'STAKING' });
        }
    }

    const closedPositions: ClosedPosition[] = [];

    for (const [key, data] of grouped.entries()) {
        const assetInfo = assetMap.get(key);
        const totalBought = data.buys.reduce((acc, t) => acc + t.qty, 0);
        const totalSold = data.sells.reduce((acc, t) => acc + t.qty, 0);
        const currentQty = quantityMap.get(key) ?? 0;

        // Condition for Closed Position:
        // 1. Must have history (bought or sold)
        // 2. Current Quantity in DB must be <= 0.000001 (Floating point tolerance)
        // This handles cases where totalBought != totalSold (e.g. external deposits) correctly.
        const isClosed = currentQty <= 0.000001;

        if ((totalBought > 0 || totalSold > 0) && isClosed) {
            const totalInvested = data.buys.reduce((acc, t) => acc + (t.qty * t.price), 0);
            const totalRealized = data.sells.reduce((acc, t) => acc + (t.qty * t.price), 0);
            const totalRewards = data.rewards.reduce((acc, t) => acc + t.qty, 0);

            const realizedPnl = totalRealized - totalInvested;

            closedPositions.push({
                symbol: data.symbol,
                name: data.name,
                totalQuantityBought: totalBought,
                totalQuantitySold: totalSold,
                totalInvested,
                totalRealized,
                realizedPnl,
                currency: data.currency,
                lastTradeDate: data.lastDate,
                exchange: data.exchange,
                platform: data.platform,
                customGroup: data.customGroup || assetInfo?.customGroup,
                type: assetInfo?.type,         // Added
                logoUrl: assetInfo?.logoUrl,   // Added
                transactionCount: data.buys.length + data.sells.length + data.rewards.length,
                totalRewards,
                rewardCount: data.rewards.length,
                transactions: [
                    ...data.buys.map(t => ({ id: t.id, type: 'BUY' as const, quantity: t.qty, price: t.price, date: t.date, currency: data.currency })),
                    ...data.sells.map(t => ({ id: t.id, type: 'SELL' as const, quantity: t.qty, price: t.price, date: t.date, currency: data.currency })),
                    ...data.rewards.map(t => ({ id: t.id, type: t.type, quantity: t.qty, price: t.price, date: t.date, currency: data.currency }))
                ].sort((a, b) => a.date.getTime() - b.date.getTime())
            });
        }
    }

    // Enrich with current prices in parallel
    await Promise.all(closedPositions.map(async (pos) => {
        const assetInfo = assetMap.get(pos.symbol);

        // Inference logic
        let type = assetInfo?.type || 'STOCK';
        let exchange = assetInfo?.exchange || pos.exchange;
        const category = assetInfo?.category?.toString();

        if (!assetInfo) {
            if (pos.exchange === 'BINANCE' || pos.exchange === 'COINBASE') type = 'CRYPTO';
            else if (pos.exchange === 'TEFAS') type = 'FUND';
        }

        try {
            const result = await getMarketPrice(pos.symbol, type, exchange, false, 'History', category);
            if (result && result.price) {
                pos.currentPrice = result.price;
            }
        } catch (e) {
            // Ignore price fetch errors for history
        }
    }));

    return closedPositions.sort((a, b) => b.lastTradeDate.getTime() - a.lastTradeDate.getTime());
}

/**
 * Delete a single transaction by ID
 */
export async function deleteTransaction(transactionId: string) {
    const session = await auth();
    if (!session?.user?.email) return { error: "Not authenticated" };

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) return { error: "Portfolio not found" };

        const transaction = await prisma.assetTransaction.findUnique({
            where: { id: transactionId }
        });

        if (!transaction || transaction.portfolioId !== user.Portfolio.id) {
            return { error: "Unauthorized" };
        }

        await prisma.assetTransaction.delete({
            where: { id: transactionId }
        });

        return { success: true };
    } catch (error) {
        console.error('[deleteTransaction] Error:', error);
        return { error: "Failed to delete transaction" };
    }
}

export async function deleteAllTransactionsForSymbol(symbol: string, customGroup?: string) {
    const session = await auth();
    if (!session?.user?.email) return { error: "Not authenticated" };

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) return { error: "Portfolio not found" };

        // Filter by both symbol AND customGroup to prevent cross-portfolio deletion
        await prisma.assetTransaction.deleteMany({
            where: {
                portfolioId: user.Portfolio.id,
                symbol: symbol,
                customGroup: customGroup || null
            }
        });

        return { success: true };
    } catch (error) {
        console.error('[deleteAllTransactionsForSymbol] Error:', error);
        return { error: "Failed to delete transactions" };
    }
}

/**
 * Add a manual transaction to an existing asset (or new one by symbol)
 */
export async function addTransaction(data: {
    symbol: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    date: Date;
    currency?: string;
    exchange?: string;
    customGroup?: string; // Sub-portfolio (EAK, TAK, etc.)
}) {
    const session = await auth();
    if (!session?.user?.email) return { error: "Not authenticated" };

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) return { error: "Portfolio not found" };

        const transaction = await prisma.assetTransaction.create({
            data: {
                portfolioId: user.Portfolio.id,
                symbol: data.symbol,
                type: data.type,
                quantity: data.quantity,
                price: data.price,
                date: data.date,
                currency: data.currency || 'USD', // Default fallback
                exchange: data.exchange,
                name: data.symbol, // Optional, can be enriched later
                customGroup: data.customGroup || null
            }
        });

        return { success: true, transaction };
    } catch (error) {
        console.error('[addTransaction] Error:', error);
        return { error: "Failed to add transaction" };
    }
}

/**
 * Update an existing transaction
 */
export async function updateTransaction(transactionId: string, data: {
    type?: 'BUY' | 'SELL';
    quantity?: number;
    price?: number;
    date?: Date;
}) {
    const session = await auth();
    if (!session?.user?.email) return { error: "Not authenticated" };

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) return { error: "Portfolio not found" };

        const transaction = await prisma.assetTransaction.findUnique({
            where: { id: transactionId }
        });

        if (!transaction || transaction.portfolioId !== user.Portfolio.id) {
            return { error: "Unauthorized" };
        }

        const updated = await prisma.assetTransaction.update({
            where: { id: transactionId },
            data: {
                type: data.type,
                quantity: data.quantity,
                price: data.price,
                date: data.date
            }
        });

        return { success: true, transaction: updated };
    } catch (error) {
        console.error('[updateTransaction] Error:', error);
        return { error: "Failed to update transaction" };
    }
}
