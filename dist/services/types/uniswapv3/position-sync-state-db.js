export function toSyncEventDB(event) {
    return {
        eventType: event.eventType,
        timestamp: event.timestamp,
        blockNumber: event.blockNumber,
        transactionIndex: event.transactionIndex,
        logIndex: event.logIndex,
        transactionHash: event.transactionHash,
        liquidity: event.liquidity,
        amount0: event.amount0,
        amount1: event.amount1,
        recipient: event.recipient,
    };
}
export function fromSyncEventDB(eventDB) {
    return {
        eventType: eventDB.eventType,
        timestamp: eventDB.timestamp,
        blockNumber: eventDB.blockNumber,
        transactionIndex: eventDB.transactionIndex,
        logIndex: eventDB.logIndex,
        transactionHash: eventDB.transactionHash,
        liquidity: eventDB.liquidity,
        amount0: eventDB.amount0,
        amount1: eventDB.amount1,
        recipient: eventDB.recipient,
    };
}
export function createEmptySyncState() {
    return {
        missingEvents: [],
    };
}
export function parseSyncStateDB(stateDB) {
    const state = stateDB;
    if (!state || typeof state !== 'object') {
        return createEmptySyncState();
    }
    if (!Array.isArray(state.missingEvents)) {
        return createEmptySyncState();
    }
    return {
        missingEvents: state.missingEvents,
    };
}
export function serializeSyncStateDB(state) {
    return {
        missingEvents: state.missingEvents,
    };
}
//# sourceMappingURL=position-sync-state-db.js.map