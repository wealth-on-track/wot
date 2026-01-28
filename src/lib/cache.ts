// Optimized in-memory cache with auto-cleanup and size limits
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

const MAX_CACHE_SIZE = 1000; // Maximum entries to prevent memory bloat
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Cleanup every 5 minutes

class SimpleCache {
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Start periodic cleanup
        this.startCleanup();
    }

    private startCleanup(): void {
        if (typeof window === 'undefined' && !this.cleanupTimer) {
            this.cleanupTimer = setInterval(() => this.removeExpired(), CLEANUP_INTERVAL);
        }
    }

    private removeExpired(): void {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            console.log(`[Cache] Cleaned up ${removed} expired entries. Size: ${this.cache.size}`);
        }
    }

    private enforceMaxSize(): void {
        if (this.cache.size <= MAX_CACHE_SIZE) return;

        // Remove oldest entries (FIFO)
        const entriesToRemove = this.cache.size - MAX_CACHE_SIZE;
        const iterator = this.cache.keys();

        for (let i = 0; i < entriesToRemove; i++) {
            const key = iterator.next().value;
            if (key) this.cache.delete(key);
        }
    }

    set<T>(key: string, data: T, ttlMinutes: number = 5): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMinutes * 60 * 1000
        });

        this.enforceMaxSize();
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) return null;

        const isExpired = Date.now() - entry.timestamp > entry.ttl;

        if (isExpired) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}

export const apiCache = new SimpleCache();
