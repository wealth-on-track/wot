/**
 * Admin User Management API
 * CRUD operations for user management
 *
 * GET /api/admin/users - List all users with pagination
 * POST /api/admin/users/:id - Update user (role, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess, requireSuperAdminAccess, hasPermission } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { trackActivity } from '@/services/telemetry';
import { z } from 'zod';
import { apiMiddleware, STRICT_RATE_LIMIT } from '@/lib/api-security';

export const dynamic = 'force-dynamic';

// Query parameters schema
const QuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
    sortBy: z.enum(['createdAt', 'username', 'email', 'role']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export async function GET(request: NextRequest) {
    // Apply rate limiting
    const middlewareResult = await apiMiddleware(request, { rateLimit: STRICT_RATE_LIMIT });
    if (middlewareResult) return middlewareResult;

    // SECURITY: Require admin access
    const adminUser = await requireAdminAccess();
    if (!adminUser) {
        return NextResponse.json(
            { error: 'Admin access required', code: 'FORBIDDEN' },
            { status: 403 }
        );
    }

    // Check specific permission
    if (!hasPermission(adminUser.role, 'VIEW_USERS')) {
        return NextResponse.json(
            { error: 'Insufficient permissions', code: 'FORBIDDEN' },
            { status: 403 }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const params = QuerySchema.parse(Object.fromEntries(searchParams));

        // Build where clause
        const where: any = {};

        if (params.search) {
            where.OR = [
                { username: { contains: params.search, mode: 'insensitive' } },
                { email: { contains: params.search, mode: 'insensitive' } }
            ];
        }

        if (params.role) {
            where.role = params.role;
        }

        // Get total count
        const totalUsers = await prisma.user.count({ where });

        // Get paginated users
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                Portfolio: {
                    select: {
                        id: true,
                        isPublic: true,
                        _count: {
                            select: { Asset: true }
                        }
                    }
                }
            },
            orderBy: { [params.sortBy]: params.sortOrder },
            skip: (params.page - 1) * params.pageSize,
            take: params.pageSize
        });

        // Transform response
        const formattedUsers = users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
            portfolio: user.Portfolio ? {
                id: user.Portfolio.id,
                isPublic: user.Portfolio.isPublic,
                assetCount: user.Portfolio._count.Asset
            } : null
        }));

        return NextResponse.json({
            success: true,
            data: {
                users: formattedUsers,
                pagination: {
                    page: params.page,
                    pageSize: params.pageSize,
                    totalUsers,
                    totalPages: Math.ceil(totalUsers / params.pageSize),
                    hasNextPage: params.page < Math.ceil(totalUsers / params.pageSize),
                    hasPrevPage: params.page > 1
                }
            }
        });

    } catch (error) {
        console.error('[Admin Users] Error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid query parameters', details: error.issues },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to fetch users', code: 'FETCH_FAILED' },
            { status: 500 }
        );
    }
}

// Update user schema
const UpdateUserSchema = z.object({
    userId: z.string(),
    role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional()
});

export async function PATCH(request: NextRequest) {
    // Apply rate limiting
    const middlewareResult = await apiMiddleware(request, { rateLimit: STRICT_RATE_LIMIT });
    if (middlewareResult) return middlewareResult;

    // SECURITY: Require SUPER_ADMIN for role changes
    const adminUser = await requireSuperAdminAccess();
    if (!adminUser) {
        return NextResponse.json(
            { error: 'Super admin access required', code: 'FORBIDDEN' },
            { status: 403 }
        );
    }

    try {
        const body = await request.json();
        const validated = UpdateUserSchema.parse(body);

        // Prevent self-demotion
        if (validated.userId === adminUser.id && validated.role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'Cannot change your own role', code: 'SELF_MODIFICATION' },
                { status: 400 }
            );
        }

        // Get target user
        const targetUser = await prisma.user.findUnique({
            where: { id: validated.userId },
            select: { id: true, username: true, role: true }
        });

        if (!targetUser) {
            return NextResponse.json(
                { error: 'User not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: validated.userId },
            data: {
                ...(validated.role && { role: validated.role })
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                updatedAt: true
            }
        });

        // Track activity
        await trackActivity('SYSTEM', 'UPDATE', {
            userId: adminUser.id,
            username: adminUser.username,
            targetType: 'USER',
            targetId: targetUser.id,
            details: {
                targetUsername: targetUser.username,
                previousRole: targetUser.role,
                newRole: validated.role
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                user: {
                    ...updatedUser,
                    updatedAt: updatedUser.updatedAt.toISOString()
                }
            }
        });

    } catch (error) {
        console.error('[Admin Users] Update error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid request body', details: error.issues },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to update user', code: 'UPDATE_FAILED' },
            { status: 500 }
        );
    }
}
