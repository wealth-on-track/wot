import { describe, it, expect, vi } from 'vitest';

// Mock auth and prisma before importing rbac
vi.mock('@/auth', () => ({
    auth: vi.fn().mockResolvedValue(null)
}));

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn().mockResolvedValue(null)
        }
    }
}));

import { hasRole, isAdmin, isSuperAdmin, hasPermission, PERMISSIONS } from '@/lib/rbac';

describe('RBAC - Role-Based Access Control', () => {
    describe('hasRole', () => {
        it('should return true when user role equals required role', () => {
            expect(hasRole('USER', 'USER')).toBe(true);
            expect(hasRole('ADMIN', 'ADMIN')).toBe(true);
            expect(hasRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true);
        });

        it('should return true when user role exceeds required role', () => {
            expect(hasRole('ADMIN', 'USER')).toBe(true);
            expect(hasRole('SUPER_ADMIN', 'USER')).toBe(true);
            expect(hasRole('SUPER_ADMIN', 'ADMIN')).toBe(true);
        });

        it('should return false when user role is below required role', () => {
            expect(hasRole('USER', 'ADMIN')).toBe(false);
            expect(hasRole('USER', 'SUPER_ADMIN')).toBe(false);
            expect(hasRole('ADMIN', 'SUPER_ADMIN')).toBe(false);
        });
    });

    describe('isAdmin', () => {
        it('should return true for ADMIN role', () => {
            expect(isAdmin('ADMIN')).toBe(true);
        });

        it('should return true for SUPER_ADMIN role', () => {
            expect(isAdmin('SUPER_ADMIN')).toBe(true);
        });

        it('should return false for USER role', () => {
            expect(isAdmin('USER')).toBe(false);
        });
    });

    describe('isSuperAdmin', () => {
        it('should return true only for SUPER_ADMIN role', () => {
            expect(isSuperAdmin('SUPER_ADMIN')).toBe(true);
        });

        it('should return false for ADMIN role', () => {
            expect(isSuperAdmin('ADMIN')).toBe(false);
        });

        it('should return false for USER role', () => {
            expect(isSuperAdmin('USER')).toBe(false);
        });
    });

    describe('hasPermission', () => {
        it('should allow admins to view admin panel', () => {
            expect(hasPermission('ADMIN', 'VIEW_ADMIN_PANEL')).toBe(true);
            expect(hasPermission('SUPER_ADMIN', 'VIEW_ADMIN_PANEL')).toBe(true);
        });

        it('should deny users from viewing admin panel', () => {
            expect(hasPermission('USER', 'VIEW_ADMIN_PANEL')).toBe(false);
        });

        it('should only allow super admins to edit users', () => {
            expect(hasPermission('SUPER_ADMIN', 'EDIT_USERS')).toBe(true);
            expect(hasPermission('ADMIN', 'EDIT_USERS')).toBe(false);
            expect(hasPermission('USER', 'EDIT_USERS')).toBe(false);
        });

        it('should allow admins to view system logs', () => {
            expect(hasPermission('ADMIN', 'VIEW_SYSTEM_LOGS')).toBe(true);
            expect(hasPermission('SUPER_ADMIN', 'VIEW_SYSTEM_LOGS')).toBe(true);
            expect(hasPermission('USER', 'VIEW_SYSTEM_LOGS')).toBe(false);
        });
    });

    describe('PERMISSIONS', () => {
        it('should have all required permission definitions', () => {
            expect(PERMISSIONS.VIEW_ADMIN_PANEL).toBeDefined();
            expect(PERMISSIONS.VIEW_USERS).toBeDefined();
            expect(PERMISSIONS.EDIT_USERS).toBeDefined();
            expect(PERMISSIONS.DELETE_USERS).toBeDefined();
            expect(PERMISSIONS.VIEW_SYSTEM_LOGS).toBeDefined();
            expect(PERMISSIONS.MODIFY_SYSTEM_CONFIG).toBeDefined();
            expect(PERMISSIONS.VIEW_ALL_PORTFOLIOS).toBeDefined();
            expect(PERMISSIONS.EXPORT_DATA).toBeDefined();
        });

        it('should have valid role arrays for all permissions', () => {
            Object.values(PERMISSIONS).forEach(roles => {
                expect(Array.isArray(roles)).toBe(true);
                expect(roles.length).toBeGreaterThan(0);
                roles.forEach(role => {
                    expect(['USER', 'ADMIN', 'SUPER_ADMIN']).toContain(role);
                });
            });
        });
    });
});
