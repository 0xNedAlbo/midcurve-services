import { PrismaClient } from '@prisma/client';
import type { Pool, PoolConfigMap } from '@midcurve/shared';
import type { PoolDiscoveryResult } from '@midcurve/shared';
import type { PoolDiscoveryInput } from '../types/pool-discovery/pool-discovery-input.js';
import type { ServiceLogger } from '../../logging/index.js';
export interface PoolDiscoveryServiceDependencies {
    prisma?: PrismaClient;
}
export declare abstract class PoolDiscoveryService<P extends keyof PoolConfigMap> {
    protected readonly _prisma: PrismaClient;
    protected readonly logger: ServiceLogger;
    constructor(dependencies?: PoolDiscoveryServiceDependencies);
    protected get prisma(): PrismaClient;
    abstract findPoolsForTokenPair(input: PoolDiscoveryInput<P>): Promise<PoolDiscoveryResult<P>[]>;
    abstract createPoolName(pool: Pool<P>): string;
}
//# sourceMappingURL=pool-discovery-service.d.ts.map