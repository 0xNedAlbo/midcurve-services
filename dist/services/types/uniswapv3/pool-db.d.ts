import type { UniswapV3PoolState } from '@midcurve/shared';
export interface UniswapV3PoolStateDB {
    sqrtPriceX96: string;
    currentTick: number;
    liquidity: string;
    feeGrowthGlobal0: string;
    feeGrowthGlobal1: string;
}
export declare function toPoolState(stateDB: UniswapV3PoolStateDB): UniswapV3PoolState;
export declare function toPoolStateDB(state: UniswapV3PoolState): UniswapV3PoolStateDB;
//# sourceMappingURL=pool-db.d.ts.map