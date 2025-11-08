import type { UniswapV3SyncEventDB } from '../../../types/uniswapv3/position-sync-state-db.js';
import type { RawPositionEvent } from '../../../../clients/etherscan/types.js';
import type { PositionLedgerEvent } from '@midcurve/shared';
export declare function convertMissingEventToRawEvent(event: UniswapV3SyncEventDB, chainId: number, tokenId: string): RawPositionEvent;
export declare function mergeEvents(etherscanEvents: RawPositionEvent[], missingEvents: RawPositionEvent[]): RawPositionEvent[];
export declare function deduplicateEvents(events: RawPositionEvent[]): RawPositionEvent[];
export declare function findConfirmedMissingEvents(missingEvents: UniswapV3SyncEventDB[], ledgerEvents: PositionLedgerEvent<'uniswapv3'>[]): string[];
//# sourceMappingURL=missing-events.d.ts.map