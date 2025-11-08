import { PrismaClient } from '@prisma/client';
import type { Pool, PoolConfigMap } from '@midcurve/shared';
import type { PoolDiscoverInput, CreatePoolInput, UpdatePoolInput } from '../types/pool/pool-input.js';
import type { ServiceLogger } from '../../logging/index.js';
export interface PoolServiceDependencies {
    prisma?: PrismaClient;
}
export declare abstract class PoolService<P extends keyof PoolConfigMap> {
    protected readonly _prisma: PrismaClient;
    protected readonly logger: ServiceLogger;
    constructor(dependencies?: PoolServiceDependencies);
    protected get prisma(): PrismaClient;
    abstract parseConfig(configDB: unknown): PoolConfigMap[P]['config'];
    abstract serializeConfig(config: PoolConfigMap[P]['config']): unknown;
    abstract parseState(stateDB: unknown): PoolConfigMap[P]['state'];
    abstract serializeState(state: PoolConfigMap[P]['state']): unknown;
    abstract discover(params: PoolDiscoverInput<P>): Promise<Pool<P>>;
    create(input: CreatePoolInput<P>): Promise<Pool<P>>;
    findById(id: string): Promise<Pool<P> | null>;
    update(id: string, input: UpdatePoolInput<P>): Promise<Pool<P>>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=pool-service.d.ts.map