import { PrismaClient } from '@prisma/client';
import type { UniswapV3PoolConfig, UniswapV3PoolState, UniswapV3Pool } from '@midcurve/shared';
import type { UniswapV3PoolDiscoverInput, CreatePoolInput, UpdatePoolInput } from '../types/pool/pool-input.js';
import { PoolService } from './pool-service.js';
import { EvmConfig } from '../../config/evm.js';
import { Erc20TokenService } from '../token/erc20-token-service.js';
export interface UniswapV3PoolServiceDependencies {
    prisma?: PrismaClient;
    evmConfig?: EvmConfig;
    erc20TokenService?: Erc20TokenService;
}
export declare class UniswapV3PoolService extends PoolService<'uniswapv3'> {
    private readonly _evmConfig;
    private readonly _erc20TokenService;
    constructor(dependencies?: UniswapV3PoolServiceDependencies);
    protected get evmConfig(): EvmConfig;
    protected get erc20TokenService(): Erc20TokenService;
    parseConfig(configDB: unknown): UniswapV3PoolConfig;
    serializeConfig(config: UniswapV3PoolConfig): unknown;
    parseState(stateDB: unknown): UniswapV3PoolState;
    serializeState(state: UniswapV3PoolState): unknown;
    discover(params: UniswapV3PoolDiscoverInput): Promise<UniswapV3Pool>;
    create(input: CreatePoolInput<'uniswapv3'>): Promise<UniswapV3Pool>;
    findById(id: string): Promise<UniswapV3Pool | null>;
    update(id: string, input: UpdatePoolInput<'uniswapv3'>): Promise<UniswapV3Pool>;
    delete(id: string): Promise<void>;
    refresh(id: string): Promise<UniswapV3Pool>;
    private mapDbResultToPool;
    private mapDbTokenToErc20Token;
    getPoolPrice(chainId: number, poolAddress: string): Promise<{
        sqrtPriceX96: string;
        currentTick: number;
    }>;
    private findByAddressAndChain;
}
//# sourceMappingURL=uniswapv3-pool-service.d.ts.map