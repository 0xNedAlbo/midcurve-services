import type { UniswapV3PoolPriceConfig, UniswapV3PoolPriceState } from '@midcurve/shared';
export type UniswapV3PoolPriceConfigDB = UniswapV3PoolPriceConfig;
export interface UniswapV3PoolPriceStateDB {
    sqrtPriceX96: string;
    tick: number;
}
export declare function parseUniswapV3PoolPriceState(stateDB: UniswapV3PoolPriceStateDB): UniswapV3PoolPriceState;
export declare function serializeUniswapV3PoolPriceState(state: UniswapV3PoolPriceState): UniswapV3PoolPriceStateDB;
export declare function parseUniswapV3PoolPriceConfig(configDB: UniswapV3PoolPriceConfigDB): UniswapV3PoolPriceConfig;
export declare function serializeUniswapV3PoolPriceConfig(config: UniswapV3PoolPriceConfig): UniswapV3PoolPriceConfigDB;
//# sourceMappingURL=pool-price-db.d.ts.map