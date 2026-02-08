/**
 * High-Performance LRU Cache with TTL Support
 * - O(1) get/set operations using Map's insertion order
 * - Automatic TTL-based expiration
 * - LRU eviction when max size reached (most recently used items kept)
 * - Memory-efficient with configurable limits
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
    accessCount: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
}

const MAX_CACHE_SIZE = 1000;
const CLEANUP_INTERVAL = 60 * 1000; // Cleanup every 1 minute (was 5)
const DEFAULT_TTL_MINUTES = 5;

class LRUCache {
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;
    private stats: CacheStats = { hits: 0, misses: 0, evictions: 0 };

    constructor() {
        this.startCleanup();
    }

    private startCleanup(): void {
        if (typeof window === 'undefined' && !this.cleanupTimer) {
            this.cleanupTimer = setInterval(() => this.removeExpired(), CLEANUP_INTERVAL);
            // Prevent timer from keeping Node.js process alive
            if (this.cleanupTimer.unref) {
                this.cleanupTimer.unref();
            }
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

        if (removed > 0 && process.env.NODE_ENV === 'development') {
            console.log(`[Cache] Cleaned ${removed} expired. Size: ${this.cache.size}, Hit rate: ${this.getHitRate()}%`);
        }
    }

    /**
     * LRU Eviction - Remove least recently used entries
     * Map maintains insertion order, so we delete from the beginning
     * Re-inserting on access moves items to the end (most recent)
     */
    private enforceMaxSize(): void {
        if (this.cache.size <= MAX_CACHE_SIZE) return;

        const entriesToRemove = this.cache.size - MAX_CACHE_SIZE;
        const iterator = this.cache.keys();

        for (let i = 0; i < entriesToRemove; i++) {
            const key = iterator.next().value;
            if (key) {
                this.cache.delete(key);
                this.stats.evictions++;
            }
        }
    }

    set<T>(key: string, data: T, ttlMinutes: number = DEFAULT_TTL_MINUTES): void {
        // Delete first to update position (move to end = most recent)
        this.cache.delete(key);

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMinutes * 60 * 1000,
            accessCount: 0
        });

        this.enforceMaxSize();
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        const isExpired = Date.now() - entry.timestamp > entry.ttl;

        if (isExpired) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        // LRU: Move to end by re-inserting (most recently used)
        this.cache.delete(key);
        entry.accessCount++;
        this.cache.set(key, entry);

        this.stats.hits++;
        return entry.data as T;
    }

    /**
     * Get without updating LRU position (for checking existence)
     */
    peek<T>(key: string): T | null {
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
        return this.peek(key) !== null;
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, evictions: 0 };
    }

    get size(): number {
        return this.cache.size;
    }

    getStats(): CacheStats & { hitRate: string } {
        return {
            ...this.stats,
            hitRate: this.getHitRate()
        };
    }

    private getHitRate(): string {
        const total = this.stats.hits + this.stats.misses;
        if (total === 0) return '0.00';
        return ((this.stats.hits / total) * 100).toFixed(2);
    }

    /**
     * Batch get - efficient for multiple keys
     */
    getMany<T>(keys: string[]): Map<string, T> {
        const results = new Map<string, T>();
        for (const key of keys) {
            const value = this.get<T>(key);
            if (value !== null) {
                results.set(key, value);
            }
        }
        return results;
    }

    /**
     * Batch set - efficient for multiple entries
     */
    setMany<T>(entries: Array<{ key: string; data: T; ttlMinutes?: number }>): void {
        for (const { key, data, ttlMinutes } of entries) {
            this.set(key, data, ttlMinutes);
        }
    }
}

export const apiCache = new LRUCache();
