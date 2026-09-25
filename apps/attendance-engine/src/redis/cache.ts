import Redis from 'ioredis';
import { config } from '../config.js';

export interface CachedSessionMeta {
  id: string;
  classroomId: string;
  sectionId: string;
  facultyId: string;
  status: string;
  secretSeed: string;
  qrExpiresAt: string;
  isAttendanceLocked: boolean;
  totalEnrolled: number;
}

class ResilientCacheManager {
  private redisClient: Redis | null = null;
  private isConnected = false;

  // In-memory transparent fallback store if Redis is unavailable
  private memoryCache = new Map<string, { val: any; expiresAt: number }>();
  private memoryCounters = new Map<string, number>();
  private memoryRateLimits = new Map<string, number[]>();

  constructor() {
    this.initRedis();
  }

  private initRedis() {
    if (config.redisUrl) {
      try {
        this.redisClient = new Redis(config.redisUrl, {
          maxRetriesPerRequest: 2,
          retryStrategy(times) {
            // Reconnect with backoff capped at 3s
            return Math.min(times * 100, 3000);
          },
          lazyConnect: true,
        });

        this.redisClient.connect().then(() => {
          this.isConnected = true;
          console.log('⚡ [Redis] Connected to cluster/instance successfully.');
        }).catch((err) => {
          console.warn('⚠️ [Redis] Connection failed, activating in-memory fallback:', err.message);
          this.isConnected = false;
        });

        this.redisClient.on('error', (err) => {
          this.isConnected = false;
        });

        this.redisClient.on('connect', () => {
          this.isConnected = true;
        });
      } catch (err: any) {
        console.warn('⚠️ [Redis] Initialization error, falling back to memory store:', err.message);
        this.isConnected = false;
      }
    } else {
      console.log('ℹ️ [Cache] No REDIS_URL configured; running in high-performance in-memory mode.');
    }
  }

  public getStatus(): { isRedisActive: boolean; mode: string } {
    return {
      isRedisActive: this.isConnected,
      mode: this.isConnected ? 'redis' : 'in-memory-fallback',
    };
  }

  // --- Session Metadata Cache ---
  public async setSessionMeta(sessionId: string, meta: CachedSessionMeta, ttlSeconds: number = 7200): Promise<void> {
    const key = `session:meta:${sessionId}`;
    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(meta), 'EX', ttlSeconds);
        return;
      } catch (err) {
        // Fallback to memory
      }
    }
    this.memoryCache.set(key, { val: meta, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  public async getSessionMeta(sessionId: string): Promise<CachedSessionMeta | null> {
    const key = `session:meta:${sessionId}`;
    if (this.isConnected && this.redisClient) {
      try {
        const data = await this.redisClient.get(key);
        if (data) return JSON.parse(data) as CachedSessionMeta;
      } catch (err) {
        // Fallback to memory
      }
    }
    const mem = this.memoryCache.get(key);
    if (mem) {
      if (Date.now() > mem.expiresAt) {
        this.memoryCache.delete(key);
        return null;
      }
      return mem.val;
    }
    return null;
  }

  public async invalidateSession(sessionId: string): Promise<void> {
    const key = `session:meta:${sessionId}`;
    const countKey = `session:count:${sessionId}`;
    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.del(key, countKey);
      } catch (err) {}
    }
    this.memoryCache.delete(key);
    this.memoryCounters.delete(countKey);
  }

  // --- Rate Limiting (Sliding Window) ---
  public async checkRateLimit(keyPrefix: string, identifier: string, maxRequests: number = 5, windowSec: number = 10): Promise<{ allowed: boolean; remaining: number }> {
    const key = `rate:${keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSec * 1000;

    if (this.isConnected && this.redisClient) {
      try {
        const pipeline = this.redisClient.pipeline();
        pipeline.zremrangebyscore(key, 0, windowStart);
        pipeline.zadd(key, now, `${now}-${Math.random()}`);
        pipeline.zcard(key);
        pipeline.expire(key, windowSec + 1);
        const results = await pipeline.exec();
        const count = (results?.[2]?.[1] as number) || 0;
        return {
          allowed: count <= maxRequests,
          remaining: Math.max(0, maxRequests - count),
        };
      } catch (err) {
        // Fallback to memory
      }
    }

    // Memory fallback
    let timestamps = this.memoryRateLimits.get(key) || [];
    timestamps = timestamps.filter(t => t > windowStart);
    timestamps.push(now);
    this.memoryRateLimits.set(key, timestamps);

    return {
      allowed: timestamps.length <= maxRequests,
      remaining: Math.max(0, maxRequests - timestamps.length),
    };
  }

  // --- Session Headcount Counters ---
  public async incrementSessionCount(sessionId: string): Promise<number> {
    const key = `session:count:${sessionId}`;
    if (this.isConnected && this.redisClient) {
      try {
        return await this.redisClient.incr(key);
      } catch (err) {}
    }
    const current = (this.memoryCounters.get(key) || 0) + 1;
    this.memoryCounters.set(key, current);
    return current;
  }

  public async getSessionCount(sessionId: string): Promise<number> {
    const key = `session:count:${sessionId}`;
    if (this.isConnected && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        return val ? parseInt(val, 10) : 0;
      } catch (err) {}
    }
    return this.memoryCounters.get(key) || 0;
  }

  public async setSessionCount(sessionId: string, count: number): Promise<void> {
    const key = `session:count:${sessionId}`;
    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.set(key, count.toString(), 'EX', 7200);
        return;
      } catch (err) {}
    }
    this.memoryCounters.set(key, count);
  }

  public async get(key: string): Promise<any | null> {
    if (this.isConnected && this.redisClient) {
      try {
        return await this.redisClient.get(key);
      } catch (err) {}
    }
    const mem = this.memoryCache.get(key);
    if (mem && Date.now() <= mem.expiresAt) {
      return mem.val;
    }
    return null;
  }

  public async set(key: string, val: any, ttlSeconds: number = 60): Promise<void> {
    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(val), 'EX', ttlSeconds);
        return;
      } catch (err) {}
    }
    this.memoryCache.set(key, { val, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

export const cacheManager = new ResilientCacheManager();
