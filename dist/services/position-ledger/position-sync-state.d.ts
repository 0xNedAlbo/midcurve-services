import type { PrismaClient, PositionSyncState } from '@prisma/client';
import { type UniswapV3SyncEventDB, type UniswapV3SyncStateDB } from '../types/uniswapv3/position-sync-state-db.js';
export declare class UniswapV3PositionSyncState {
    private readonly _positionId;
    private _state;
    private _dbId?;
    private _lastSyncAt?;
    private _lastSyncBy?;
    private constructor();
    static load(prisma: PrismaClient, positionId: string): Promise<UniswapV3PositionSyncState>;
    get positionId(): string;
    get missingEvents(): UniswapV3SyncEventDB[];
    get missingEventCount(): number;
    get hasMissingEvents(): boolean;
    get lastSyncAt(): Date | undefined;
    get lastSyncBy(): string | undefined;
    get existsInDb(): boolean;
    addMissingEvent(event: UniswapV3SyncEventDB): void;
    addMissingEvents(events: UniswapV3SyncEventDB[]): void;
    removeMissingEvent(transactionHash: string, logIndex: number): boolean;
    removeMissingEventsByTxHash(transactionHash: string): number;
    clearMissingEvents(): void;
    pruneEvents(blockNumber: bigint | string): number;
    getMissingEventsSorted(): UniswapV3SyncEventDB[];
    save(prisma: PrismaClient, syncBy?: string): Promise<PositionSyncState>;
    delete(prisma: PrismaClient): Promise<void>;
    getRawState(): UniswapV3SyncStateDB;
    toJSON(): {
        positionId: string;
        missingEventCount: number;
        missingEvents: UniswapV3SyncEventDB[];
        lastSyncAt?: string;
        lastSyncBy?: string;
        existsInDb: boolean;
    };
}
//# sourceMappingURL=position-sync-state.d.ts.map