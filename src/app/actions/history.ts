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
    transactionCount: number;
    transactions: Array<{
        type: 'BUY' | 'SELL';
        quantity: number;
        price: number;
        date: Date;
        currency: string;
    }>;
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
            portfolio: {
                include: {
                    assets: {
                        select: { symbol: true, type: true, exchange: true, category: true }
                    }
                }
            }
        }
    });

    if (!user?.portfolio) return [];

    // Map assets for type lookup (to help getMarketPrice)
    const assetMap = new Map<string, { type: string, exchange: string, category: string }>();
    user.portfolio.assets.forEach(a => assetMap.set(a.symbol, {
        type: a.type,
        exchange: a.exchange,
        category: a.category
    }));

    // Get all transactions
    const transactions = await prisma.assetTransaction.findMany({
        where: { portfolioId: user.portfolio.id },
        orderBy: { date: 'asc' }
    });

    // Group by symbol
    const grouped = new Map<string, {
        symbol: string;
        name: string;
        buys: { qty: number; price: number; date: Date }[];
        sells: { qty: number; price: number; date: Date }[];
        currency: string;
        lastDate: Date;
        exchange?: string;
        platform?: string;
    }>();

    for (const tx of transactions) {
        if (!grouped.has(tx.symbol)) {
            grouped.set(tx.symbol, {
                symbol: tx.symbol,
                name: tx.name || tx.symbol,
                buys: [],
                sells: [],
                currency: tx.currency,
                lastDate: tx.date,
                exchange: tx.exchange || undefined,
                platform: tx.platform || undefined
            });
        }

        const group = grouped.get(tx.symbol)!;
        if (tx.date > group.lastDate) group.lastDate = tx.date;
        if (tx.name) group.name = tx.name; // Update to latest name

        if (tx.type === 'BUY') {
            group.buys.push({ qty: tx.quantity, price: tx.price, date: tx.date });
        } else if (tx.type === 'SELL') {
            group.sells.push({ qty: tx.quantity, price: tx.price, date: tx.date });
        }
    }

    const closedPositions: ClosedPosition[] = [];

    for (const [symbol, data] of grouped.entries()) {
        const totalBought = data.buys.reduce((acc, t) => acc + t.qty, 0);
        const totalSold = data.sells.reduce((acc, t) => acc + t.qty, 0);

        // Show ALL positions with transaction history
        if (totalBought > 0 || totalSold > 0) {
            const totalInvested = data.buys.reduce((acc, t) => acc + (t.qty * t.price), 0);
            const totalRealized = data.sells.reduce((acc, t) => acc + (t.qty * t.price), 0);

            const realizedPnl = totalRealized - totalInvested;

            closedPositions.push({
                symbol,
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
                transactionCount: data.buys.length + data.sells.length,
                transactions: [
                    ...data.buys.map(t => ({ type: 'BUY' as const, quantity: t.qty, price: t.price, date: t.date, currency: data.currency })),
                    ...data.sells.map(t => ({ type: 'SELL' as const, quantity: t.qty, price: t.price, date: t.date, currency: data.currency }))
                ].sort((a, b) => a.date.getTime() - b.date.getTime())
            });
        }
    }

    // Enrich with current prices in parallel
    // This allows the user to compare exit price with current market price
    await Promise.all(closedPositions.map(async (pos) => {
        // Try to infer type/exchange if not available in transactions
        const assetInfo = assetMap.get(pos.symbol);

        // Inference logic
        let type = assetInfo?.type || 'STOCK';
        let exchange = assetInfo?.exchange || pos.exchange;
        const category = assetInfo?.category?.toString(); // Cast enum to string

        // Heuristics if asset not in DB (deleted)
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
            // console.warn(`Failed to fetch history price for ${pos.symbol}`, e);
        }
    }));

    // Sort by last trade date desc
    return closedPositions.sort((a, b) => b.lastTradeDate.getTime() - a.lastTradeDate.getTime());
}
