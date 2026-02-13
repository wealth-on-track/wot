/**
 * GDPR/KVKK Consent Management API
 * Manages user privacy preferences and consent records
 *
 * GET /api/gdpr/consent - Get current consent status
 * POST /api/gdpr/consent - Update consent preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { trackActivity } from '@/services/telemetry';
import { z } from 'zod';
import { apiMiddleware, STRICT_RATE_LIMIT } from '@/lib/api-security';

export const dynamic = 'force-dynamic';

// Consent categories
const ConsentSchema = z.object({
    analytics: z.boolean().optional(),
    marketing: z.boolean().optional(),
    thirdPartySharing: z.boolean().optional(),
    portfolioPublic: z.boolean().optional()
});

type ConsentPreferences = z.infer<typeof ConsentSchema>;

interface UserPreferences {
    consent?: ConsentPreferences & {
        updatedAt?: string;
        version?: string;
    };
    [key: string]: unknown;
}

export async function GET(request: NextRequest) {
    // Apply rate limiting
    const middlewareResult = await apiMiddleware(request, { rateLimit: STRICT_RATE_LIMIT });
    if (middlewareResult) return middlewareResult;

    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Authentication required', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                preferences: true,
                Portfolio: { select: { isPublic: true } }
            }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        const preferences = (user.preferences as UserPreferences) || {};
        const consent = preferences.consent || {};

        return NextResponse.json({
            consent: {
                analytics: consent.analytics ?? true, // Default to true
                marketing: consent.marketing ?? false, // Default to false
                thirdPartySharing: consent.thirdPartySharing ?? false,
                portfolioPublic: user.Portfolio?.isPublic ?? true,
                updatedAt: consent.updatedAt || null,
                version: consent.version || '1.0'
            },
            dataRetentionPolicy: {
                accountData: 'Until deletion requested',
                activityLogs: '2 years',
                snapshots: '5 years',
                anonymizedAnalytics: 'Indefinite'
            }
        });

    } catch (error) {
        console.error('[GDPR Consent GET] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get consent status', code: 'FETCH_FAILED' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    // Apply rate limiting
    const middlewareResult = await apiMiddleware(request, { rateLimit: STRICT_RATE_LIMIT });
    if (middlewareResult) return middlewareResult;

    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Authentication required', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const validated = ConsentSchema.safeParse(body);

        if (!validated.success) {
            return NextResponse.json(
                {
                    error: 'Invalid consent data',
                    code: 'VALIDATION_ERROR',
                    details: validated.error.flatten()
                },
                { status: 400 }
            );
        }

        const consentData = validated.data;

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { preferences: true, username: true, Portfolio: { select: { id: true } } }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        const currentPreferences = (user.preferences as UserPreferences) || {};

        // Update consent in preferences
        const updatedPreferences: UserPreferences = {
            ...currentPreferences,
            consent: {
                ...currentPreferences.consent,
                ...consentData,
                updatedAt: new Date().toISOString(),
                version: '1.0'
            }
        };

        // Update user preferences
        await prisma.user.update({
            where: { id: session.user.id },
            data: { preferences: updatedPreferences as object }
        });

        // Update portfolio visibility if specified
        if (consentData.portfolioPublic !== undefined && user.Portfolio?.id) {
            await prisma.portfolio.update({
                where: { id: user.Portfolio.id },
                data: { isPublic: consentData.portfolioPublic }
            });
        }

        // Track consent update
        await trackActivity('SYSTEM', 'UPDATE', {
            userId: session.user.id,
            username: user.username,
            targetType: 'CONSENT',
            details: {
                updatedFields: Object.keys(consentData),
                newValues: consentData
            }
        });

        return NextResponse.json({
            success: true,
            consent: updatedPreferences.consent,
            message: 'Consent preferences updated successfully'
        });

    } catch (error) {
        console.error('[GDPR Consent POST] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update consent', code: 'UPDATE_FAILED' },
            { status: 500 }
        );
    }
}
