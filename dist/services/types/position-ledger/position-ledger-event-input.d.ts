import type { PositionLedgerEvent, PositionLedgerEventConfigMap } from '@midcurve/shared';
export type CreatePositionLedgerEventInput<P extends keyof PositionLedgerEventConfigMap> = Omit<PositionLedgerEvent<P>, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateUniswapV3LedgerEventInput = CreatePositionLedgerEventInput<'uniswapv3'>;
export type CreateAnyLedgerEventInput = CreatePositionLedgerEventInput<keyof PositionLedgerEventConfigMap>;
export interface UniswapV3LedgerEventDiscoverInput {
    eventType: 'INCREASE_LIQUIDITY' | 'DECREASE_LIQUIDITY' | 'COLLECT';
    blockNumber: bigint;
    transactionIndex: number;
    logIndex: number;
    transactionHash: string;
    timestamp: Date;
    tokenId: bigint;
    liquidity?: bigint;
    amount0: bigint;
    amount1: bigint;
    recipient?: string;
}
export interface PositionLedgerEventDiscoverInputMap {
    uniswapv3: UniswapV3LedgerEventDiscoverInput;
}
export type PositionLedgerEventDiscoverInput<P extends keyof PositionLedgerEventConfigMap> = PositionLedgerEventDiscoverInputMap[P];
export type UniswapV3EventDiscoverInput = PositionLedgerEventDiscoverInput<'uniswapv3'>;
export type AnyLedgerEventDiscoverInput = PositionLedgerEventDiscoverInput<keyof PositionLedgerEventConfigMap>;
//# sourceMappingURL=position-ledger-event-input.d.ts.map