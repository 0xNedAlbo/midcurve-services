import { PrismaClient } from '@prisma/client';
export interface CacheServiceDependencies {
    prisma?: PrismaClient;
}
export declare class CacheService {
    private static instance;
    private readonly prisma;
    private readonly logger;
    constructor(dependencies?: CacheServiceDependencies);
    static getInstance(): CacheService;
    static resetInstance(): void;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds: number): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    clear(pattern?: string): Promise<number>;
    cleanup(): Promise<number>;
    getStats(): Promise<{
        totalEntries: number;
        expiredEntries: number;
        activeEntries: number;
    }>;
}
//# sourceMappingURL=cache-service.d.ts.map