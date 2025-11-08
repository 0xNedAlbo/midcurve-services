import { PrismaClient } from '@prisma/client';
import { createServiceLogger, log } from '../../logging/index.js';
export class CacheService {
    static instance = null;
    prisma;
    logger;
    constructor(dependencies = {}) {
        this.prisma = dependencies.prisma ?? new PrismaClient();
        this.logger = createServiceLogger('CacheService');
    }
    static getInstance() {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }
    static resetInstance() {
        CacheService.instance = null;
    }
    async get(key) {
        log.methodEntry(this.logger, 'get', { key });
        try {
            const cached = await this.prisma.cache.findUnique({
                where: { key },
            });
            if (!cached) {
                log.cacheMiss(this.logger, 'get', key);
                log.methodExit(this.logger, 'get', { found: false });
                return null;
            }
            const now = new Date();
            if (now > cached.expiresAt) {
                this.logger.debug({ key, expiresAt: cached.expiresAt }, 'Cache entry expired');
                log.cacheMiss(this.logger, 'get', key);
                this.prisma.cache
                    .delete({ where: { key } })
                    .catch((error) => {
                    this.logger.warn({ key, error }, 'Failed to delete expired cache entry');
                });
                log.methodExit(this.logger, 'get', { found: false, expired: true });
                return null;
            }
            log.cacheHit(this.logger, 'get', key);
            log.methodExit(this.logger, 'get', { found: true });
            return cached.value;
        }
        catch (error) {
            this.logger.warn({ key, error: error instanceof Error ? error.message : 'Unknown error' }, 'Cache get failed, returning null');
            log.methodExit(this.logger, 'get', { found: false, error: true });
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        log.methodEntry(this.logger, 'set', { key, ttlSeconds });
        try {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
            await this.prisma.cache.upsert({
                where: { key },
                create: {
                    key,
                    value: value,
                    expiresAt,
                },
                update: {
                    value: value,
                    expiresAt,
                    updatedAt: now,
                },
            });
            this.logger.debug({ key, expiresAt }, 'Cache entry set');
            log.methodExit(this.logger, 'set', { success: true });
            return true;
        }
        catch (error) {
            this.logger.warn({ key, error: error instanceof Error ? error.message : 'Unknown error' }, 'Cache set failed');
            log.methodExit(this.logger, 'set', { success: false, error: true });
            return false;
        }
    }
    async delete(key) {
        log.methodEntry(this.logger, 'delete', { key });
        try {
            await this.prisma.cache.delete({
                where: { key },
            });
            this.logger.debug({ key }, 'Cache entry deleted');
            log.methodExit(this.logger, 'delete', { success: true });
            return true;
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
                this.logger.debug({ key }, 'Cache entry not found (already deleted or never existed)');
                log.methodExit(this.logger, 'delete', { success: true, notFound: true });
                return true;
            }
            this.logger.warn({ key, error: error instanceof Error ? error.message : 'Unknown error' }, 'Cache delete failed');
            log.methodExit(this.logger, 'delete', { success: false, error: true });
            return false;
        }
    }
    async clear(pattern) {
        log.methodEntry(this.logger, 'clear', { pattern });
        try {
            const where = pattern
                ? {
                    key: {
                        startsWith: pattern.replace('%', ''),
                    },
                }
                : {};
            const result = await this.prisma.cache.deleteMany({ where });
            this.logger.info({ pattern, count: result.count }, 'Cache entries cleared');
            log.methodExit(this.logger, 'clear', { count: result.count });
            return result.count;
        }
        catch (error) {
            this.logger.warn({ pattern, error: error instanceof Error ? error.message : 'Unknown error' }, 'Cache clear failed');
            log.methodExit(this.logger, 'clear', { count: -1, error: true });
            return -1;
        }
    }
    async cleanup() {
        log.methodEntry(this.logger, 'cleanup');
        try {
            const now = new Date();
            const result = await this.prisma.cache.deleteMany({
                where: {
                    expiresAt: {
                        lt: now,
                    },
                },
            });
            this.logger.info({ count: result.count }, 'Expired cache entries cleaned up');
            log.methodExit(this.logger, 'cleanup', { count: result.count });
            return result.count;
        }
        catch (error) {
            this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Cache cleanup failed');
            log.methodExit(this.logger, 'cleanup', { count: -1, error: true });
            return -1;
        }
    }
    async getStats() {
        log.methodEntry(this.logger, 'getStats');
        try {
            const now = new Date();
            const [totalEntries, expiredEntries] = await Promise.all([
                this.prisma.cache.count(),
                this.prisma.cache.count({
                    where: {
                        expiresAt: {
                            lt: now,
                        },
                    },
                }),
            ]);
            const activeEntries = totalEntries - expiredEntries;
            log.methodExit(this.logger, 'getStats', {
                totalEntries,
                expiredEntries,
                activeEntries,
            });
            return {
                totalEntries,
                expiredEntries,
                activeEntries,
            };
        }
        catch (error) {
            this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get cache stats');
            return {
                totalEntries: 0,
                expiredEntries: 0,
                activeEntries: 0,
            };
        }
    }
}
//# sourceMappingURL=cache-service.js.map