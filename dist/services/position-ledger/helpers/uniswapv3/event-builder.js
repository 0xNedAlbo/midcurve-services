import { createHash } from 'crypto';
import { calculateTokenValueInQuote } from '../../../../utils/uniswapv3/ledger-calculations.js';
import { processIncreaseLiquidityEvent, } from './event-processors/increase-liquidity.js';
import { processDecreaseLiquidityEvent, } from './event-processors/decrease-liquidity.js';
import { processCollectEvent, } from './event-processors/collect.js';
export function buildEventInput(params) {
    const { rawEvent, previousState, poolMetadata, sqrtPriceX96, previousEventId, positionId, poolPrice } = params;
    const { token0, token1, token0IsQuote, token0Decimals, token1Decimals } = poolMetadata;
    const amount0 = BigInt(rawEvent.amount0 ?? '0');
    const amount1 = BigInt(rawEvent.amount1 ?? '0');
    let result;
    if (rawEvent.eventType === 'INCREASE_LIQUIDITY') {
        result = processIncreaseLiquidityEvent(rawEvent, previousState, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
    }
    else if (rawEvent.eventType === 'DECREASE_LIQUIDITY') {
        result = processDecreaseLiquidityEvent(rawEvent, previousState, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
    }
    else {
        result = processCollectEvent(rawEvent, previousState, sqrtPriceX96, token0, token1, token0IsQuote, token0Decimals, token1Decimals);
    }
    const { deltaL, liquidityAfter, deltaCostBasis, costBasisAfter, deltaPnl, pnlAfter, uncollectedPrincipal0After, uncollectedPrincipal1After, state, } = result;
    const rewards = 'rewards' in result ? result.rewards : [];
    const feesCollected0 = 'feesCollected0' in result ? result.feesCollected0 : 0n;
    const feesCollected1 = 'feesCollected1' in result ? result.feesCollected1 : 0n;
    const tokenValue = calculateTokenValueInQuote(amount0, amount1, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
    let ledgerEventType;
    if (rawEvent.eventType === 'INCREASE_LIQUIDITY') {
        ledgerEventType = 'INCREASE_POSITION';
    }
    else if (rawEvent.eventType === 'DECREASE_LIQUIDITY') {
        ledgerEventType = 'DECREASE_POSITION';
    }
    else {
        ledgerEventType = 'COLLECT';
    }
    const eventInput = {
        positionId,
        protocol: 'uniswapv3',
        previousId: previousEventId,
        timestamp: rawEvent.blockTimestamp,
        eventType: ledgerEventType,
        poolPrice,
        token0Amount: amount0,
        token1Amount: amount1,
        tokenValue,
        rewards,
        deltaCostBasis,
        costBasisAfter,
        deltaPnl,
        pnlAfter,
        config: {
            chainId: rawEvent.chainId,
            nftId: BigInt(rawEvent.tokenId),
            blockNumber: rawEvent.blockNumber,
            txIndex: Number(rawEvent.transactionIndex),
            logIndex: Number(rawEvent.logIndex),
            txHash: rawEvent.transactionHash,
            deltaL,
            liquidityAfter,
            feesCollected0,
            feesCollected1,
            uncollectedPrincipal0After,
            uncollectedPrincipal1After,
            sqrtPriceX96,
        },
        state,
    };
    const inputHash = generateInputHash(eventInput.config);
    return {
        ...eventInput,
        inputHash,
    };
}
export function generateInputHash(config) {
    const { blockNumber, txIndex, logIndex } = config;
    const hashInput = `${blockNumber}-${txIndex}-${logIndex}`;
    return createHash('md5').update(hashInput).digest('hex');
}
//# sourceMappingURL=event-builder.js.map