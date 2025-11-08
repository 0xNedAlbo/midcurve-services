export function toPoolState(stateDB) {
    return {
        sqrtPriceX96: BigInt(stateDB.sqrtPriceX96),
        currentTick: stateDB.currentTick,
        liquidity: BigInt(stateDB.liquidity),
        feeGrowthGlobal0: BigInt(stateDB.feeGrowthGlobal0),
        feeGrowthGlobal1: BigInt(stateDB.feeGrowthGlobal1),
    };
}
export function toPoolStateDB(state) {
    return {
        sqrtPriceX96: state.sqrtPriceX96.toString(),
        currentTick: state.currentTick,
        liquidity: state.liquidity.toString(),
        feeGrowthGlobal0: state.feeGrowthGlobal0.toString(),
        feeGrowthGlobal1: state.feeGrowthGlobal1.toString(),
    };
}
//# sourceMappingURL=pool-db.js.map