
import { NextResponse } from 'next/server';
import { calculateInsights } from '@/lib/insightsEngine';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ username: string }> } // Next.js 15/16 style params are async promises
) {
    try {
        const { username } = await params;

        if (!username) {
            return NextResponse.json(
                { error: 'Username is required' },
                { status: 400 }
            );
        }

        const insights = await calculateInsights(username);

        return NextResponse.json(insights);
    } catch (error: any) {
        console.error('[API] Insights Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
