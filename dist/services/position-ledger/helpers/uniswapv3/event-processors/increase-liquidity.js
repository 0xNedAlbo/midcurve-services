import { calculateTokenValueInQuote } from '../../../../../utils/uniswapv3/ledger-calculations.js';
export function processIncreaseLiquidityEvent(rawEvent, previousState, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals) {
    const amount0 = BigInt(rawEvent.amount0 ?? '0');
    const amount1 = BigInt(rawEvent.amount1 ?? '0');
    const deltaL = BigInt(rawEvent.liquidity ?? '0');
    const tokenId = BigInt(rawEvent.tokenId);
    const liquidityAfter = previousState.liquidity + deltaL;
    const tokenValue = calculateTokenValueInQuote(amount0, amount1, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
    const deltaCostBasis = tokenValue;
    const costBasisAfter = previousState.costBasis + tokenValue;
    const deltaPnl = 0n;
    const pnlAfter = previousState.pnl;
    const uncollectedPrincipal0After = previousState.uncollectedPrincipal0;
    const uncollectedPrincipal1After = previousState.uncollectedPrincipal1;
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
            eventType: 'INCREASE_LIQUIDITY',
            tokenId,
            liquidity: deltaL,
            amount0,
            amount1,
        },
    };
}
//# sourceMappingURL=increase-liquidity.js.map