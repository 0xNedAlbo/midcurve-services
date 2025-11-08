import type { UniswapV3LedgerEvent } from '@midcurve/shared';
export interface PreviousEventState {
    uncollectedPrincipal0: bigint;
    uncollectedPrincipal1: bigint;
    liquidity: bigint;
    costBasis: bigint;
    pnl: bigint;
}
export declare function buildInitialState(lastEvent: UniswapV3LedgerEvent | undefined): PreviousEventState;
export declare function extractPreviousEventId(lastEvent: UniswapV3LedgerEvent | undefined): string | null;
//# sourceMappingURL=state-builder.d.ts.map