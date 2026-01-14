import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRate } from '@/lib/currency';
import fs from 'fs';

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
                portfolio: {
                    include: {
                        assets: true
                    }
                }
            }
        });

        if (!user || !user.portfolio) {
            log('ERROR: User or portfolio not found');
            return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
        }

        log(`DEBUG: Found user, assets count: ${user.portfolio.assets.length}`);

        // 1. Fetch Real Snapshots from DB with Timeout
        let snapshots: any[] = [];
        try {
            // timeout promise
            const fetchSnapshots = async () => {
                if ((prisma as any).portfolioSnapshot) {
                    return await prisma.portfolioSnapshot.findMany({
                        where: {
                            portfolioId: user.portfolio!.id,
                            date: { gte: startDate }
                        },
                        orderBy: { date: 'asc' }
                    });
                }
                return [];
            };

            const timeout = new Promise<any[]>((_, reject) =>
                setTimeout(() => reject(new Error('DB Timeout')), 5000)
            );

            snapshots = await Promise.race([fetchSnapshots(), timeout]);
            log(`DEBUG: Snapshots found: ${snapshots.length}`);
        } catch (dbError) {
            log(`WARNING: DB access failed or timed out: ${dbError}. Falling back to simulation.`);
            snapshots = [];
        }

        // 2. Determine Strategy
        let historyData: { date: string, value: number }[] = [];

        if (snapshots.length >= Math.max(2, days / 5)) {
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

        // Fallback if empty (Create a flat line based on Current Value)
        if (historyData.length === 0) {
            log('WARNING: No history data generated! Falling back to current value.');

            // Calculate total current value
            const currentValue = user.portfolio.assets.reduce((sum, a) => {
                return sum + (a.quantity * (a.buyPrice || 0));
            }, 0);

            // Create a 2-point line for the selected period
            historyData.push({
                date: startDate.toISOString(), // Start of period
                value: currentValue // Assume flat
            });
            historyData.push({
                date: new Date().toISOString(), // Now
                value: currentValue
            });
        }

        log(`DEBUG: Returning ${historyData.length} data points`);

        return NextResponse.json({
            data: historyData,
            source: snapshots.length >= Math.max(2, days / 5) ? 'database' : 'simulation'
        });

    } catch (error) {
        log(`CRITICAL ERROR: ${error}`);
        console.error('Portfolio history error:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
