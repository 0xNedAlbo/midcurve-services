import { calculateTokenValueInQuote, separateFeesFromPrincipal, } from '../../../../../utils/uniswapv3/ledger-calculations.js';
export function processCollectEvent(rawEvent, previousState, sqrtPriceX96, token0, token1, token0IsQuote, token0Decimals, token1Decimals) {
    const amount0 = BigInt(rawEvent.amount0 ?? '0');
    const amount1 = BigInt(rawEvent.amount1 ?? '0');
    const tokenId = BigInt(rawEvent.tokenId);
    const recipient = rawEvent.recipient ?? '0x0000000000000000000000000000000000000000';
    const { feeAmount0, feeAmount1, principalAmount0, principalAmount1 } = separateFeesFromPrincipal(amount0, amount1, previousState.uncollectedPrincipal0, previousState.uncollectedPrincipal1);
    const feesCollected0 = feeAmount0;
    const feesCollected1 = feeAmount1;
    const uncollectedPrincipal0After = previousState.uncollectedPrincipal0 - principalAmount0;
    const uncollectedPrincipal1After = previousState.uncollectedPrincipal1 - principalAmount1;
    const fee0Value = calculateTokenValueInQuote(feeAmount0, 0n, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
    const fee1Value = calculateTokenValueInQuote(0n, feeAmount1, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
    const rewards = [];
    if (feeAmount0 > 0n) {
        rewards.push({
            tokenId: token0.id,
            tokenAmount: feeAmount0,
            tokenValue: fee0Value,
        });
    }
    if (feeAmount1 > 0n) {
        rewards.push({
            tokenId: token1.id,
            tokenAmount: feeAmount1,
            tokenValue: fee1Value,
        });
    }
    const deltaL = 0n;
    const liquidityAfter = previousState.liquidity;
    const deltaCostBasis = 0n;
    const costBasisAfter = previousState.costBasis;
    const deltaPnl = 0n;
    const pnlAfter = previousState.pnl;
    return {
        deltaL,
        liquidityAfter,
        deltaCostBasis,
        costBasisAfter,
        deltaPnl,
        pnlAfter,
        feesCollected0,
        feesCollected1,
        uncollectedPrincipal0After,
        uncollectedPrincipal1After,
        rewards,
        state: {
            eventType: 'COLLECT',
            tokenId,
            recipient,
            amount0,
            amount1,
        },
    };
}
//# sourceMappingURL=collect.js.map