/**
 * Redis Client for Rate Limiting and Caching
 * Uses @upstash/redis for serverless compatibility
 * Falls back to in-memory store if Redis is not configured
 */

// ============================================
// TYPES
// ============================================

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

export interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Maximum requests per window
}

// ============================================
// IN-MEMORY FALLBACK (Development only)
// ============================================

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(
    key: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const entry = memoryStore.get(key);

    // Clean up expired entries periodically
    if (memoryStore.size > 10000) {
        for (const [k, v] of memoryStore) {
            if (v.resetAt < now) {
                memoryStore.delete(k);
            }
        }
    }

    if (!entry || entry.resetAt < now) {
        memoryStore.set(key, {
            count: 1,
            resetAt: now + config.windowMs,
        });
        return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
    }

    if (entry.count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

// ============================================
// REDIS RATE LIMITING
// ============================================

let redisUrl: string | undefined;

// Check if Redis is configured
function isRedisConfigured(): boolean {
    if (redisUrl === undefined) {
        redisUrl = process.env.REDIS_URL || '';
    }
    return redisUrl.length > 0;
}

/**
 * Rate limit check using Redis sliding window
 * Falls back to in-memory if Redis not configured
 */
export async function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const key = `ratelimit:${identifier}`;

    // Use in-memory fallback if Redis not configured
    if (!isRedisConfigured()) {
        if (process.env.NODE_ENV === 'production') {
            console.warn('[SECURITY] Redis not configured - using in-memory rate limiting (NOT recommended for production)');
        }
        return memoryRateLimit(key, config);
    }

    try {
        // Dynamic import to avoid issues when Redis is not configured
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({
            url: process.env.REDIS_URL!,
            token: process.env.REDIS_TOKEN || '',
        });

        const now = Date.now();
        const windowStart = now - config.windowMs;
        const windowKey = `${key}:${Math.floor(now / config.windowMs)}`;

        // Use Redis MULTI for atomic operations
        const pipeline = redis.pipeline();

        // Increment counter for current window
        pipeline.incr(windowKey);
        // Set expiration (slightly longer than window to account for edge cases)
        pipeline.pexpire(windowKey, config.windowMs + 1000);

        const results = await pipeline.exec();
        const currentCount = results[0] as number;

        if (currentCount > config.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: (Math.floor(now / config.windowMs) + 1) * config.windowMs,
            };
        }

        return {
            allowed: true,
            remaining: config.maxRequests - currentCount,
            resetAt: (Math.floor(now / config.windowMs) + 1) * config.windowMs,
        };
    } catch (error) {
        console.error('[Redis] Rate limit check failed, falling back to memory:', error);
        // Fallback to memory on error
        return memoryRateLimit(key, config);
    }
}

// ============================================
// REDIS CACHE HELPERS
// ============================================

/**
 * Get value from Redis cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
    if (!isRedisConfigured()) {
        return null;
    }

    try {
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({
            url: process.env.REDIS_URL!,
            token: process.env.REDIS_TOKEN || '',
        });

        return await redis.get<T>(key);
    } catch (error) {
        console.error('[Redis] Cache get failed:', error);
        return null;
    }
}

/**
 * Set value in Redis cache with TTL
 */
export async function cacheSet(
    key: string,
    value: unknown,
    ttlSeconds: number
): Promise<boolean> {
    if (!isRedisConfigured()) {
        return false;
    }

    try {
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({
            url: process.env.REDIS_URL!,
            token: process.env.REDIS_TOKEN || '',
        });

        await redis.setex(key, ttlSeconds, value);
        return true;
    } catch (error) {
        console.error('[Redis] Cache set failed:', error);
        return false;
    }
}

/**
 * Delete key from Redis cache
 */
export async function cacheDelete(key: string): Promise<boolean> {
    if (!isRedisConfigured()) {
        return false;
    }

    try {
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({
            url: process.env.REDIS_URL!,
            token: process.env.REDIS_TOKEN || '',
        });

        await redis.del(key);
        return true;
    } catch (error) {
        console.error('[Redis] Cache delete failed:', error);
        return false;
    }
}
