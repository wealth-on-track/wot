/**
 * GDPR/KVKK Data Export API
 * Allows users to download all their personal data
 *
 * GET /api/gdpr/export
 * Returns: JSON file with all user data
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { trackActivity } from '@/services/telemetry';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ExportData {
    exportedAt: string;
    version: string;
    user: {
        id: string;
        username: string;
        email: string;
        role: string;
        createdAt: string;
        updatedAt: string;
        preferences: unknown;
    };
    portfolio: {
        id: string;
        isPublic: boolean;
        createdAt: string;
        updatedAt: string;
    } | null;
    assets: Array<{
        id: string;
        symbol: string;
        name: string | null;
        type: string;
        category: string;
        quantity: number;
        buyPrice: number;
        currency: string;
        exchange: string;
        sector: string;
        country: string;
        platform: string | null;
        customGroup: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    transactions: Array<{
        id: string;
        symbol: string;
        name: string | null;
        type: string;
        quantity: number;
        price: number;
        currency: string;
        fee: number;
        date: string;
        exchange: string | null;
        platform: string | null;
        createdAt: string;
    }>;
    goals: Array<{
        id: string;
        name: string;
        type: string | null;
        targetAmount: number;
        currentAmount: number;
        currency: string;
        deadline: string | null;
        isCompleted: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    snapshots: Array<{
        id: string;
        date: string;
        totalValue: number;
        createdAt: string;
    }>;
    activityLogs: Array<{
        activityType: string;
        action: string;
        status: string;
        createdAt: string;
    }>;
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Authentication required', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // Fetch all user data
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                Portfolio: {
                    include: {
                        Asset: {
                            orderBy: { createdAt: 'desc' }
                        },
                        AssetTransaction: {
                            orderBy: { date: 'desc' }
                        },
                        Goal: {
                            orderBy: { createdAt: 'desc' }
                        },
                        PortfolioSnapshot: {
                            orderBy: { date: 'desc' },
                            take: 365 // Last year of snapshots
                        }
                    }
                }
            }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        // Fetch activity logs for this user
        const activityLogs = await prisma.systemActivityLog.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 1000, // Last 1000 activities
            select: {
                activityType: true,
                action: true,
                status: true,
                createdAt: true
            }
        });

        // Build export data
        const exportData: ExportData = {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt.toISOString(),
                updatedAt: user.updatedAt.toISOString(),
                preferences: user.preferences
            },
            portfolio: user.Portfolio ? {
                id: user.Portfolio.id,
                isPublic: user.Portfolio.isPublic,
                createdAt: user.Portfolio.createdAt.toISOString(),
                updatedAt: user.Portfolio.updatedAt.toISOString()
            } : null,
            assets: (user.Portfolio?.Asset || []).map(asset => ({
                id: asset.id,
                symbol: asset.symbol,
                name: asset.name,
                type: asset.type,
                category: asset.category,
                quantity: asset.quantity,
                buyPrice: asset.buyPrice,
                currency: asset.currency,
                exchange: asset.exchange,
                sector: asset.sector,
                country: asset.country,
                platform: asset.platform,
                customGroup: asset.customGroup,
                createdAt: asset.createdAt.toISOString(),
                updatedAt: asset.updatedAt.toISOString()
            })),
            transactions: (user.Portfolio?.AssetTransaction || []).map(tx => ({
                id: tx.id,
                symbol: tx.symbol,
                name: tx.name,
                type: tx.type,
                quantity: tx.quantity,
                price: tx.price,
                currency: tx.currency,
                fee: tx.fee,
                date: tx.date.toISOString(),
                exchange: tx.exchange,
                platform: tx.platform,
                createdAt: tx.createdAt.toISOString()
            })),
            goals: (user.Portfolio?.Goal || []).map(goal => ({
                id: goal.id,
                name: goal.name,
                type: goal.type,
                targetAmount: goal.targetAmount,
                currentAmount: goal.currentAmount,
                currency: goal.currency,
                deadline: goal.deadline?.toISOString() || null,
                isCompleted: goal.isCompleted,
                createdAt: goal.createdAt.toISOString(),
                updatedAt: goal.updatedAt.toISOString()
            })),
            snapshots: (user.Portfolio?.PortfolioSnapshot || []).map(snap => ({
                id: snap.id,
                date: snap.date.toISOString(),
                totalValue: snap.totalValue,
                createdAt: snap.createdAt.toISOString()
            })),
            activityLogs: activityLogs.map(log => ({
                activityType: log.activityType,
                action: log.action,
                status: log.status,
                createdAt: log.createdAt.toISOString()
            }))
        };

        // Track data export
        await trackActivity('SYSTEM', 'EXPORT', {
            userId: user.id,
            username: user.username,
            details: {
                exportType: 'GDPR_FULL',
                assetsCount: exportData.assets.length,
                transactionsCount: exportData.transactions.length
            }
        });

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `wealthontrack-export-${user.username}-${timestamp}.json`;

        // Return as downloadable JSON
        return new NextResponse(JSON.stringify(exportData, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store'
            }
        });

    } catch (error) {
        console.error('[GDPR Export] Error:', error);
        return NextResponse.json(
            { error: 'Failed to export data', code: 'EXPORT_FAILED' },
            { status: 500 }
        );
    }
}
