import type { CreatePoolPriceInput, CreateUniswapV3PoolPriceInput } from '../types/pool-price/pool-price-input.js';
import type { UniswapV3PoolPrice } from '@midcurve/shared';
export interface PoolPriceFixture<P extends 'uniswapv3' = 'uniswapv3'> {
    input: CreatePoolPriceInput<P>;
    dbResult: UniswapV3PoolPrice;
}
export declare const WETH_USDC_POOL_PRICE_ARBITRUM: PoolPriceFixture;
export declare const WBTC_USDC_POOL_PRICE_ARBITRUM: PoolPriceFixture;
export declare const USDC_USDT_POOL_PRICE: PoolPriceFixture;
export declare const WETH_USDC_POOL_PRICE_EARLIER: PoolPriceFixture;
export declare const WETH_USDC_POOL_PRICE_LATER: PoolPriceFixture;
export declare const MINIMAL_POOL_PRICE: PoolPriceFixture;
export declare function createPoolPriceFixture(overrides: Partial<CreateUniswapV3PoolPriceInput> & {
    id?: string;
    createdAt?: Date;
    updatedAt?: Date;
}): PoolPriceFixture;
export declare const REAL_ARBITRUM_EARLY_2024: PoolPriceFixture;
export declare const REAL_ARBITRUM_MID_2024: PoolPriceFixture;
export declare const REAL_ARBITRUM_LATE_2024: PoolPriceFixture;
//# sourceMappingURL=test-fixtures.d.ts.map