import { NextResponse } from 'next/server';
import { updateAllPrices } from '@/services/priceUpdateService';

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic';
// Allow longer execution for batching
export const maxDuration = 300;

export async function GET(request: Request) {
    try {
        console.log("[Cron] Starting Manual/Scheduled Price Update...");

        // Skip updates between 00:00-08:00 UTC+3 (Istanbul time)
        // Markets are closed, no need to waste API quota
        const now = new Date();
        const istanbulHour = now.getUTCHours() + 3; // UTC+3 for Istanbul
        const normalizedHour = istanbulHour >= 24 ? istanbulHour - 24 : istanbulHour;

        if (normalizedHour >= 0 && normalizedHour < 8) {
            console.log(`[Cron] Skipping update at ${normalizedHour}:00 Istanbul time (night hours 00:00-08:00)`);
            return NextResponse.json({
                success: true,
                message: "Skipped: Night hours (00:00-08:00 Istanbul time)",
                skipped: true,
                hour: normalizedHour
            });
        }

        const result = await updateAllPrices();
        console.log("[Cron] Update Result:", result);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[Cron] Failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
