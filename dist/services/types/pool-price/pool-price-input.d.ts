import type { PoolPrice, PoolPriceConfigMap } from '@midcurve/shared';
export interface UniswapV3PoolPriceDiscoverInput {
    blockNumber: number;
}
export interface PoolPriceDiscoverInputMap {
    uniswapv3: UniswapV3PoolPriceDiscoverInput;
}
export type PoolPriceDiscoverInput<P extends keyof PoolPriceDiscoverInputMap> = PoolPriceDiscoverInputMap[P];
export type AnyPoolPriceDiscoverInput = PoolPriceDiscoverInput<keyof PoolPriceDiscoverInputMap>;
export type CreatePoolPriceInput<P extends keyof PoolPriceConfigMap> = Omit<PoolPrice<P>, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdatePoolPriceInput<P extends keyof PoolPriceConfigMap> = Partial<Omit<PoolPrice<P>, 'id' | 'protocol' | 'createdAt' | 'updatedAt'>>;
export type CreateUniswapV3PoolPriceInput = CreatePoolPriceInput<'uniswapv3'>;
export type UpdateUniswapV3PoolPriceInput = UpdatePoolPriceInput<'uniswapv3'>;
export type CreateAnyPoolPriceInput = CreatePoolPriceInput<keyof PoolPriceConfigMap>;
export type UpdateAnyPoolPriceInput = UpdatePoolPriceInput<keyof PoolPriceConfigMap>;
//# sourceMappingURL=pool-price-input.d.ts.map