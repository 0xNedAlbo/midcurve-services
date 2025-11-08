export declare function calculatePoolPriceInQuoteToken(sqrtPriceX96: bigint, token0IsQuote: boolean, token0Decimals: number, token1Decimals: number): bigint;
export declare function calculateTokenValueInQuote(token0Amount: bigint, token1Amount: bigint, sqrtPriceX96: bigint, token0IsQuote: boolean, token0Decimals: number, token1Decimals: number): bigint;
export declare function calculateProportionalCostBasis(currentCostBasis: bigint, deltaLiquidity: bigint, currentLiquidity: bigint): bigint;
export interface FeeSeparationResult {
    feeAmount0: bigint;
    feeAmount1: bigint;
    principalAmount0: bigint;
    principalAmount1: bigint;
}
export declare function separateFeesFromPrincipal(collectedAmount0: bigint, collectedAmount1: bigint, uncollectedPrincipal0: bigint, uncollectedPrincipal1: bigint): FeeSeparationResult;
export interface UncollectedPrincipalResult {
    uncollectedPrincipal0After: bigint;
    uncollectedPrincipal1After: bigint;
}
export declare function updateUncollectedPrincipal(previousUncollected0: bigint, previousUncollected1: bigint, eventType: 'INCREASE_POSITION' | 'DECREASE_POSITION' | 'COLLECT', amount0: bigint, amount1: bigint, principalCollected0?: bigint, principalCollected1?: bigint): UncollectedPrincipalResult;
//# sourceMappingURL=ledger-calculations.d.ts.map