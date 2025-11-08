import { PrismaClient } from '@prisma/client';
import type { PoolPrice, PoolPriceConfigMap } from '@midcurve/shared';
import type { CreatePoolPriceInput, UpdatePoolPriceInput, PoolPriceDiscoverInput } from '../types/pool-price/pool-price-input.js';
import type { ServiceLogger } from '../../logging/index.js';
import { EvmConfig } from '../../config/evm.js';
export interface PoolPriceServiceDependencies {
    prisma?: PrismaClient;
    evmConfig?: EvmConfig;
}
interface PoolPriceDbResult {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    protocol: string;
    poolId: string;
    timestamp: Date;
    token1PricePerToken0: string;
    token0PricePerToken1: string;
    config: unknown;
    state: unknown;
}
export declare abstract class PoolPriceService<P extends keyof PoolPriceConfigMap> {
    protected readonly _prisma: PrismaClient;
    protected readonly _evmConfig: EvmConfig;
    protected readonly logger: ServiceLogger;
    constructor(dependencies?: PoolPriceServiceDependencies);
    protected get prisma(): PrismaClient;
    protected get evmConfig(): EvmConfig;
    abstract parseConfig(configDB: unknown): PoolPriceConfigMap[P]['config'];
    abstract serializeConfig(config: PoolPriceConfigMap[P]['config']): unknown;
    abstract parseState(stateDB: unknown): PoolPriceConfigMap[P]['state'];
    abstract serializeState(state: PoolPriceConfigMap[P]['state']): unknown;
    abstract discover(poolId: string, params: PoolPriceDiscoverInput<P>): Promise<PoolPrice<P>>;
    create(input: CreatePoolPriceInput<P>): Promise<PoolPrice<P>>;
    findById(id: string): Promise<PoolPrice<P> | null>;
    findByPoolId(poolId: string): Promise<PoolPrice<P>[]>;
    findByPoolIdAndTimeRange(poolId: string, startTime: Date, endTime: Date): Promise<PoolPrice<P>[]>;
    update(id: string, input: UpdatePoolPriceInput<P>): Promise<PoolPrice<P>>;
    delete(id: string): Promise<void>;
    protected mapToPoolPrice(dbResult: PoolPriceDbResult): PoolPrice<P>;
}
export {};
//# sourceMappingURL=pool-price-service.d.ts.map