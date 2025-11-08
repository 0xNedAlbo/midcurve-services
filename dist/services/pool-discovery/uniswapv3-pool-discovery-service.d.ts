import { PrismaClient } from '@prisma/client';
import { PoolDiscoveryService } from './pool-discovery-service.js';
import type { PoolDiscoveryResult } from '@midcurve/shared';
import type { UniswapV3PoolDiscoveryInput } from '../types/pool-discovery/pool-discovery-input.js';
import type { UniswapV3Pool } from '@midcurve/shared';
import { UniswapV3PoolService } from '../pool/uniswapv3-pool-service.js';
import { UniswapV3SubgraphClient } from '../../clients/subgraph/uniswapv3/uniswapv3-subgraph-client.js';
import { EvmConfig } from '../../config/evm.js';
export interface UniswapV3PoolDiscoveryServiceDependencies {
    prisma?: PrismaClient;
    poolService?: UniswapV3PoolService;
    subgraphClient?: UniswapV3SubgraphClient;
    evmConfig?: EvmConfig;
}
export declare class UniswapV3PoolDiscoveryService extends PoolDiscoveryService<'uniswapv3'> {
    private readonly _poolService;
    private readonly _subgraphClient;
    private readonly _evmConfig;
    constructor(dependencies?: UniswapV3PoolDiscoveryServiceDependencies);
    protected get poolService(): UniswapV3PoolService;
    protected get subgraphClient(): UniswapV3SubgraphClient;
    protected get evmConfig(): EvmConfig;
    findPoolsForTokenPair(input: UniswapV3PoolDiscoveryInput): Promise<PoolDiscoveryResult<'uniswapv3'>[]>;
    createPoolName(pool: UniswapV3Pool): string;
    private queryPoolAddress;
    private enrichWithSubgraphMetrics;
}
//# sourceMappingURL=uniswapv3-pool-discovery-service.d.ts.map