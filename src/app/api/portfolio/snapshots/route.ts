import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { normalizeToMidnight } from '@/lib/yahoo-finance';
import { apiMiddleware, STRICT_RATE_LIMIT } from '@/lib/api-security';

/**
 * GET /api/portfolio/snapshots
 *
 * Fetch portfolio snapshots for the authenticated user
 * Query params:
 * - range: 1D, 1W, 1M, 3M, 6M, 1Y, 5Y, ALL
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const middlewareResult = await apiMiddleware(request, { rateLimit: STRICT_RATE_LIMIT });
  if (middlewareResult) return middlewareResult;

  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get URL params
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '1M';

    // Find user's portfolio
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { Portfolio: true },
    });

    if (!user || !user.Portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '1D':
        startDate.setDate(now.getDate() - 1);
        break;
      case '1W':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case '5Y':
        startDate.setFullYear(now.getFullYear() - 5);
        break;
      case 'ALL':
        startDate = new Date('2020-01-01'); // Reasonable start date
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    startDate = normalizeToMidnight(startDate);

    // Fetch snapshots
    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: {
        portfolioId: user.Portfolio.id,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Format response
    const data = snapshots.map(snapshot => ({
      date: snapshot.date.toISOString(),
      value: snapshot.totalValue,
    }));

    return NextResponse.json({
      success: true,
      range,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error('Error fetching portfolio snapshots:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch snapshots',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
