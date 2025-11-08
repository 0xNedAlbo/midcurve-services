import type { RawPositionEvent } from '../../../../../clients/etherscan/types.js';
import type { PreviousEventState } from '../state-builder.js';
import type { Erc20Token } from '@midcurve/shared';
export interface CollectReward {
    tokenId: string;
    tokenAmount: bigint;
    tokenValue: bigint;
}
export interface CollectResult {
    deltaL: bigint;
    liquidityAfter: bigint;
    deltaCostBasis: bigint;
    costBasisAfter: bigint;
    deltaPnl: bigint;
    pnlAfter: bigint;
    feesCollected0: bigint;
    feesCollected1: bigint;
    uncollectedPrincipal0After: bigint;
    uncollectedPrincipal1After: bigint;
    rewards: CollectReward[];
    state: {
        eventType: 'COLLECT';
        tokenId: bigint;
        recipient: string;
        amount0: bigint;
        amount1: bigint;
    };
}
export declare function processCollectEvent(rawEvent: RawPositionEvent, previousState: PreviousEventState, sqrtPriceX96: bigint, token0: Erc20Token, token1: Erc20Token, token0IsQuote: boolean, token0Decimals: number, token1Decimals: number): CollectResult;
//# sourceMappingURL=collect.d.ts.map