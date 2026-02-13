/**
 * GDPR/KVKK Account Deletion API
 * Permanently deletes all user data
 *
 * DELETE /api/gdpr/delete
 * Requires: confirmation=true query parameter
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { trackActivity } from '@/services/telemetry';
import { apiMiddleware, AUTH_RATE_LIMIT } from '@/lib/api-security';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function DELETE(request: NextRequest) {
    // Apply strict rate limiting for account deletion
    const middlewareResult = await apiMiddleware(request, { rateLimit: AUTH_RATE_LIMIT });
    if (middlewareResult) return middlewareResult;

    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Authentication required', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // Require explicit confirmation
        const { searchParams } = new URL(request.url);
        const confirmation = searchParams.get('confirmation');

        if (confirmation !== 'DELETE_MY_ACCOUNT') {
            return NextResponse.json(
                {
                    error: 'Confirmation required',
                    code: 'CONFIRMATION_REQUIRED',
                    message: 'Add ?confirmation=DELETE_MY_ACCOUNT to confirm permanent deletion'
                },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { Portfolio: true }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        const portfolioId = user.Portfolio?.id;

        // Track deletion before deleting (for compliance audit trail)
        await trackActivity('AUTH', 'DELETE_ACCOUNT', {
            userId: user.id,
            username: user.username,
            details: {
                email: user.email,
                portfolioId: portfolioId,
                deletedAt: new Date().toISOString(),
                source: 'GDPR_API'
            }
        });

        // Use transaction for atomic deletion
        await prisma.$transaction(async (tx) => {
            if (portfolioId) {
                // Delete all portfolio-related data
                await tx.asset.deleteMany({ where: { portfolioId } });
                await tx.assetTransaction.deleteMany({ where: { portfolioId } });
                await tx.goal.deleteMany({ where: { portfolioId } });
                await tx.portfolioSnapshot.deleteMany({ where: { portfolioId } });
                await tx.portfolio.delete({ where: { id: portfolioId } });
            }

            // Delete user activity logs (anonymize, don't delete for audit)
            await tx.systemActivityLog.updateMany({
                where: { userId: user.id },
                data: {
                    userId: undefined,
                    username: '[DELETED]',
                    details: Prisma.DbNull
                }
            });

            // Delete user
            await tx.user.delete({ where: { id: user.id } });
        }, {
            timeout: 30000,
            maxWait: 10000
        });

        console.log(`[GDPR Delete] Successfully deleted account for ${user.email}`);

        return NextResponse.json({
            success: true,
            message: 'Account and all associated data have been permanently deleted',
            deletedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('[GDPR Delete] Error:', error);
        return NextResponse.json(
            { error: 'Failed to delete account', code: 'DELETE_FAILED' },
            { status: 500 }
        );
    }
}
