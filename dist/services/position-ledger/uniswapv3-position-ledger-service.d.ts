import { PositionLedgerService } from './position-ledger-service.js';
import type { PositionLedgerServiceDependencies } from './position-ledger-service.js';
import type { UniswapV3LedgerEvent, UniswapV3LedgerEventConfig, UniswapV3LedgerEventState } from '@midcurve/shared';
import type { CreateUniswapV3LedgerEventInput, UniswapV3EventDiscoverInput } from '../types/position-ledger/position-ledger-event-input.js';
import { EtherscanClient } from '../../clients/etherscan/index.js';
import { UniswapV3PositionService } from '../position/uniswapv3-position-service.js';
import { UniswapV3PoolService } from '../pool/uniswapv3-pool-service.js';
import { UniswapV3PoolPriceService } from '../pool-price/uniswapv3-pool-price-service.js';
export interface UniswapV3PositionLedgerServiceDependencies extends PositionLedgerServiceDependencies {
    etherscanClient?: EtherscanClient;
    positionService?: UniswapV3PositionService;
    poolService?: UniswapV3PoolService;
    poolPriceService?: UniswapV3PoolPriceService;
}
export declare class UniswapV3PositionLedgerService extends PositionLedgerService<'uniswapv3'> {
    private readonly _etherscanClient;
    private readonly _positionService;
    private readonly _poolService;
    private readonly _poolPriceService;
    constructor(dependencies?: UniswapV3PositionLedgerServiceDependencies);
    protected get etherscanClient(): EtherscanClient;
    protected get positionService(): UniswapV3PositionService;
    protected get poolService(): UniswapV3PoolService;
    protected get poolPriceService(): UniswapV3PoolPriceService;
    parseConfig(configDB: unknown): UniswapV3LedgerEventConfig;
    serializeConfig(config: UniswapV3LedgerEventConfig): unknown;
    parseState(stateDB: unknown): UniswapV3LedgerEventState;
    serializeState(state: UniswapV3LedgerEventState): unknown;
    generateInputHash(input: CreateUniswapV3LedgerEventInput): string;
    discoverAllEvents(positionId: string): Promise<UniswapV3LedgerEvent[]>;
    discoverEvent(positionId: string, input: UniswapV3EventDiscoverInput): Promise<UniswapV3LedgerEvent[]>;
    private fetchPositionData;
    private fetchPoolMetadata;
    addEventsFromUserData(positionId: string, events: Array<{
        eventType: 'INCREASE_LIQUIDITY' | 'DECREASE_LIQUIDITY' | 'COLLECT';
        timestamp: Date;
        blockNumber: bigint;
        transactionIndex: number;
        logIndex: number;
        transactionHash: string;
        tokenId: bigint;
        liquidity?: bigint;
        amount0: bigint;
        amount1: bigint;
        recipient?: string;
    }>): Promise<void>;
    private getHistoricPoolPrice;
    private buildEventFromRawData;
    private convertDiscoverInputToRawEvent;
    findAllItems(positionId: string): Promise<UniswapV3LedgerEvent[]>;
    private sortEventsChronologically;
}
//# sourceMappingURL=uniswapv3-position-ledger-service.d.ts.map