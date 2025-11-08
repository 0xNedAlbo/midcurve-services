import { calculateTokenValueInQuote, calculateProportionalCostBasis, } from '../../../../../utils/uniswapv3/ledger-calculations.js';
export function processDecreaseLiquidityEvent(rawEvent, previousState, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals) {
    const amount0 = BigInt(rawEvent.amount0 ?? '0');
    const amount1 = BigInt(rawEvent.amount1 ?? '0');
    const deltaL = BigInt(rawEvent.liquidity ?? '0');
    const tokenId = BigInt(rawEvent.tokenId);
    const liquidityAfter = previousState.liquidity - deltaL;
    const proportionalCostBasis = calculateProportionalCostBasis(previousState.costBasis, deltaL, previousState.liquidity);
    const deltaCostBasis = -proportionalCostBasis;
    const costBasisAfter = previousState.costBasis - proportionalCostBasis;
    const tokenValue = calculateTokenValueInQuote(amount0, amount1, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
    const deltaPnl = tokenValue - proportionalCostBasis;
    const pnlAfter = previousState.pnl + deltaPnl;
    const uncollectedPrincipal0After = previousState.uncollectedPrincipal0 + amount0;
    const uncollectedPrincipal1After = previousState.uncollectedPrincipal1 + amount1;
    return {
        deltaL,
        liquidityAfter,
        deltaCostBasis,
        costBasisAfter,
        deltaPnl,
        pnlAfter,
        uncollectedPrincipal0After,
        uncollectedPrincipal1After,
        state: {
            eventType: 'DECREASE_LIQUIDITY',
            tokenId,
            liquidity: deltaL,
            amount0,
            amount1,
        },
    };
}
//# sourceMappingURL=decrease-liquidity.js.map