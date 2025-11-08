export function toEventConfig(configDB) {
    return {
        chainId: configDB.chainId,
        nftId: BigInt(configDB.nftId),
        blockNumber: BigInt(configDB.blockNumber),
        txIndex: configDB.txIndex,
        logIndex: configDB.logIndex,
        txHash: configDB.txHash,
        deltaL: BigInt(configDB.deltaL),
        liquidityAfter: BigInt(configDB.liquidityAfter),
        feesCollected0: BigInt(configDB.feesCollected0),
        feesCollected1: BigInt(configDB.feesCollected1),
        uncollectedPrincipal0After: BigInt(configDB.uncollectedPrincipal0After),
        uncollectedPrincipal1After: BigInt(configDB.uncollectedPrincipal1After),
        sqrtPriceX96: BigInt(configDB.sqrtPriceX96),
    };
}
export function toEventConfigDB(config) {
    return {
        chainId: config.chainId,
        nftId: config.nftId.toString(),
        blockNumber: config.blockNumber.toString(),
        txIndex: config.txIndex,
        logIndex: config.logIndex,
        txHash: config.txHash,
        deltaL: config.deltaL.toString(),
        liquidityAfter: config.liquidityAfter.toString(),
        feesCollected0: config.feesCollected0.toString(),
        feesCollected1: config.feesCollected1.toString(),
        uncollectedPrincipal0After: config.uncollectedPrincipal0After.toString(),
        uncollectedPrincipal1After: config.uncollectedPrincipal1After.toString(),
        sqrtPriceX96: config.sqrtPriceX96.toString(),
    };
}
export function toEventState(stateDB) {
    if (stateDB.eventType === 'INCREASE_LIQUIDITY') {
        const result = {
            eventType: 'INCREASE_LIQUIDITY',
            tokenId: BigInt(stateDB.tokenId),
            liquidity: BigInt(stateDB.liquidity),
            amount0: BigInt(stateDB.amount0),
            amount1: BigInt(stateDB.amount1),
        };
        return result;
    }
    else if (stateDB.eventType === 'DECREASE_LIQUIDITY') {
        const result = {
            eventType: 'DECREASE_LIQUIDITY',
            tokenId: BigInt(stateDB.tokenId),
            liquidity: BigInt(stateDB.liquidity),
            amount0: BigInt(stateDB.amount0),
            amount1: BigInt(stateDB.amount1),
        };
        return result;
    }
    else {
        const result = {
            eventType: 'COLLECT',
            tokenId: BigInt(stateDB.tokenId),
            recipient: stateDB.recipient,
            amount0: BigInt(stateDB.amount0),
            amount1: BigInt(stateDB.amount1),
        };
        return result;
    }
}
export function toEventStateDB(state) {
    if (state.eventType === 'INCREASE_LIQUIDITY') {
        const result = {
            eventType: 'INCREASE_LIQUIDITY',
            tokenId: state.tokenId.toString(),
            liquidity: state.liquidity.toString(),
            amount0: state.amount0.toString(),
            amount1: state.amount1.toString(),
        };
        return result;
    }
    else if (state.eventType === 'DECREASE_LIQUIDITY') {
        const result = {
            eventType: 'DECREASE_LIQUIDITY',
            tokenId: state.tokenId.toString(),
            liquidity: state.liquidity.toString(),
            amount0: state.amount0.toString(),
            amount1: state.amount1.toString(),
        };
        return result;
    }
    else {
        const result = {
            eventType: 'COLLECT',
            tokenId: state.tokenId.toString(),
            recipient: state.recipient,
            amount0: state.amount0.toString(),
            amount1: state.amount1.toString(),
        };
        return result;
    }
}
//# sourceMappingURL=position-ledger-event-db.js.map