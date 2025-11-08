export function buildInitialState(lastEvent) {
    if (!lastEvent) {
        return {
            uncollectedPrincipal0: 0n,
            uncollectedPrincipal1: 0n,
            liquidity: 0n,
            costBasis: 0n,
            pnl: 0n,
        };
    }
    return {
        uncollectedPrincipal0: lastEvent.config.uncollectedPrincipal0After,
        uncollectedPrincipal1: lastEvent.config.uncollectedPrincipal1After,
        liquidity: lastEvent.config.liquidityAfter,
        costBasis: lastEvent.costBasisAfter,
        pnl: lastEvent.pnlAfter,
    };
}
export function extractPreviousEventId(lastEvent) {
    return lastEvent?.id ?? null;
}
//# sourceMappingURL=state-builder.js.map