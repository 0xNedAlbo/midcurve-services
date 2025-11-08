import type { CreatePositionInput } from '../types/position/position-input.js';
import type { UniswapV3PositionConfig, UniswapV3PositionState, UniswapV3Position } from '@midcurve/shared';
import type { UniswapV3Pool } from '@midcurve/shared';
import type { Erc20Token } from '@midcurve/shared';
interface PositionFixture {
    input: CreatePositionInput<'uniswapv3'> & {
        state: UniswapV3PositionState;
    };
    dbResult: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        protocol: string;
        positionType: string;
        userId: string;
        currentValue: string;
        currentCostBasis: string;
        realizedPnl: string;
        unrealizedPnl: string;
        collectedFees: string;
        unClaimedFees: string;
        lastFeesCollectedAt: Date;
        priceRangeLower: string;
        priceRangeUpper: string;
        poolId: string;
        isToken0Quote: boolean;
        pool: any;
        positionOpenedAt: Date;
        positionClosedAt: Date | null;
        isActive: boolean;
        config: unknown;
        state: unknown;
    };
    position: UniswapV3Position;
}
export declare const TEST_USER_ID = "user_alice_001";
export declare const TEST_USER_ID_2 = "user_bob_001";
export declare const USDC_TOKEN: Erc20Token;
export declare const WETH_TOKEN: Erc20Token;
export declare const USDC_WETH_POOL: UniswapV3Pool;
export declare const ACTIVE_POSITION_CONFIG: UniswapV3PositionConfig;
export declare const NARROW_POSITION_CONFIG: UniswapV3PositionConfig;
export declare const ACTIVE_POSITION_STATE: UniswapV3PositionState;
export declare const ZERO_POSITION_STATE: UniswapV3PositionState;
export declare const ACTIVE_ETH_USDC_POSITION: PositionFixture;
export declare const CLOSED_POSITION: PositionFixture;
export declare const BOB_POSITION: PositionFixture;
export declare const ARBITRUM_POSITION: PositionFixture;
export declare const BASE_POSITION: PositionFixture;
export declare function createPositionFixture(overrides: Partial<UniswapV3Position>): UniswapV3Position;
export {};
//# sourceMappingURL=test-fixtures.d.ts.map