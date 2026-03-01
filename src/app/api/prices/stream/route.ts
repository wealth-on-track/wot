import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMarketPrice, convertCurrency } from "@/services/marketData";

const BATCH_SIZE = 5;

export async function GET(request: NextRequest) {
    // Auth check
    const session = await auth();
    if (!session?.user?.email) {
        return new Response("Unauthorized", { status: 401 });
    }

    // Get symbols from query
    const searchParams = request.nextUrl.searchParams;
    const symbolsParam = searchParams.get("symbols");
    const portfolioId = searchParams.get("portfolioId");

    if (!symbolsParam && !portfolioId) {
        return new Response("Missing symbols or portfolioId", { status: 400 });
    }

    // Get symbols either from param or from portfolio
    let symbols: string[] = [];
    let assetMap: Map<string, { type: string; exchange: string; currency: string; quantity: number }> = new Map();

    if (portfolioId) {
        // Fetch assets from portfolio
        const assets = await prisma.asset.findMany({
            where: { portfolioId },
            select: {
                symbol: true,
                type: true,
                exchange: true,
                currency: true,
                quantity: true
            }
        });

        symbols = assets
            .filter(a => a.type !== 'CASH' && a.type !== 'BES')
            .map(a => a.symbol);

        assets.forEach(a => {
            assetMap.set(a.symbol, {
                type: a.type,
                exchange: a.exchange,
                currency: a.currency,
                quantity: a.quantity
            });
        });
    } else {
        symbols = symbolsParam!.split(",").filter(Boolean);
    }

    // Filter duplicates
    symbols = [...new Set(symbols)];
    const totalSymbols = symbols.length;

    if (totalSymbols === 0) {
        return new Response("No symbols to update", { status: 400 });
    }

    // Get exchange rates for EUR conversion
    const rates = await prisma.exchangeRate.findMany();
    const rateMap: Record<string, number> = {};
    rates.forEach(r => {
        rateMap[r.currency] = r.rate;
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            let completed = 0;

            // Send initial event
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                    type: 'start',
                    total: totalSymbols
                })}\n\n`)
            );

            // Process in batches
            for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
                const batch = symbols.slice(i, i + BATCH_SIZE);

                // Fetch prices in parallel within batch
                const results = await Promise.allSettled(
                    batch.map(async (symbol) => {
                        const assetInfo = assetMap.get(symbol) || { type: 'STOCK', exchange: '', currency: 'USD', quantity: 0 };

                        try {
                            const priceData = await getMarketPrice(
                                symbol,
                                assetInfo.type,
                                assetInfo.exchange,
                                true, // force refresh
                                session.user?.email || 'stream'
                            );

                            if (priceData) {
                                // Calculate EUR value
                                const currency = priceData.currency || assetInfo.currency;
                                const rate = rateMap[currency] || 1;
                                const valueEUR = (priceData.price * assetInfo.quantity) / rate;

                                return {
                                    symbol,
                                    price: priceData.price,
                                    previousClose: priceData.previousClose || priceData.price,
                                    change: priceData.change24h || 0,
                                    changePercent: priceData.changePercent || 0,
                                    currency: priceData.currency || assetInfo.currency,
                                    valueEUR,
                                    success: true
                                };
                            }
                            return { symbol, success: false };
                        } catch (e) {
                            console.error(`[Stream] Error fetching ${symbol}:`, e);
                            return { symbol, success: false };
                        }
                    })
                );

                // Stream each result
                for (const result of results) {
                    completed++;
                    const progress = Math.round((completed / totalSymbols) * 100);

                    if (result.status === 'fulfilled' && result.value.success) {
                        const data = result.value;
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({
                                type: 'price_update',
                                symbol: data.symbol,
                                price: data.price,
                                previousClose: data.previousClose,
                                change: data.change,
                                changePercent: data.changePercent,
                                currency: data.currency,
                                valueEUR: data.valueEUR,
                                progress
                            })}\n\n`)
                        );
                    } else {
                        // Send progress even for failed fetches
                        const symbol = result.status === 'fulfilled' ? result.value.symbol : 'unknown';
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({
                                type: 'progress',
                                symbol,
                                progress
                            })}\n\n`)
                        );
                    }
                }

                // Small delay between batches to avoid rate limiting
                if (i + BATCH_SIZE < symbols.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Send completion event
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                    type: 'complete',
                    total: totalSymbols,
                    timestamp: new Date().toISOString()
                })}\n\n`)
            );

            controller.close();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    });
}
