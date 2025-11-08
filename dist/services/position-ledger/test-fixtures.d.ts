import type { CreateUniswapV3LedgerEventInput, UniswapV3LedgerEventDiscoverInput } from '../types/position-ledger/position-ledger-event-input.js';
export interface LedgerEventFixture {
    input: CreateUniswapV3LedgerEventInput;
    dbResult: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        positionId: string;
        protocol: string;
        previousId: string | null;
        timestamp: Date;
        eventType: string;
        inputHash: string;
        poolPrice: string;
        token0Amount: string;
        token1Amount: string;
        tokenValue: string;
        rewards: object[];
        deltaCostBasis: string;
        costBasisAfter: string;
        deltaPnl: string;
        pnlAfter: string;
        config: object;
        state: object;
    };
}
export interface LedgerEventDiscoveryFixture {
    input: UniswapV3LedgerEventDiscoverInput;
}
export declare const INCREASE_POSITION_FIRST: LedgerEventFixture;
export declare const DECREASE_POSITION_SECOND: LedgerEventFixture;
export declare const COLLECT_THIRD: LedgerEventFixture;
export declare const DISCOVER_INCREASE: LedgerEventDiscoveryFixture;
export declare const DISCOVER_DECREASE: LedgerEventDiscoveryFixture;
export declare const DISCOVER_COLLECT: LedgerEventDiscoveryFixture;
export declare function createEventFixture(base: LedgerEventFixture, overrides: Partial<LedgerEventFixture>): LedgerEventFixture;
//# sourceMappingURL=test-fixtures.d.ts.map