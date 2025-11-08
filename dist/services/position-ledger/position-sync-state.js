import { createEmptySyncState, fromSyncEventDB, parseSyncStateDB, serializeSyncStateDB, toSyncEventDB, } from '../types/uniswapv3/position-sync-state-db.js';
export class UniswapV3PositionSyncState {
    _positionId;
    _state;
    _dbId;
    _lastSyncAt;
    _lastSyncBy;
    constructor(positionId, state, dbId, lastSyncAt, lastSyncBy) {
        this._positionId = positionId;
        this._state = state;
        this._dbId = dbId;
        this._lastSyncAt = lastSyncAt;
        this._lastSyncBy = lastSyncBy;
    }
    static async load(prisma, positionId) {
        const syncState = await prisma.positionSyncState.findUnique({
            where: { positionId },
        });
        if (!syncState) {
            return new UniswapV3PositionSyncState(positionId, createEmptySyncState());
        }
        const parsedState = parseSyncStateDB(syncState.state);
        return new UniswapV3PositionSyncState(positionId, parsedState, syncState.id, syncState.lastSyncAt ?? undefined, syncState.lastSyncBy ?? undefined);
    }
    get positionId() {
        return this._positionId;
    }
    get missingEvents() {
        return this._state.missingEvents.map(fromSyncEventDB);
    }
    get missingEventCount() {
        return this._state.missingEvents.length;
    }
    get hasMissingEvents() {
        return this._state.missingEvents.length > 0;
    }
    get lastSyncAt() {
        return this._lastSyncAt;
    }
    get lastSyncBy() {
        return this._lastSyncBy;
    }
    get existsInDb() {
        return this._dbId !== undefined;
    }
    addMissingEvent(event) {
        const eventDB = toSyncEventDB(event);
        this._state.missingEvents.push(eventDB);
    }
    addMissingEvents(events) {
        const eventsDB = events.map(toSyncEventDB);
        this._state.missingEvents.push(...eventsDB);
    }
    removeMissingEvent(transactionHash, logIndex) {
        const initialLength = this._state.missingEvents.length;
        this._state.missingEvents = this._state.missingEvents.filter((event) => !(event.transactionHash === transactionHash &&
            event.logIndex === logIndex));
        return this._state.missingEvents.length < initialLength;
    }
    removeMissingEventsByTxHash(transactionHash) {
        const initialLength = this._state.missingEvents.length;
        this._state.missingEvents = this._state.missingEvents.filter((event) => event.transactionHash !== transactionHash);
        return initialLength - this._state.missingEvents.length;
    }
    clearMissingEvents() {
        this._state.missingEvents = [];
    }
    pruneEvents(blockNumber) {
        const targetBlock = typeof blockNumber === 'string' ? BigInt(blockNumber) : blockNumber;
        const initialLength = this._state.missingEvents.length;
        this._state.missingEvents = this._state.missingEvents.filter((event) => {
            const eventBlock = BigInt(event.blockNumber);
            return eventBlock > targetBlock;
        });
        return initialLength - this._state.missingEvents.length;
    }
    getMissingEventsSorted() {
        const sorted = [...this._state.missingEvents].sort((a, b) => {
            const blockA = BigInt(a.blockNumber);
            const blockB = BigInt(b.blockNumber);
            if (blockA < blockB)
                return -1;
            if (blockA > blockB)
                return 1;
            if (a.transactionIndex < b.transactionIndex)
                return -1;
            if (a.transactionIndex > b.transactionIndex)
                return 1;
            return a.logIndex - b.logIndex;
        });
        return sorted.map(fromSyncEventDB);
    }
    async save(prisma, syncBy) {
        const serializedState = serializeSyncStateDB(this._state);
        const now = new Date();
        if (this._dbId) {
            const updated = await prisma.positionSyncState.update({
                where: { id: this._dbId },
                data: {
                    state: serializedState,
                    lastSyncAt: now,
                    lastSyncBy: syncBy ?? this._lastSyncBy,
                    updatedAt: now,
                },
            });
            this._lastSyncAt = updated.lastSyncAt ?? undefined;
            this._lastSyncBy = updated.lastSyncBy ?? undefined;
            return updated;
        }
        else {
            const created = await prisma.positionSyncState.create({
                data: {
                    positionId: this._positionId,
                    state: serializedState,
                    lastSyncAt: now,
                    lastSyncBy: syncBy ?? 'user-refresh',
                },
            });
            this._dbId = created.id;
            this._lastSyncAt = created.lastSyncAt ?? undefined;
            this._lastSyncBy = created.lastSyncBy ?? undefined;
            return created;
        }
    }
    async delete(prisma) {
        if (!this._dbId) {
            return;
        }
        await prisma.positionSyncState.delete({
            where: { id: this._dbId },
        });
        this._dbId = undefined;
        this._lastSyncAt = undefined;
        this._lastSyncBy = undefined;
    }
    getRawState() {
        return { ...this._state };
    }
    toJSON() {
        return {
            positionId: this._positionId,
            missingEventCount: this.missingEventCount,
            missingEvents: this.missingEvents,
            lastSyncAt: this._lastSyncAt?.toISOString(),
            lastSyncBy: this._lastSyncBy,
            existsInDb: this.existsInDb,
        };
    }
}
//# sourceMappingURL=position-sync-state.js.map