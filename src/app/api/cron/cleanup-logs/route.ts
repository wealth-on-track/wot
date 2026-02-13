/**
 * CRON: Audit Log Cleanup
 * Implements log retention policy - removes old logs
 *
 * Schedule: Weekly on Sunday at 04:00 UTC
 * Vercel Cron: 0 4 * * 0
 *
 * Retention Policy:
 * - SystemActivityLog: 2 years
 * - ApiRequestLog: 90 days
 * - ApiUsage (aggregated): 1 year
 * - PortfolioSnapshot: 5 years
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/api-security';
import { prisma } from '@/lib/prisma';
import { trackActivity } from '@/services/telemetry';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes

// Retention periods in days
const RETENTION_POLICY = {
    systemActivityLog: 730, // 2 years
    apiRequestLog: 90, // 90 days
    apiUsage: 365, // 1 year
    portfolioSnapshot: 1825 // 5 years
} as const;

export async function GET(request: NextRequest) {
    // SECURITY: Verify CRON authentication
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    const startTime = Date.now();
    const results: Record<string, { deleted: number; cutoffDate: string }> = {};

    try {
        console.log('[CRON Cleanup] Starting audit log cleanup...');

        // 1. Clean SystemActivityLog (2 years)
        const activityCutoff = new Date();
        activityCutoff.setDate(activityCutoff.getDate() - RETENTION_POLICY.systemActivityLog);

        const activityResult = await prisma.systemActivityLog.deleteMany({
            where: {
                createdAt: { lt: activityCutoff }
            }
        });
        results.systemActivityLog = {
            deleted: activityResult.count,
            cutoffDate: activityCutoff.toISOString()
        };
        console.log(`[CRON Cleanup] Deleted ${activityResult.count} old activity logs`);

        // 2. Clean ApiRequestLog (90 days)
        const apiLogCutoff = new Date();
        apiLogCutoff.setDate(apiLogCutoff.getDate() - RETENTION_POLICY.apiRequestLog);

        const apiLogResult = await prisma.apiRequestLog.deleteMany({
            where: {
                createdAt: { lt: apiLogCutoff }
            }
        });
        results.apiRequestLog = {
            deleted: apiLogResult.count,
            cutoffDate: apiLogCutoff.toISOString()
        };
        console.log(`[CRON Cleanup] Deleted ${apiLogResult.count} old API request logs`);

        // 3. Clean ApiUsage aggregates (1 year)
        const usageCutoff = new Date();
        usageCutoff.setDate(usageCutoff.getDate() - RETENTION_POLICY.apiUsage);
        const usageCutoffKey = usageCutoff.toISOString().split('T')[0];

        const usageResult = await prisma.apiUsage.deleteMany({
            where: {
                dateKey: { lt: usageCutoffKey }
            }
        });
        results.apiUsage = {
            deleted: usageResult.count,
            cutoffDate: usageCutoff.toISOString()
        };
        console.log(`[CRON Cleanup] Deleted ${usageResult.count} old API usage records`);

        // 4. Clean old PortfolioSnapshots (5 years) - but keep at least 1 per month
        const snapshotCutoff = new Date();
        snapshotCutoff.setDate(snapshotCutoff.getDate() - RETENTION_POLICY.portfolioSnapshot);

        // More conservative: only delete snapshots older than 5 years
        const snapshotResult = await prisma.portfolioSnapshot.deleteMany({
            where: {
                date: { lt: snapshotCutoff }
            }
        });
        results.portfolioSnapshot = {
            deleted: snapshotResult.count,
            cutoffDate: snapshotCutoff.toISOString()
        };
        console.log(`[CRON Cleanup] Deleted ${snapshotResult.count} old portfolio snapshots`);

        // 5. Cleanup orphaned data (extra safety)
        // This handles edge cases where related records weren't cascade deleted

        // Delete benchmark cache older than 7 days (it gets refreshed anyway)
        const benchmarkCutoff = new Date();
        benchmarkCutoff.setDate(benchmarkCutoff.getDate() - 7);

        const benchmarkResult = await prisma.benchmarkCache.deleteMany({
            where: {
                updatedAt: { lt: benchmarkCutoff }
            }
        });
        results.benchmarkCache = {
            deleted: benchmarkResult.count,
            cutoffDate: benchmarkCutoff.toISOString()
        };

        const duration = Date.now() - startTime;

        // Calculate totals
        const totalDeleted = Object.values(results).reduce((sum, r) => sum + r.deleted, 0);

        // Track cleanup activity
        await trackActivity('SYSTEM', 'DELETE', {
            targetType: 'AUDIT_LOGS',
            details: {
                results,
                totalDeleted,
                duration,
                retentionPolicy: RETENTION_POLICY
            }
        });

        console.log(`[CRON Cleanup] Complete. Total deleted: ${totalDeleted} in ${duration}ms`);

        return NextResponse.json({
            success: true,
            results,
            totalDeleted,
            retentionPolicy: RETENTION_POLICY,
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[CRON Cleanup] Failed:', error);

        // Track failure
        await trackActivity('SYSTEM', 'DELETE', {
            targetType: 'AUDIT_LOGS',
            status: 'ERROR',
            errorMessage: error instanceof Error ? error.message : String(error),
            details: { duration }
        });

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Cleanup failed',
                duration
            },
            { status: 500 }
        );
    }
}
