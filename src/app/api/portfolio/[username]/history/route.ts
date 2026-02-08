import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const log = (msg: string) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[HistoryAPI] ${msg}`);
    }
};

// Helper to normalize dates to YYYY-MM-DD
const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const username = (await params).username;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '1M';
    const periodMapping: Record<string, number> = {
        '1D': 1,
        '1W': 7,
        '1M': 30,
        '3M': 90,
        '6M': 180,
        'YTD': 0, // Special case
        '1Y': 365,
        'ALL': 365 * 2
    };

    let days = periodMapping[period] || 30;

    // Calculate start date
    const endDate = new Date();
    const startDate = new Date();
    if (period === 'YTD') {
        startDate.setFullYear(new Date().getFullYear(), 0, 1);
        days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
        startDate.setDate(startDate.getDate() - days);
    }
    startDate.setHours(0, 0, 0, 0);

    try {
        log(`DEBUG: Request for ${username}, period=${period}, days=${days}`);

        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                Portfolio: {
                    include: {
                        Asset: true
                    }
                }
            }
        });

        if (!user || !user.Portfolio) {
            log('ERROR: User or portfolio not found');
            return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
        }

        log(`DEBUG: Found user, assets count: ${user.Portfolio.Asset.length}`);

        // 1. Fetch Real Snapshots from DB
        let snapshots: any[] = [];
        try {
            // Optimized query: Only select needed fields
            // Removed custom timeout as Prisma has its own timeouts and Promise.race is brittle here
            if ((prisma as any).portfolioSnapshot) {
                snapshots = await prisma.portfolioSnapshot.findMany({
                    where: {
                        portfolioId: user.Portfolio!.id,
                        date: { gte: startDate }
                    },
                    orderBy: { date: 'asc' },
                    select: {
                        date: true,
                        totalValue: true
                    }
                });
            }
            log(`DEBUG: Snapshots found: ${snapshots.length}`);
        } catch (dbError) {
            log(`WARNING: DB access failed: ${dbError}. Falling back.`);
            snapshots = [];
        }

        // 2. Determine Strategy
        let historyData: { date: string, value: number }[] = [];

        if (snapshots.length > 0) {
            // Strategy A: Use Real Snapshots
            log('DEBUG: Strategy Database');
            historyData = snapshots.map(s => ({
                date: s.date.toISOString(),
                value: s.totalValue
            }));
        } else {
            // Strategy B: Backtesting (Simulation) - DISABLED
            log('DEBUG: Strategy Backtesting DISABLED.');
        }

        // Fallback if empty (Safe Flat Line)
        if (historyData.length === 0) {
            log('WARNING: No history data generated! Generating flat line fallback.');

            let fallbackValue = 0;
            try {
                if (user.Portfolio && user.Portfolio.Asset) {
                    fallbackValue = user.Portfolio.Asset.reduce((sum, asset) => {
                        // Use buyPrice as proxy for value if no snapshots exist
                        // Check for nulls just in case, though schema says required
                        const val = (Number(asset.quantity) || 0) * (Number(asset.buyPrice) || 0);
                        return sum + val;
                    }, 0);
                }
            } catch (e) {
                log(`Fallback calculation failed: ${e}`);
            }

            // Create flat line
            historyData.push({
                date: startDate.toISOString(),
                value: fallbackValue
            });
            historyData.push({
                date: new Date().toISOString(),
                value: fallbackValue
            });
        }

        log(`DEBUG: Returning ${historyData.length} data points`);

        const response = NextResponse.json({
            data: historyData,
            source: snapshots.length >= Math.max(2, days / 5) ? 'database' : 'simulation'
        });

        // Cache for 5 minutes on client, stale-while-revalidate for 10 minutes
        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return response;

    } catch (error) {
        log(`CRITICAL ERROR: ${error}`);
        console.error('Portfolio history error:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
