import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock api-security (to bypass rate limiting in tests)
vi.mock('@/lib/api-security', () => ({
    apiMiddleware: vi.fn().mockResolvedValue(null), // null means "proceed"
    STRICT_RATE_LIMIT: { windowMs: 60000, maxRequests: 10 },
    AUTH_RATE_LIMIT: { windowMs: 60000, maxRequests: 5 }
}));

// Mock auth
vi.mock('@/auth', () => ({
    auth: vi.fn()
}));

// Mock prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        portfolio: {
            update: vi.fn(),
            delete: vi.fn()
        },
        asset: {
            deleteMany: vi.fn()
        },
        assetTransaction: {
            deleteMany: vi.fn()
        },
        goal: {
            deleteMany: vi.fn()
        },
        portfolioSnapshot: {
            deleteMany: vi.fn()
        },
        systemActivityLog: {
            findMany: vi.fn(),
            updateMany: vi.fn(),
            create: vi.fn()
        },
        $transaction: vi.fn()
    }
}));

// Mock telemetry
vi.mock('@/services/telemetry', () => ({
    trackActivity: vi.fn()
}));

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

describe('GDPR API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Data Export', () => {
        it('should require authentication', async () => {
            vi.mocked(auth).mockResolvedValue(null);

            // Import dynamically to use mocks
            const { GET } = await import('@/app/api/gdpr/export/route');
            const request = new Request('https://example.com/api/gdpr/export');

            const response = await GET(request as any);
            expect(response.status).toBe(401);
        });

        it('should export user data when authenticated', async () => {
            const mockUser = {
                id: 'user123',
                username: 'testuser',
                email: 'test@example.com',
                role: 'USER',
                createdAt: new Date(),
                updatedAt: new Date(),
                preferences: { theme: 'dark' },
                Portfolio: {
                    id: 'port123',
                    isPublic: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    Asset: [],
                    AssetTransaction: [],
                    Goal: [],
                    PortfolioSnapshot: []
                }
            };

            vi.mocked(auth).mockResolvedValue({ user: { id: 'user123' } } as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
            vi.mocked(prisma.systemActivityLog.findMany).mockResolvedValue([]);

            const { GET } = await import('@/app/api/gdpr/export/route');
            const request = new Request('https://example.com/api/gdpr/export');

            const response = await GET(request as any);
            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('application/json');
            expect(response.headers.get('Content-Disposition')).toContain('attachment');

            const data = await response.json();
            expect(data.user.username).toBe('testuser');
            expect(data.user.email).toBe('test@example.com');
            expect(data.version).toBe('1.0');
        });
    });

    describe('Data Deletion', () => {
        it('should require confirmation parameter', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user123' } } as any);

            const { DELETE } = await import('@/app/api/gdpr/delete/route');
            const request = new Request('https://example.com/api/gdpr/delete', { method: 'DELETE' });

            const response = await DELETE(request as any);
            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.code).toBe('CONFIRMATION_REQUIRED');
        });

        it('should delete account with proper confirmation', async () => {
            const mockUser = {
                id: 'user123',
                username: 'testuser',
                email: 'test@example.com',
                Portfolio: { id: 'port123' }
            };

            vi.mocked(auth).mockResolvedValue({ user: { id: 'user123' } } as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
            vi.mocked(prisma.$transaction).mockResolvedValue(undefined);

            const { DELETE } = await import('@/app/api/gdpr/delete/route');
            const request = new Request('https://example.com/api/gdpr/delete?confirmation=DELETE_MY_ACCOUNT', { method: 'DELETE' });

            const response = await DELETE(request as any);
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
        });
    });

    describe('Consent Management', () => {
        it('should return current consent status', async () => {
            const mockUser = {
                preferences: {
                    consent: {
                        analytics: true,
                        marketing: false,
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                },
                Portfolio: { isPublic: true }
            };

            vi.mocked(auth).mockResolvedValue({ user: { id: 'user123' } } as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

            const { GET } = await import('@/app/api/gdpr/consent/route');
            const request = new Request('https://example.com/api/gdpr/consent');

            const response = await GET(request as any);
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.consent.analytics).toBe(true);
            expect(data.consent.marketing).toBe(false);
            expect(data.dataRetentionPolicy).toBeDefined();
        });

        it('should update consent preferences', async () => {
            const mockUser = {
                username: 'testuser',
                preferences: {},
                Portfolio: { id: 'port123' }
            };

            vi.mocked(auth).mockResolvedValue({ user: { id: 'user123' } } as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
            vi.mocked(prisma.user.update).mockResolvedValue({} as any);
            vi.mocked(prisma.portfolio.update).mockResolvedValue({} as any);

            const { POST } = await import('@/app/api/gdpr/consent/route');
            const request = new Request('https://example.com/api/gdpr/consent', {
                method: 'POST',
                body: JSON.stringify({
                    analytics: true,
                    marketing: false,
                    portfolioPublic: false
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await POST(request as any);
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
        });
    });
});
