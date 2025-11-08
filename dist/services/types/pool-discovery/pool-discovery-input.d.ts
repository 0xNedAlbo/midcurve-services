import type { PoolConfigMap } from '@midcurve/shared';
export interface PoolDiscoveryInputMap {
    uniswapv3: UniswapV3PoolDiscoveryInput;
}
export interface UniswapV3PoolDiscoveryInput {
    chainId: number;
    tokenA: string;
    tokenB: string;
}
export type PoolDiscoveryInput<P extends keyof PoolConfigMap> = PoolDiscoveryInputMap[P];
//# sourceMappingURL=pool-discovery-input.d.ts.map