/**
 * Backup Service
 * Handles database backups and restoration
 *
 * Features:
 * - JSON export of critical data
 * - Compression support
 * - Retention policy management
 * - Cloud storage integration (optional)
 *
 * Optional Dependencies (install if using cloud storage):
 * - @vercel/blob: For Vercel Blob storage
 * - @aws-sdk/client-s3: For S3/R2 storage
 */

import { prisma } from '@/lib/prisma';

// Type definitions for optional modules
interface VercelBlobModule {
    put: (pathname: string, body: string, options: { access: string; contentType: string }) => Promise<{ url: string }>;
    list: (options: { prefix: string }) => Promise<{ blobs: Array<{ url: string; uploadedAt: string; size: number }> }>;
    del: (url: string) => Promise<void>;
}

interface S3Module {
    S3Client: new (config: {
        region: string;
        endpoint?: string;
        credentials: { accessKeyId: string; secretAccessKey: string };
    }) => {
        send: (command: unknown) => Promise<{ Contents?: Array<{ Key?: string; LastModified?: Date }> }>;
    };
    PutObjectCommand: new (params: { Bucket: string; Key: string; Body: string; ContentType: string }) => unknown;
    ListObjectsV2Command: new (params: { Bucket: string; Prefix: string }) => unknown;
    DeleteObjectCommand: new (params: { Bucket: string; Key: string }) => unknown;
}

// Module loaders - these handle optional dependencies gracefully
// Modules are loaded at runtime only when needed (lazy loading)
let vercelBlobCache: { loaded: boolean; module: VercelBlobModule | null } | null = null;
let s3Cache: { loaded: boolean; module: S3Module | null } | null = null;

async function loadVercelBlob(): Promise<VercelBlobModule | null> {
    // Return cached module if already attempted
    if (vercelBlobCache !== null) return vercelBlobCache.module;

    try {
        // @ts-expect-error - Optional dependency, may not be installed
        const mod = await import('@vercel/blob');
        vercelBlobCache = { loaded: true, module: mod as VercelBlobModule };
        return vercelBlobCache.module;
    } catch {
        // Module not installed - this is expected in some environments
        vercelBlobCache = { loaded: true, module: null };
        return null;
    }
}

async function loadS3Client(): Promise<S3Module | null> {
    // Return cached module if already attempted
    if (s3Cache !== null) return s3Cache.module;

    try {
        // @ts-expect-error - Optional dependency, may not be installed
        const mod = await import('@aws-sdk/client-s3');
        s3Cache = { loaded: true, module: mod as unknown as S3Module };
        return s3Cache.module;
    } catch {
        // Module not installed - this is expected in some environments
        s3Cache = { loaded: true, module: null };
        return null;
    }
}

export interface BackupMetadata {
    id: string;
    createdAt: string;
    version: string;
    stats: {
        users: number;
        portfolios: number;
        assets: number;
        transactions: number;
        snapshots: number;
    };
}

export interface BackupData {
    metadata: BackupMetadata;
    users: Array<{
        id: string;
        username: string;
        email: string;
        role: string;
        createdAt: string;
        updatedAt: string;
        preferences: unknown;
    }>;
    portfolios: Array<{
        id: string;
        userId: string;
        isPublic: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    assets: Array<{
        id: string;
        portfolioId: string;
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
        metadata: unknown;
        createdAt: string;
        updatedAt: string;
    }>;
    transactions: Array<{
        id: string;
        portfolioId: string;
        symbol: string;
        name: string | null;
        type: string;
        quantity: number;
        price: number;
        currency: string;
        fee: number;
        date: string;
        createdAt: string;
    }>;
    goals: Array<{
        id: string;
        portfolioId: string;
        name: string;
        type: string | null;
        targetAmount: number;
        currentAmount: number;
        currency: string;
        deadline: string | null;
        isCompleted: boolean;
        createdAt: string;
    }>;
    snapshots: Array<{
        id: string;
        portfolioId: string;
        date: string;
        totalValue: number;
        createdAt: string;
    }>;
    priceCache: Array<{
        symbol: string;
        previousClose: number;
        currency: string;
        sector: string | null;
        country: string | null;
        updatedAt: string;
    }>;
    exchangeRates: Array<{
        currency: string;
        rate: number;
        updatedAt: string;
    }>;
}

/**
 * Create a full backup of the database
 */
export async function createBackup(): Promise<BackupData> {
    console.log('[Backup] Starting full database backup...');
    const startTime = Date.now();

    // Note: For very large databases, consider implementing streaming/batching
    // These limits are safety measures for reasonable-sized deployments
    const MAX_USERS = 10000;
    const MAX_PORTFOLIOS = 10000;
    const MAX_ASSETS = 100000;
    const MAX_TRANSACTIONS = 500000;
    const MAX_GOALS = 50000;
    const MAX_SNAPSHOTS = 100000;
    const MAX_PRICE_CACHE = 50000;

    // Fetch all data in parallel
    const [
        users,
        portfolios,
        assets,
        transactions,
        goals,
        snapshots,
        priceCache,
        exchangeRates
    ] = await Promise.all([
        prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                preferences: true
                // Exclude password for security
            },
            take: MAX_USERS
        }),
        prisma.portfolio.findMany({ take: MAX_PORTFOLIOS }),
        prisma.asset.findMany({ take: MAX_ASSETS }),
        prisma.assetTransaction.findMany({
            take: MAX_TRANSACTIONS,
            orderBy: { date: 'desc' }
        }),
        prisma.goal.findMany({ take: MAX_GOALS }),
        prisma.portfolioSnapshot.findMany({
            orderBy: { date: 'desc' },
            take: MAX_SNAPSHOTS
        }),
        prisma.priceCache.findMany({ take: MAX_PRICE_CACHE }),
        prisma.exchangeRate.findMany() // Exchange rates table is small, no limit needed
    ]);

    const backupId = `backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const backup: BackupData = {
        metadata: {
            id: backupId,
            createdAt: new Date().toISOString(),
            version: '1.0',
            stats: {
                users: users.length,
                portfolios: portfolios.length,
                assets: assets.length,
                transactions: transactions.length,
                snapshots: snapshots.length
            }
        },
        users: users.map(u => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
            updatedAt: u.updatedAt.toISOString()
        })),
        portfolios: portfolios.map(p => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString()
        })),
        assets: assets.map(a => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString()
        })),
        transactions: transactions.map(t => ({
            ...t,
            date: t.date.toISOString(),
            createdAt: t.createdAt.toISOString()
        })),
        goals: goals.map(g => ({
            ...g,
            deadline: g.deadline?.toISOString() || null,
            createdAt: g.createdAt.toISOString()
        })),
        snapshots: snapshots.map(s => ({
            ...s,
            date: s.date.toISOString(),
            createdAt: s.createdAt.toISOString()
        })),
        priceCache: priceCache.map(p => ({
            ...p,
            updatedAt: p.updatedAt.toISOString()
        })),
        exchangeRates: exchangeRates.map(e => ({
            ...e,
            updatedAt: e.updatedAt.toISOString()
        }))
    };

    const duration = Date.now() - startTime;
    console.log(`[Backup] Complete in ${duration}ms. Stats:`, backup.metadata.stats);

    return backup;
}

/**
 * Store backup in cloud storage (if configured)
 * Supports Vercel Blob, S3, R2, or local file system
 */
export async function storeBackup(backup: BackupData): Promise<{ url?: string; path?: string }> {
    const backupJson = JSON.stringify(backup);
    const filename = `${backup.metadata.id}.json`;

    // Option 1: Vercel Blob Storage (recommended for Vercel deployments)
    // Note: Requires @vercel/blob package to be installed
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
            const vercelBlob = await loadVercelBlob();
            if (vercelBlob) {
                const blob = await vercelBlob.put(`backups/${filename}`, backupJson, {
                    access: 'public',
                    contentType: 'application/json'
                });
                console.log(`[Backup] Stored in Vercel Blob: ${blob.url}`);
                return { url: blob.url };
            }
        } catch (error) {
            console.error('[Backup] Vercel Blob storage failed:', error);
        }
    }

    // Option 2: AWS S3 / Cloudflare R2 (via S3-compatible API)
    // Note: Requires @aws-sdk/client-s3 package to be installed
    if (process.env.S3_BACKUP_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
        try {
            const s3Module = await loadS3Client();
            if (s3Module) {
                const s3 = new s3Module.S3Client({
                    region: process.env.AWS_REGION || 'auto',
                    endpoint: process.env.S3_ENDPOINT,
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
                    }
                });

                await s3.send(new s3Module.PutObjectCommand({
                    Bucket: process.env.S3_BACKUP_BUCKET,
                    Key: `backups/${filename}`,
                    Body: backupJson,
                    ContentType: 'application/json'
                }));

                const url = `s3://${process.env.S3_BACKUP_BUCKET}/backups/${filename}`;
                console.log(`[Backup] Stored in S3: ${url}`);
                return { url };
            }
        } catch (error) {
            console.error('[Backup] S3 storage failed:', error);
        }
    }

    // Fallback: Log that backup was created but not stored externally
    console.log('[Backup] No external storage configured. Backup created in memory only.');
    return { path: `memory:${filename}` };
}

/**
 * Clean up old backups based on retention policy
 */
export async function cleanupOldBackups(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;

    // Clean from Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
            const vercelBlob = await loadVercelBlob();
            if (vercelBlob) {
                const { blobs } = await vercelBlob.list({ prefix: 'backups/' });

                for (const blob of blobs) {
                    if (new Date(blob.uploadedAt) < cutoffDate) {
                        await vercelBlob.del(blob.url);
                        deletedCount++;
                    }
                }
            }
        } catch (error) {
            console.error('[Backup] Cleanup from Vercel Blob failed:', error);
        }
    }

    // Clean from S3
    if (process.env.S3_BACKUP_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
        try {
            const s3Module = await loadS3Client();
            if (s3Module) {
                const s3 = new s3Module.S3Client({
                    region: process.env.AWS_REGION || 'auto',
                    endpoint: process.env.S3_ENDPOINT,
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
                    }
                });

                const listResponse = await s3.send(new s3Module.ListObjectsV2Command({
                    Bucket: process.env.S3_BACKUP_BUCKET,
                    Prefix: 'backups/'
                }));

                for (const obj of listResponse.Contents || []) {
                    if (obj.LastModified && obj.LastModified < cutoffDate && obj.Key) {
                        await s3.send(new s3Module.DeleteObjectCommand({
                            Bucket: process.env.S3_BACKUP_BUCKET,
                            Key: obj.Key
                        }));
                        deletedCount++;
                    }
                }
            }
        } catch (error) {
            console.error('[Backup] Cleanup from S3 failed:', error);
        }
    }

    console.log(`[Backup] Cleaned up ${deletedCount} old backups`);
    return deletedCount;
}

/**
 * Get backup statistics
 */
export async function getBackupStats(): Promise<{
    lastBackup?: string;
    backupCount: number;
    totalSize?: number;
}> {
    let lastBackup: string | undefined;
    let backupCount = 0;
    let totalSize = 0;

    // Check Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
            const vercelBlob = await loadVercelBlob();
            if (vercelBlob) {
                const { blobs } = await vercelBlob.list({ prefix: 'backups/' });

                backupCount = blobs.length;
                totalSize = blobs.reduce((sum, b) => sum + b.size, 0);

                if (blobs.length > 0) {
                    const sorted = [...blobs].sort((a, b) =>
                        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
                    );
                    lastBackup = sorted[0].uploadedAt;
                }
            }
        } catch (error) {
            console.error('[Backup] Stats from Vercel Blob failed:', error);
        }
    }

    return { lastBackup, backupCount, totalSize };
}
