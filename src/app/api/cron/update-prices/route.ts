import { NextRequest, NextResponse } from 'next/server';
import { updateAllPrices } from '@/services/priceUpdateService';
import { verifyCronAuth, sanitizeError } from '@/lib/api-security';

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic';
// Allow longer execution for batching
export const maxDuration = 300;

/**
 * Price Update Cron Job
 *
 * Security:
 * - Requires CRON_SECRET authentication (mandatory in production)
 * - Time-gated to skip night hours (00:00-08:00 CET)
 */
export async function GET(request: NextRequest) {
    try {
        // Verify CRON authentication
        const authError = verifyCronAuth(request);
        if (authError) {
            return authError;
        }

        console.log("[Cron] Starting Manual/Scheduled Price Update...");

        // Skip updates between 00:00-08:00 CET
        // Markets are closed, no need to waste API quota
        const now = new Date();
        const cetHour = now.getUTCHours() + 1; // UTC+1 for CET
        const normalizedHour = cetHour >= 24 ? cetHour - 24 : (cetHour < 0 ? cetHour + 24 : cetHour);

        if (normalizedHour >= 0 && normalizedHour < 8) {
            console.log(`[Cron] Skipping update at ${normalizedHour}:00 CET time (night hours 00:00-08:00)`);
            return NextResponse.json({
                success: true,
                message: "Skipped: Night hours (00:00-08:00 CET time)",
                skipped: true,
                hour: normalizedHour
            });
        }

        const result = await updateAllPrices();
        console.log("[Cron] Update Result:", result);
        return NextResponse.json(result);
    } catch (error) {
        const sanitized = sanitizeError(error, 'Price update failed');
        console.error("[Cron] Failed:", error);
        return NextResponse.json(
            { success: false, error: sanitized.error, code: sanitized.code },
            { status: sanitized.status }
        );
    }
}
