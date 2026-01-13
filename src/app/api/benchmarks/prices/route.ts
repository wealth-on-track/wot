import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeToMidnight } from '@/lib/yahoo-finance';

/**
 * GET /api/benchmarks/prices
 *
 * Fetch benchmark prices for comparison
 * Query params:
 * - symbols: Comma-separated list of symbols (e.g., "^GSPC,^IXIC")
 * - range: 1D, 1W, 1M, 3M, 6M, 1Y, 5Y, ALL
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const range = searchParams.get('range') || '1M';

    if (!symbolsParam) {
      return NextResponse.json(
        { error: 'Missing symbols parameter' },
        { status: 400 }
      );
    }

    const symbols = symbolsParam.split(',').map(s => s.trim());

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
        startDate = new Date('2020-01-01');
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    startDate = normalizeToMidnight(startDate);

    // Fetch benchmark prices
    const benchmarkPrices = await prisma.benchmarkPrice.findMany({
      where: {
        symbol: {
          in: symbols,
        },
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Group by symbol
    const groupedData: Record<string, Array<{ date: string; price: number }>> = {};

    for (const symbol of symbols) {
      groupedData[symbol] = benchmarkPrices
        .filter(bp => bp.symbol === symbol)
        .map(bp => ({
          date: bp.date.toISOString(),
          price: bp.price,
        }));
    }

    return NextResponse.json({
      success: true,
      range,
      data: groupedData,
    });
  } catch (error) {
    console.error('Error fetching benchmark prices:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch benchmark prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
