import type { RawPositionEvent } from '../../../../clients/etherscan/types.js';
import type { PreviousEventState } from './state-builder.js';
import type { PoolMetadata } from './pool-metadata.js';
import type { CreateUniswapV3LedgerEventInput } from '../../../types/position-ledger/position-ledger-event-input.js';
export interface BuildEventParams {
    rawEvent: RawPositionEvent;
    previousState: PreviousEventState;
    poolMetadata: PoolMetadata;
    sqrtPriceX96: bigint;
    previousEventId: string | null;
    positionId: string;
    poolPrice: bigint;
}
export declare function buildEventInput(params: BuildEventParams): CreateUniswapV3LedgerEventInput;
export declare function generateInputHash(config: {
    blockNumber: bigint;
    txIndex: number | bigint;
    logIndex: number | bigint;
    [key: string]: any;
}): string;
//# sourceMappingURL=event-builder.d.ts.map