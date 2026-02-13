/**
 * CRON: Database Backup
 * Creates daily backups of critical data
 *
 * Schedule: Daily at 03:00 UTC
 * Vercel Cron: 0 3 * * *
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/api-security';
import { createBackup, storeBackup, cleanupOldBackups, getBackupStats } from '@/services/backupService';
import { trackActivity } from '@/services/telemetry';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large backups

export async function GET(request: NextRequest) {
    // SECURITY: Verify CRON authentication
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    const startTime = Date.now();

    try {
        console.log('[CRON Backup] Starting daily backup...');

        // Step 1: Create backup
        const backup = await createBackup();

        // Step 2: Store backup
        const storageResult = await storeBackup(backup);

        // Step 3: Cleanup old backups (keep last 30 days)
        const deletedCount = await cleanupOldBackups(30);

        // Step 4: Get updated stats
        const stats = await getBackupStats();

        const duration = Date.now() - startTime;

        // Track backup activity
        await trackActivity('SYSTEM', 'SYNC', {
            targetType: 'BACKUP',
            details: {
                backupId: backup.metadata.id,
                stats: backup.metadata.stats,
                storageUrl: storageResult.url || storageResult.path,
                deletedOldBackups: deletedCount,
                duration
            }
        });

        console.log(`[CRON Backup] Complete in ${duration}ms`);

        return NextResponse.json({
            success: true,
            backup: {
                id: backup.metadata.id,
                createdAt: backup.metadata.createdAt,
                stats: backup.metadata.stats,
                storage: storageResult
            },
            cleanup: {
                deletedCount
            },
            currentStats: stats,
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[CRON Backup] Failed:', error);

        // Track failure
        await trackActivity('SYSTEM', 'SYNC', {
            targetType: 'BACKUP',
            status: 'ERROR',
            errorMessage: error instanceof Error ? error.message : String(error),
            details: { duration }
        });

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Backup failed',
                duration
            },
            { status: 500 }
        );
    }
}
