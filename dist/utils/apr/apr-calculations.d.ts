export declare const SECONDS_PER_YEAR = 31557600;
export declare const BASIS_POINTS_MULTIPLIER = 10000;
export declare function calculateAprBps(collectedFeeValue: bigint, costBasis: bigint, durationSeconds: number): number;
export declare function calculateDurationSeconds(startTimestamp: Date, endTimestamp: Date): number;
export declare function secondsToDays(durationSeconds: number): number;
export declare function calculateAverageCostBasis(costBasisValues: bigint[]): bigint;
export declare function calculateTimeWeightedCostBasis(events: Array<{
    timestamp: Date;
    costBasisAfter: bigint;
}>): bigint;
export declare function aprBpsToPercent(aprBps: number): number;
export declare function aprPercentToBps(aprPercent: number): number;
//# sourceMappingURL=apr-calculations.d.ts.map