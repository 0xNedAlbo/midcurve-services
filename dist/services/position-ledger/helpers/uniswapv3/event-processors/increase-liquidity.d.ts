import type { RawPositionEvent } from '../../../../../clients/etherscan/types.js';
import type { PreviousEventState } from '../state-builder.js';
export interface IncreaseLiquidityResult {
    deltaL: bigint;
    liquidityAfter: bigint;
    deltaCostBasis: bigint;
    costBasisAfter: bigint;
    deltaPnl: bigint;
    pnlAfter: bigint;
    uncollectedPrincipal0After: bigint;
    uncollectedPrincipal1After: bigint;
    state: {
        eventType: 'INCREASE_LIQUIDITY';
        tokenId: bigint;
        liquidity: bigint;
        amount0: bigint;
        amount1: bigint;
    };
}
export declare function processIncreaseLiquidityEvent(rawEvent: RawPositionEvent, previousState: PreviousEventState, sqrtPriceX96: bigint, token0IsQuote: boolean, token0Decimals: number, token1Decimals: number): IncreaseLiquidityResult;
//# sourceMappingURL=increase-liquidity.d.ts.map