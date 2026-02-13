import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        systemActivityLog: {
            create: vi.fn().mockResolvedValue({ id: 'test-id' }),
            findMany: vi.fn().mockResolvedValue([])
        }
    }
}));

// Mock error tracking
vi.mock('@/lib/error-tracking', () => ({
    captureError: vi.fn()
}));

import {
    logAuditEvent,
    logAuth,
    logDataAccess,
    logDataModify,
    logSecurityEvent,
    logAdminAction,
    logSystemEvent,
    getUserAuditLogs,
    getSecurityEvents,
    getSystemEvents
} from '@/lib/audit-logger';
import { prisma } from '@/lib/prisma';

describe('Audit Logger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('logAuditEvent', () => {
        it('should create audit log entry in database', async () => {
            await logAuditEvent({
                activityType: 'AUTH',
                action: 'LOGIN_SUCCESS',
                userId: 'user-123',
                username: 'testuser',
                ipAddress: '192.168.1.1'
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    activityType: 'AUTH',
                    action: 'LOGIN_SUCCESS',
                    userId: 'user-123',
                    username: 'testuser',
                    ipAddress: '192.168.1.1',
                    status: 'SUCCESS'
                })
            });
        });

        it('should handle optional fields', async () => {
            await logAuditEvent({
                activityType: 'SYSTEM',
                action: 'CRON_EXECUTED'
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    activityType: 'SYSTEM',
                    action: 'CRON_EXECUTED',
                    userId: undefined,
                    status: 'SUCCESS'
                })
            });
        });

        it('should not throw on database error', async () => {
            vi.mocked(prisma.systemActivityLog.create).mockRejectedValueOnce(new Error('DB Error'));

            // Should not throw
            await expect(logAuditEvent({
                activityType: 'AUTH',
                action: 'LOGIN_SUCCESS'
            })).resolves.not.toThrow();
        });
    });

    describe('logAuth', () => {
        it('should log successful login', async () => {
            await logAuth('LOGIN_SUCCESS', {
                userId: 'user-123',
                username: 'testuser',
                ipAddress: '192.168.1.1'
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    activityType: 'AUTH',
                    action: 'LOGIN_SUCCESS',
                    status: 'SUCCESS'
                })
            });
        });

        it('should log failed login with error message', async () => {
            await logAuth('LOGIN_FAILED', {
                username: 'testuser',
                ipAddress: '192.168.1.1',
                errorMessage: 'Invalid password'
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    activityType: 'AUTH',
                    action: 'LOGIN_FAILED',
                    status: 'FAILED',
                    errorMessage: 'Invalid password'
                })
            });
        });

        it('should log password change', async () => {
            await logAuth('PASSWORD_CHANGE', {
                userId: 'user-123',
                username: 'testuser'
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    action: 'PASSWORD_CHANGE',
                    status: 'SUCCESS'
                })
            });
        });
    });

    describe('logDataAccess', () => {
        it('should log portfolio view', async () => {
            await logDataAccess('PORTFOLIO_VIEW', {
                userId: 'user-123',
                username: 'testuser',
                targetType: 'Portfolio',
                targetId: 'portfolio-456'
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    activityType: 'DATA_ACCESS',
                    action: 'PORTFOLIO_VIEW',
                    targetType: 'Portfolio',
                    targetId: 'portfolio-456'
                })
            });
        });

        it('should log data export', async () => {
            await logDataAccess('EXPORT_DATA', {
                userId: 'user-123',
                details: { format: 'CSV', rows: 100 }
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    action: 'EXPORT_DATA',
                    details: { format: 'CSV', rows: 100 }
                })
            });
        });
    });

    describe('logDataModify', () => {
        it('should log asset creation', async () => {
            await logDataModify('ASSET_CREATE', {
                userId: 'user-123',
                targetType: 'Asset',
                targetId: 'asset-789',
                details: { symbol: 'AAPL', quantity: 10 }
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    activityType: 'DATA_MODIFY',
                    action: 'ASSET_CREATE',
                    targetType: 'Asset',
                    targetId: 'asset-789'
                })
            });
        });

        it('should log asset deletion', async () => {
            await logDataModify('ASSET_DELETE', {
                userId: 'user-123',
                targetType: 'Asset',
                targetId: 'asset-789'
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    action: 'ASSET_DELETE'
                })
            });
        });
    });

    describe('logSecurityEvent', () => {
        it('should log rate limit exceeded', async () => {
            await logSecurityEvent('RATE_LIMIT_EXCEEDED', {
                ipAddress: '192.168.1.100',
                details: { endpoint: '/api/portfolio', count: 101 }
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    activityType: 'SECURITY',
                    action: 'RATE_LIMIT_EXCEEDED',
                    status: 'WARNING'
                })
            });
        });

        it('should log unauthorized access attempt', async () => {
            await logSecurityEvent('UNAUTHORIZED_ACCESS', {
                userId: 'user-123',
                ipAddress: '192.168.1.100',
                details: { attemptedResource: '/admin' }
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    action: 'UNAUTHORIZED_ACCESS',
                    status: 'WARNING'
                })
            });
        });
    });

    describe('logAdminAction', () => {
        it('should log role change', async () => {
            await logAdminAction('ROLE_CHANGE', {
                adminUserId: 'admin-123',
                adminUsername: 'superadmin',
                targetType: 'User',
                targetId: 'user-456',
                details: { oldRole: 'USER', newRole: 'ADMIN' }
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    activityType: 'ADMIN',
                    action: 'ROLE_CHANGE',
                    userId: 'admin-123',
                    targetId: 'user-456'
                })
            });
        });
    });

    describe('logSystemEvent', () => {
        it('should log cron execution', async () => {
            await logSystemEvent('CRON_EXECUTED', {
                details: { job: 'update-prices', updated: 150 },
                duration: 5000,
                status: 'SUCCESS'
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    activityType: 'SYSTEM',
                    action: 'CRON_EXECUTED',
                    duration: 5000,
                    status: 'SUCCESS'
                })
            });
        });

        it('should log failed cron execution', async () => {
            await logSystemEvent('CRON_EXECUTED', {
                details: { job: 'update-prices' },
                status: 'FAILED',
                errorMessage: 'API timeout'
            });

            expect(prisma.systemActivityLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    status: 'FAILED',
                    errorMessage: 'API timeout'
                })
            });
        });
    });

    describe('Query Functions', () => {
        it('should query user audit logs', async () => {
            await getUserAuditLogs('user-123', 25);

            expect(prisma.systemActivityLog.findMany).toHaveBeenCalledWith({
                where: { userId: 'user-123' },
                orderBy: { createdAt: 'desc' },
                take: 25
            });
        });

        it('should use default limit for user logs', async () => {
            await getUserAuditLogs('user-123');

            expect(prisma.systemActivityLog.findMany).toHaveBeenCalledWith({
                where: { userId: 'user-123' },
                orderBy: { createdAt: 'desc' },
                take: 50
            });
        });

        it('should query security events', async () => {
            await getSecurityEvents(50);

            expect(prisma.systemActivityLog.findMany).toHaveBeenCalledWith({
                where: { activityType: 'SECURITY' },
                orderBy: { createdAt: 'desc' },
                take: 50
            });
        });

        it('should query system events', async () => {
            await getSystemEvents();

            expect(prisma.systemActivityLog.findMany).toHaveBeenCalledWith({
                where: { activityType: 'SYSTEM' },
                orderBy: { createdAt: 'desc' },
                take: 50
            });
        });
    });
});
