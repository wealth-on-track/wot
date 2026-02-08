import { NextRequest, NextResponse } from 'next/server';
import { getTefasFundInfo } from '@/services/tefasApi';

/**
 * Batch fetch TEFAS fund prices
 * POST /api/tefas/batch
 * Body: { codes: ['AH2', 'AH5', 'AEA', ...] }
 * Returns: { prices: { 'AH2': 1.234, 'AH5': 5.678, ... } }
 */
export async function POST(request: NextRequest) {
    try {
        const { codes } = await request.json();

        if (!codes || !Array.isArray(codes) || codes.length === 0) {
            return NextResponse.json({ error: 'Invalid codes array' }, { status: 400 });
        }

        // Limit to prevent abuse
        const limitedCodes = codes.slice(0, 20);

        // Fetch all prices in parallel
        const results = await Promise.allSettled(
            limitedCodes.map(async (code: string) => {
                const info = await getTefasFundInfo(code);
                return { code, price: info?.price || null };
            })
        );

        const prices: Record<string, number> = {};
        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.price !== null) {
                prices[result.value.code] = result.value.price;
            }
        });

        return NextResponse.json({ prices });
    } catch (error) {
        console.error('[TEFAS Batch] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
    }
}
