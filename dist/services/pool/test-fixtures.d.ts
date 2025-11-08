import type { CreatePoolInput } from '../types/pool/pool-input.js';
import type { UniswapV3PoolConfig, UniswapV3PoolState, UniswapV3Pool } from '@midcurve/shared';
import type { Erc20Token } from '@midcurve/shared';
interface PoolFixture {
    input: CreatePoolInput<'uniswapv3'>;
    dbResult: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        protocol: string;
        poolType: string;
        token0Id: string;
        token1Id: string;
        feeBps: number;
        config: unknown;
        state: unknown;
        token0: any;
        token1: any;
    };
    pool: UniswapV3Pool;
}
export declare const USDC_TOKEN: Erc20Token;
export declare const WETH_TOKEN: Erc20Token;
export declare const DAI_TOKEN: Erc20Token;
export declare const USDC_ARBITRUM_TOKEN: Erc20Token;
export declare const USDC_WETH_CONFIG: UniswapV3PoolConfig;
export declare const USDC_DAI_CONFIG: UniswapV3PoolConfig;
export declare const WETH_DAI_CONFIG: UniswapV3PoolConfig;
export declare const ACTIVE_POOL_STATE: UniswapV3PoolState;
export declare const ZERO_POOL_STATE: UniswapV3PoolState;
export declare const HIGH_LIQUIDITY_STATE: UniswapV3PoolState;
export declare const USDC_WETH_POOL: PoolFixture;
export declare const USDC_DAI_POOL: PoolFixture;
export declare function createPoolFixture(overrides?: Partial<PoolFixture['input']>): PoolFixture;
export {};
//# sourceMappingURL=test-fixtures.d.ts.map