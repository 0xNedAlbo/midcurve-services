export function convertMissingEventToRawEvent(event, chainId, tokenId) {
    const baseEvent = {
        eventType: event.eventType,
        tokenId,
        transactionHash: event.transactionHash,
        blockNumber: BigInt(event.blockNumber),
        transactionIndex: event.transactionIndex,
        logIndex: event.logIndex,
        blockTimestamp: new Date(event.timestamp),
        chainId,
    };
    if (event.amount0 !== undefined) {
        baseEvent.amount0 = event.amount0;
    }
    if (event.amount1 !== undefined) {
        baseEvent.amount1 = event.amount1;
    }
    if (event.liquidity !== undefined) {
        baseEvent.liquidity = event.liquidity;
    }
    if (event.recipient !== undefined) {
        baseEvent.recipient = event.recipient;
    }
    return baseEvent;
}
export function mergeEvents(etherscanEvents, missingEvents) {
    return [...etherscanEvents, ...missingEvents];
}
export function deduplicateEvents(events) {
    const seen = new Map();
    for (const event of events) {
        const key = `${event.blockNumber}-${event.transactionIndex}-${event.logIndex}`;
        if (!seen.has(key)) {
            seen.set(key, event);
        }
    }
    return Array.from(seen.values());
}
export function findConfirmedMissingEvents(missingEvents, ledgerEvents) {
    const confirmedTxHashes = new Set();
    for (const missingEvent of missingEvents) {
        const found = ledgerEvents.some((ledgerEvent) => {
            const config = ledgerEvent.config;
            return (config.blockNumber === BigInt(missingEvent.blockNumber) &&
                config.txIndex === missingEvent.transactionIndex);
        });
        if (found) {
            confirmedTxHashes.add(missingEvent.transactionHash);
        }
    }
    return Array.from(confirmedTxHashes);
}
//# sourceMappingURL=missing-events.js.map