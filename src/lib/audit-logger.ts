/**
 * Audit Logging Service
 * Comprehensive logging for security-sensitive operations
 *
 * This service logs:
 * - Authentication events (login, logout, password changes)
 * - Data access (portfolio views, exports)
 * - Data modifications (asset CRUD, settings changes)
 * - Administrative actions (user management, system config)
 * - Security events (failed logins, rate limits, unauthorized access)
 */

import { prisma } from '@/lib/prisma';
import { captureError } from '@/lib/error-tracking';

// ============================================
// TYPES
// ============================================

export type ActivityType =
    | 'AUTH'           // Authentication events
    | 'DATA_ACCESS'    // Read operations
    | 'DATA_MODIFY'    // Create/Update/Delete operations
    | 'ADMIN'          // Administrative actions
    | 'SECURITY'       // Security-related events
    | 'SYSTEM';        // System events (cron, maintenance)

export type ActivityAction =
    // Auth actions
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'LOGOUT'
    | 'PASSWORD_CHANGE'
    | 'SESSION_EXPIRED'
    // Data access actions
    | 'PORTFOLIO_VIEW'
    | 'EXPORT_DATA'
    | 'API_CALL'
    // Data modify actions
    | 'ASSET_CREATE'
    | 'ASSET_UPDATE'
    | 'ASSET_DELETE'
    | 'TRANSACTION_CREATE'
    | 'TRANSACTION_DELETE'
    | 'SETTINGS_UPDATE'
    | 'GOAL_CREATE'
    | 'GOAL_UPDATE'
    | 'GOAL_DELETE'
    // Admin actions
    | 'USER_CREATE'
    | 'USER_UPDATE'
    | 'USER_DELETE'
    | 'ROLE_CHANGE'
    | 'CONFIG_UPDATE'
    // Security actions
    | 'RATE_LIMIT_EXCEEDED'
    | 'UNAUTHORIZED_ACCESS'
    | 'SUSPICIOUS_ACTIVITY'
    | 'CRON_EXECUTED';

export interface AuditLogEntry {
    activityType: ActivityType;
    action: ActivityAction;
    userId?: string;
    username?: string;
    targetType?: string;         // What was affected (e.g., 'Asset', 'User')
    targetId?: string;           // ID of affected entity
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    duration?: number;           // Operation duration in ms
    status?: 'SUCCESS' | 'FAILED' | 'WARNING';
    errorMessage?: string;
}

// ============================================
// CORE LOGGING FUNCTION
// ============================================

/**
 * Log an audit event to the database
 * Non-blocking - errors are captured but don't interrupt the main flow
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
    try {
        await prisma.systemActivityLog.create({
            data: {
                activityType: entry.activityType,
                action: entry.action,
                userId: entry.userId,
                username: entry.username,
                targetType: entry.targetType,
                targetId: entry.targetId,
                details: entry.details ? JSON.parse(JSON.stringify(entry.details)) : undefined,
                ipAddress: entry.ipAddress,
                userAgent: entry.userAgent,
                duration: entry.duration,
                status: entry.status || 'SUCCESS',
                errorMessage: entry.errorMessage,
            },
        });
    } catch (error) {
        // Don't throw - audit logging should never break the main flow
        console.error('[AuditLogger] Failed to log event:', error);
        await captureError(error, {
            action: 'audit_log_failed',
            extra: { entry },
        });
    }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Log authentication events
 */
export async function logAuth(
    action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'PASSWORD_CHANGE' | 'SESSION_EXPIRED',
    options: {
        userId?: string;
        username?: string;
        ipAddress?: string;
        userAgent?: string;
        errorMessage?: string;
    }
): Promise<void> {
    await logAuditEvent({
        activityType: 'AUTH',
        action,
        userId: options.userId,
        username: options.username,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        status: action === 'LOGIN_FAILED' ? 'FAILED' : 'SUCCESS',
        errorMessage: options.errorMessage,
    });
}

/**
 * Log data access events
 */
export async function logDataAccess(
    action: 'PORTFOLIO_VIEW' | 'EXPORT_DATA' | 'API_CALL',
    options: {
        userId: string;
        username?: string;
        targetType?: string;
        targetId?: string;
        details?: Record<string, unknown>;
        ipAddress?: string;
    }
): Promise<void> {
    await logAuditEvent({
        activityType: 'DATA_ACCESS',
        action,
        userId: options.userId,
        username: options.username,
        targetType: options.targetType,
        targetId: options.targetId,
        details: options.details,
        ipAddress: options.ipAddress,
        status: 'SUCCESS',
    });
}

/**
 * Log data modification events
 */
export async function logDataModify(
    action: 'ASSET_CREATE' | 'ASSET_UPDATE' | 'ASSET_DELETE' | 'TRANSACTION_CREATE' | 'TRANSACTION_DELETE' | 'SETTINGS_UPDATE' | 'GOAL_CREATE' | 'GOAL_UPDATE' | 'GOAL_DELETE',
    options: {
        userId: string;
        username?: string;
        targetType: string;
        targetId?: string;
        details?: Record<string, unknown>;
        ipAddress?: string;
        duration?: number;
    }
): Promise<void> {
    await logAuditEvent({
        activityType: 'DATA_MODIFY',
        action,
        userId: options.userId,
        username: options.username,
        targetType: options.targetType,
        targetId: options.targetId,
        details: options.details,
        ipAddress: options.ipAddress,
        duration: options.duration,
        status: 'SUCCESS',
    });
}

/**
 * Log security events
 */
export async function logSecurityEvent(
    action: 'RATE_LIMIT_EXCEEDED' | 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY',
    options: {
        userId?: string;
        username?: string;
        ipAddress?: string;
        userAgent?: string;
        details?: Record<string, unknown>;
        errorMessage?: string;
    }
): Promise<void> {
    await logAuditEvent({
        activityType: 'SECURITY',
        action,
        userId: options.userId,
        username: options.username,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        details: options.details,
        status: 'WARNING',
        errorMessage: options.errorMessage,
    });
}

/**
 * Log administrative actions
 */
export async function logAdminAction(
    action: 'USER_CREATE' | 'USER_UPDATE' | 'USER_DELETE' | 'ROLE_CHANGE' | 'CONFIG_UPDATE',
    options: {
        adminUserId: string;
        adminUsername?: string;
        targetType: string;
        targetId?: string;
        details?: Record<string, unknown>;
        ipAddress?: string;
    }
): Promise<void> {
    await logAuditEvent({
        activityType: 'ADMIN',
        action,
        userId: options.adminUserId,
        username: options.adminUsername,
        targetType: options.targetType,
        targetId: options.targetId,
        details: options.details,
        ipAddress: options.ipAddress,
        status: 'SUCCESS',
    });
}

/**
 * Log system events (cron jobs, maintenance)
 */
export async function logSystemEvent(
    action: 'CRON_EXECUTED',
    options: {
        details: Record<string, unknown>;
        duration?: number;
        status?: 'SUCCESS' | 'FAILED';
        errorMessage?: string;
    }
): Promise<void> {
    await logAuditEvent({
        activityType: 'SYSTEM',
        action,
        details: options.details,
        duration: options.duration,
        status: options.status || 'SUCCESS',
        errorMessage: options.errorMessage,
    });
}

// ============================================
// QUERY FUNCTIONS
// ============================================

// Type for audit log entries
type SystemActivityLogEntry = Awaited<ReturnType<typeof prisma.systemActivityLog.findFirst>>;

/**
 * Get recent audit logs for a user
 */
export async function getUserAuditLogs(
    userId: string,
    limit = 50
): Promise<NonNullable<SystemActivityLogEntry>[]> {
    return prisma.systemActivityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}

/**
 * Get security events (for admin monitoring)
 */
export async function getSecurityEvents(
    limit = 100
): Promise<NonNullable<SystemActivityLogEntry>[]> {
    return prisma.systemActivityLog.findMany({
        where: { activityType: 'SECURITY' },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}

/**
 * Get system events (for admin monitoring)
 */
export async function getSystemEvents(
    limit = 50
): Promise<NonNullable<SystemActivityLogEntry>[]> {
    return prisma.systemActivityLog.findMany({
        where: { activityType: 'SYSTEM' },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}
