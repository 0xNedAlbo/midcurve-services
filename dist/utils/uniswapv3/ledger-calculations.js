import { pricePerToken0InToken1, pricePerToken1InToken0, } from '@midcurve/shared';
export function calculatePoolPriceInQuoteToken(sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals) {
    if (token0IsQuote) {
        return pricePerToken1InToken0(sqrtPriceX96, token1Decimals);
    }
    else {
        return pricePerToken0InToken1(sqrtPriceX96, token0Decimals);
    }
}
export function calculateTokenValueInQuote(token0Amount, token1Amount, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals) {
    const sqrtPriceX96BigInt = typeof sqrtPriceX96 === 'string' ? BigInt(sqrtPriceX96) : sqrtPriceX96;
    const poolPrice = calculatePoolPriceInQuoteToken(sqrtPriceX96BigInt, token0IsQuote, token0Decimals, token1Decimals);
    if (token0IsQuote) {
        const token1Decimals10n = 10n ** BigInt(token1Decimals);
        const token1ValueInQuote = (token1Amount * poolPrice) / token1Decimals10n;
        return token0Amount + token1ValueInQuote;
    }
    else {
        const token0Decimals10n = 10n ** BigInt(token0Decimals);
        const token0ValueInQuote = (token0Amount * poolPrice) / token0Decimals10n;
        return token1Amount + token0ValueInQuote;
    }
}
export function calculateProportionalCostBasis(currentCostBasis, deltaLiquidity, currentLiquidity) {
    if (currentLiquidity === 0n) {
        throw new Error('Current liquidity cannot be zero');
    }
    if (deltaLiquidity < 0n) {
        throw new Error('Delta liquidity cannot be negative');
    }
    if (deltaLiquidity > currentLiquidity) {
        throw new Error('Delta liquidity cannot exceed current liquidity');
    }
    if (deltaLiquidity === 0n) {
        return 0n;
    }
    return (currentCostBasis * deltaLiquidity) / currentLiquidity;
}
export function separateFeesFromPrincipal(collectedAmount0, collectedAmount1, uncollectedPrincipal0, uncollectedPrincipal1) {
    if (collectedAmount0 < 0n || collectedAmount1 < 0n) {
        throw new Error('Collected amounts cannot be negative');
    }
    if (uncollectedPrincipal0 < 0n || uncollectedPrincipal1 < 0n) {
        throw new Error('Uncollected principal cannot be negative');
    }
    const principalAmount0 = collectedAmount0 < uncollectedPrincipal0
        ? collectedAmount0
        : uncollectedPrincipal0;
    const principalAmount1 = collectedAmount1 < uncollectedPrincipal1
        ? collectedAmount1
        : uncollectedPrincipal1;
    const feeAmount0 = collectedAmount0 - principalAmount0;
    const feeAmount1 = collectedAmount1 - principalAmount1;
    return {
        feeAmount0,
        feeAmount1,
        principalAmount0,
        principalAmount1,
    };
}
export function updateUncollectedPrincipal(previousUncollected0, previousUncollected1, eventType, amount0, amount1, principalCollected0 = 0n, principalCollected1 = 0n) {
    if (previousUncollected0 < 0n || previousUncollected1 < 0n) {
        throw new Error('Previous uncollected principal cannot be negative');
    }
    switch (eventType) {
        case 'INCREASE_POSITION':
            return {
                uncollectedPrincipal0After: previousUncollected0,
                uncollectedPrincipal1After: previousUncollected1,
            };
        case 'DECREASE_POSITION':
            if (amount0 < 0n || amount1 < 0n) {
                throw new Error('DECREASE amounts cannot be negative');
            }
            return {
                uncollectedPrincipal0After: previousUncollected0 + amount0,
                uncollectedPrincipal1After: previousUncollected1 + amount1,
            };
        case 'COLLECT':
            if (principalCollected0 < 0n || principalCollected1 < 0n) {
                throw new Error('Principal collected cannot be negative');
            }
            if (principalCollected0 > previousUncollected0) {
                throw new Error(`Cannot collect more principal than available for token0: ${principalCollected0} > ${previousUncollected0}`);
            }
            if (principalCollected1 > previousUncollected1) {
                throw new Error(`Cannot collect more principal than available for token1: ${principalCollected1} > ${previousUncollected1}`);
            }
            return {
                uncollectedPrincipal0After: previousUncollected0 - principalCollected0,
                uncollectedPrincipal1After: previousUncollected1 - principalCollected1,
            };
        default:
            throw new Error(`Unknown event type: ${eventType}`);
    }
}
//# sourceMappingURL=ledger-calculations.js.map