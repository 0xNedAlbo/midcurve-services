import type { Pool, PoolConfigMap } from '@midcurve/shared';
export interface UniswapV3PoolDiscoverInput {
    poolAddress: string;
    chainId: number;
}
export interface PoolDiscoverInputMap {
    uniswapv3: UniswapV3PoolDiscoverInput;
}
export type PoolDiscoverInput<P extends keyof PoolDiscoverInputMap> = PoolDiscoverInputMap[P];
export type AnyPoolDiscoverInput = PoolDiscoverInput<keyof PoolDiscoverInputMap>;
export type CreatePoolInput<P extends keyof PoolConfigMap> = Omit<Pool<P>, 'id' | 'createdAt' | 'updatedAt' | 'token0' | 'token1'> & {
    token0Id: string;
    token1Id: string;
};
export type CreateUniswapV3PoolInput = CreatePoolInput<'uniswapv3'>;
export type CreateAnyPoolInput = CreatePoolInput<keyof PoolConfigMap>;
export type UpdatePoolInput<P extends keyof PoolConfigMap> = Partial<Omit<Pool<P>, 'id' | 'protocol' | 'poolType' | 'createdAt' | 'updatedAt' | 'token0' | 'token1'>>;
export type UpdateUniswapV3PoolInput = UpdatePoolInput<'uniswapv3'>;
export type UpdateAnyPoolInput = UpdatePoolInput<keyof PoolConfigMap>;
//# sourceMappingURL=pool-input.d.ts.map