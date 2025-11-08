import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { EtherscanClient } from '../../../../clients/etherscan/index.js';
import type { EvmBlockService } from '../../../block/evm-block-service.js';
import type { PositionAprService } from '../../../position-apr/position-apr-service.js';
import type { UniswapV3PositionLedgerService } from '../../uniswapv3-position-ledger-service.js';
import type { UniswapV3PoolPriceService } from '../../../pool-price/uniswapv3-pool-price-service.js';
export interface SyncLedgerEventsParams {
    positionId: string;
    chainId: number;
    nftId: bigint;
    forceFullResync?: boolean;
}
export interface SyncLedgerEventsResult {
    eventsAdded: number;
    finalizedBlock: bigint;
    fromBlock: bigint;
}
export interface LedgerSyncDependencies {
    prisma: PrismaClient;
    etherscanClient: EtherscanClient;
    evmBlockService: EvmBlockService;
    aprService: PositionAprService;
    logger: Logger;
    ledgerService: UniswapV3PositionLedgerService;
    poolPriceService: UniswapV3PoolPriceService;
}
export declare function syncLedgerEvents(params: SyncLedgerEventsParams, deps: LedgerSyncDependencies): Promise<SyncLedgerEventsResult>;
//# sourceMappingURL=ledger-sync.d.ts.map