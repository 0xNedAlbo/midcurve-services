export interface UniswapV3SyncEventDB {
    eventType: 'INCREASE_LIQUIDITY' | 'DECREASE_LIQUIDITY' | 'COLLECT';
    timestamp: string;
    blockNumber: string;
    transactionIndex: number;
    logIndex: number;
    transactionHash: string;
    liquidity?: string;
    amount0: string;
    amount1: string;
    recipient?: string;
}
export interface UniswapV3SyncStateDB {
    missingEvents: UniswapV3SyncEventDB[];
}
export declare function toSyncEventDB(event: UniswapV3SyncEventDB): UniswapV3SyncEventDB;
export declare function fromSyncEventDB(eventDB: UniswapV3SyncEventDB): UniswapV3SyncEventDB;
export declare function createEmptySyncState(): UniswapV3SyncStateDB;
export declare function parseSyncStateDB(stateDB: unknown): UniswapV3SyncStateDB;
export declare function serializeSyncStateDB(state: UniswapV3SyncStateDB): unknown;
//# sourceMappingURL=position-sync-state-db.d.ts.map