/**
 * Role-Based Access Control (RBAC) Utilities
 * Centralized authorization logic for the application
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// ============================================
// TYPES
// ============================================

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface RBACUser {
    id: string;
    username: string;
    email: string;
    role: UserRole;
}

// ============================================
// ROLE HIERARCHY
// ============================================

// Role hierarchy: SUPER_ADMIN > ADMIN > USER
const ROLE_HIERARCHY: Record<UserRole, number> = {
    USER: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
};

// ============================================
// AUTHORIZATION FUNCTIONS
// ============================================

/**
 * Check if a role has at least the required permission level
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user is an admin (ADMIN or SUPER_ADMIN)
 */
export function isAdmin(role: UserRole): boolean {
    return hasRole(role, 'ADMIN');
}

/**
 * Check if user is a super admin
 */
export function isSuperAdmin(role: UserRole): boolean {
    return role === 'SUPER_ADMIN';
}

/**
 * Get the current authenticated user with role from database
 * Returns null if not authenticated or user not found
 */
export async function getAuthenticatedUserWithRole(): Promise<RBACUser | null> {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return null;
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
            },
        });

        if (!user) {
            return null;
        }

        return user as RBACUser;
    } catch (error) {
        console.error('[RBAC] Error getting authenticated user:', error);
        return null;
    }
}

/**
 * Verify that the current user has admin access
 * Returns the user if authorized, null otherwise
 */
export async function requireAdminAccess(): Promise<RBACUser | null> {
    const user = await getAuthenticatedUserWithRole();

    if (!user) {
        return null;
    }

    if (!isAdmin(user.role)) {
        console.warn(`[RBAC] Admin access denied for user ${user.username} (role: ${user.role})`);
        return null;
    }

    return user;
}

/**
 * Verify that the current user has super admin access
 * Returns the user if authorized, null otherwise
 */
export async function requireSuperAdminAccess(): Promise<RBACUser | null> {
    const user = await getAuthenticatedUserWithRole();

    if (!user) {
        return null;
    }

    if (!isSuperAdmin(user.role)) {
        console.warn(`[RBAC] Super admin access denied for user ${user.username} (role: ${user.role})`);
        return null;
    }

    return user;
}

// ============================================
// PERMISSION DEFINITIONS
// ============================================

export const PERMISSIONS = {
    // Admin panel access
    VIEW_ADMIN_PANEL: ['ADMIN', 'SUPER_ADMIN'] as UserRole[],

    // User management
    VIEW_USERS: ['ADMIN', 'SUPER_ADMIN'] as UserRole[],
    EDIT_USERS: ['SUPER_ADMIN'] as UserRole[],
    DELETE_USERS: ['SUPER_ADMIN'] as UserRole[],

    // System configuration
    VIEW_SYSTEM_LOGS: ['ADMIN', 'SUPER_ADMIN'] as UserRole[],
    MODIFY_SYSTEM_CONFIG: ['SUPER_ADMIN'] as UserRole[],

    // Data management
    VIEW_ALL_PORTFOLIOS: ['ADMIN', 'SUPER_ADMIN'] as UserRole[],
    EXPORT_DATA: ['ADMIN', 'SUPER_ADMIN'] as UserRole[],
} as const;

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
    userRole: UserRole,
    permission: keyof typeof PERMISSIONS
): boolean {
    const allowedRoles = PERMISSIONS[permission];
    return allowedRoles.includes(userRole);
}
