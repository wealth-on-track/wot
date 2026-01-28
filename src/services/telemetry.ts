import { prisma } from '@/lib/prisma';

export interface LogDetails {
    endpoint?: string;
    params?: string;
    duration?: number;
    error?: string;
    userId?: string;
    statusCode?: number;
}

export async function trackApiRequest(provider: string, isSuccess: boolean, details?: LogDetails) {
    try {
        const today = new Date();
        const dateKey = today.toISOString().split('T')[0]; // "YYYY-MM-DD"

        const agg = prisma.apiUsage.upsert({
            where: {
                provider_dateKey: {
                    provider: provider,
                    dateKey: dateKey
                }
            },
            create: {
                provider,
                dateKey,
                successCount: isSuccess ? 1 : 0,
                errorCount: isSuccess ? 0 : 1
            },
            update: {
                successCount: { increment: isSuccess ? 1 : 0 },
                errorCount: { increment: isSuccess ? 0 : 1 }
            }
        });

        const log = prisma.apiRequestLog.create({
            data: {
                provider,
                endpoint: details?.endpoint || 'unknown',
                params: details?.params || '',
                status: isSuccess ? 'SUCCESS' : 'ERROR',
                statusCode: details?.statusCode,
                duration: details?.duration,
                error: details?.error,
                userId: details?.userId
            }
        });

        await Promise.all([agg, log]);
    } catch (e) {
        // Fail silently - telemetry shouldn't break the app
        // console.error('[Telemetry] Failed to log request:', e);
    }
}

export async function getDailyStats() {
    const today = new Date();
    const dateKey = today.toISOString().split('T')[0];

    return prisma.apiUsage.findMany({
        where: { dateKey },
        orderBy: { provider: 'asc' }
    });
}

export async function getRecentLogs(limit: number = 50) {
    return prisma.apiRequestLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}

// ============================================================================
// SYSTEM ACTIVITY TRACKING
// ============================================================================

export type ActivityType = 'AUTH' | 'ASSET' | 'SEARCH' | 'PORTFOLIO' | 'NAVIGATION' | 'SYSTEM' | 'GOAL' | 'API';
export type ActivityAction =
    | 'LOGIN' | 'LOGOUT' | 'SIGNUP' | 'DELETE_ACCOUNT'
    | 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW'
    | 'QUERY' | 'SELECT'
    | 'NAVIGATE'
    | 'PRICE_UPDATE' | 'SYNC' | 'EXPORT' | 'LOGO_FETCH';

export interface ActivityDetails {
    userId?: string;
    username?: string;
    targetType?: string;
    targetId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    duration?: number;
    status?: 'SUCCESS' | 'ERROR' | 'PENDING';
    errorMessage?: string;
}

/**
 * Track any system activity - user actions, operations, navigation, etc.
 * This provides comprehensive logging beyond just API calls.
 */
export async function trackActivity(
    activityType: ActivityType,
    action: ActivityAction,
    options?: ActivityDetails
) {
    try {
        await prisma.systemActivityLog.create({
            data: {
                activityType,
                action,
                userId: options?.userId,
                username: options?.username,
                targetType: options?.targetType,
                targetId: options?.targetId,
                details: options?.details,
                ipAddress: options?.ipAddress,
                userAgent: options?.userAgent,
                duration: options?.duration,
                status: options?.status || 'SUCCESS',
                errorMessage: options?.errorMessage
            }
        });
    } catch (e) {
        // Fail silently - telemetry shouldn't break the app
        console.error('[Activity Tracking] Failed to log activity:', e);
    }
}

/**
 * Get recent system activities with optional filtering
 */
export async function getRecentActivities(options?: {
    limit?: number;
    userId?: string;
    activityType?: ActivityType;
    action?: ActivityAction;
}) {
    const { limit = 100, userId, activityType, action } = options || {};

    return prisma.systemActivityLog.findMany({
        where: {
            ...(userId && { userId }),
            ...(activityType && { activityType }),
            ...(action && { action })
        },
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}


/**
 * Get activity statistics
 */
export async function getActivityStats(dateFrom?: Date) {
    const where = dateFrom ? { createdAt: { gte: dateFrom } } : {};

    const [total, byType, byAction] = await Promise.all([
        prisma.systemActivityLog.count({ where }),
        prisma.systemActivityLog.groupBy({
            by: ['activityType'],
            where,
            _count: true,
            orderBy: { _count: { activityType: 'desc' } }
        }),
        prisma.systemActivityLog.groupBy({
            by: ['action'],
            where,
            _count: true,
            orderBy: { _count: { action: 'desc' } }
        })
    ]);

    return { total, byType, byAction };
}
