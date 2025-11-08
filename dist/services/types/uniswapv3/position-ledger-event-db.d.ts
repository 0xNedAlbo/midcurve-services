import type { UniswapV3LedgerEventConfig } from '@midcurve/shared';
import type { UniswapV3LedgerEventState } from '@midcurve/shared';
export interface UniswapV3LedgerEventConfigDB {
    chainId: number;
    nftId: string;
    blockNumber: string;
    txIndex: number;
    logIndex: number;
    txHash: string;
    deltaL: string;
    liquidityAfter: string;
    feesCollected0: string;
    feesCollected1: string;
    uncollectedPrincipal0After: string;
    uncollectedPrincipal1After: string;
    sqrtPriceX96: string;
}
export declare function toEventConfig(configDB: UniswapV3LedgerEventConfigDB): UniswapV3LedgerEventConfig;
export declare function toEventConfigDB(config: UniswapV3LedgerEventConfig): UniswapV3LedgerEventConfigDB;
export interface UniswapV3IncreaseLiquidityEventDB {
    eventType: 'INCREASE_LIQUIDITY';
    tokenId: string;
    liquidity: string;
    amount0: string;
    amount1: string;
}
export interface UniswapV3DecreaseLiquidityEventDB {
    eventType: 'DECREASE_LIQUIDITY';
    tokenId: string;
    liquidity: string;
    amount0: string;
    amount1: string;
}
export interface UniswapV3CollectEventDB {
    eventType: 'COLLECT';
    tokenId: string;
    recipient: string;
    amount0: string;
    amount1: string;
}
export type UniswapV3LedgerEventStateDB = UniswapV3IncreaseLiquidityEventDB | UniswapV3DecreaseLiquidityEventDB | UniswapV3CollectEventDB;
export declare function toEventState(stateDB: UniswapV3LedgerEventStateDB): UniswapV3LedgerEventState;
export declare function toEventStateDB(state: UniswapV3LedgerEventState): UniswapV3LedgerEventStateDB;
//# sourceMappingURL=position-ledger-event-db.d.ts.map