import { CacheService } from '../../../services/cache/index.js';
import type { SubgraphResponse, PoolMetrics, PoolFeeData } from './types.js';
export interface UniswapV3SubgraphClientDependencies {
    cacheService?: CacheService;
    fetch?: typeof fetch;
}
export declare class UniswapV3SubgraphClient {
    private static instance;
    private readonly cacheService;
    private readonly fetchFn;
    private readonly cacheTtl;
    private readonly logger;
    constructor(dependencies?: UniswapV3SubgraphClientDependencies);
    static getInstance(): UniswapV3SubgraphClient;
    static resetInstance(): void;
    query<T>(chainId: number, query: string, variables?: Record<string, unknown>): Promise<SubgraphResponse<T>>;
    getPoolMetrics(chainId: number, poolAddress: string): Promise<PoolMetrics>;
    getPoolFeeData(chainId: number, poolAddress: string): Promise<PoolFeeData>;
    clearCache(): Promise<number>;
    isChainSupported(chainId: number): boolean;
    getSupportedChainIds(): number[];
    private buildCacheKey;
    private executeQueryWithRetry;
    private decimalToBigIntString;
}
//# sourceMappingURL=uniswapv3-subgraph-client.d.ts.map