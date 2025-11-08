export const SECONDS_PER_YEAR = 31_557_600;
export const BASIS_POINTS_MULTIPLIER = 10_000;
export function calculateAprBps(collectedFeeValue, costBasis, durationSeconds) {
    if (costBasis === 0n) {
        throw new Error('Cost basis cannot be zero');
    }
    if (durationSeconds <= 0) {
        throw new Error('Duration must be positive');
    }
    if (collectedFeeValue < 0n) {
        throw new Error('Collected fee value cannot be negative');
    }
    if (collectedFeeValue === 0n) {
        return 0;
    }
    const numerator = collectedFeeValue * BigInt(SECONDS_PER_YEAR) * BigInt(BASIS_POINTS_MULTIPLIER);
    const denominator = costBasis * BigInt(durationSeconds);
    const aprBps = Number(numerator / denominator);
    return aprBps;
}
export function calculateDurationSeconds(startTimestamp, endTimestamp) {
    const durationMs = endTimestamp.getTime() - startTimestamp.getTime();
    if (durationMs < 0) {
        throw new Error('End timestamp must be after start timestamp');
    }
    return Math.floor(durationMs / 1000);
}
export function secondsToDays(durationSeconds) {
    return durationSeconds / 86400;
}
export function calculateAverageCostBasis(costBasisValues) {
    if (costBasisValues.length === 0) {
        throw new Error('Cannot calculate average of empty array');
    }
    const sum = costBasisValues.reduce((acc, val) => acc + val, 0n);
    return sum / BigInt(costBasisValues.length);
}
export function calculateTimeWeightedCostBasis(events) {
    if (events.length === 0) {
        throw new Error('Cannot calculate time-weighted average from empty array');
    }
    if (events.length === 1) {
        return events[0].costBasisAfter;
    }
    let weightedSum = 0n;
    let totalDurationMs = 0;
    for (let i = 0; i < events.length - 1; i++) {
        const currentEvent = events[i];
        const nextEvent = events[i + 1];
        const durationMs = nextEvent.timestamp.getTime() - currentEvent.timestamp.getTime();
        if (durationMs < 0) {
            throw new Error('Events must be in chronological order');
        }
        weightedSum += currentEvent.costBasisAfter * BigInt(durationMs);
        totalDurationMs += durationMs;
    }
    if (totalDurationMs === 0) {
        throw new Error('Events must span non-zero time for time-weighted average');
    }
    return weightedSum / BigInt(totalDurationMs);
}
export function aprBpsToPercent(aprBps) {
    return aprBps / 100;
}
export function aprPercentToBps(aprPercent) {
    return Math.round(aprPercent * 100);
}
//# sourceMappingURL=apr-calculations.js.map