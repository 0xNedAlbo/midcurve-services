/**
 * UniswapV3 Ledger Sync Helper
 *
 * Orchestrates incremental ledger event syncing with finalized blocks.
 * Implements the core sync strategy for discovering and processing position events.
 */

import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { EtherscanClient } from '../../../../clients/etherscan/index.js';
import type { EvmBlockService } from '../../../block/evm-block-service.js';
import type { PositionAprService } from '../../../position-apr/position-apr-service.js';
import type { UniswapV3PositionLedgerService } from '../../uniswapv3-position-ledger-service.js';
import type { UniswapV3PoolPriceService } from '../../../pool-price/uniswapv3-pool-price-service.js';
import { getNfpmDeploymentBlock } from '../../../../config/uniswapv3.js';
import type { RawPositionEvent } from '../../../../clients/etherscan/types.js';
import { calculatePoolPriceInQuoteToken } from '../../../../utils/uniswapv3/ledger-calculations.js';
import { fetchPoolWithTokens } from './pool-metadata.js';
import {
  buildInitialState,
  extractPreviousEventId,
} from './state-builder.js';
import { sortRawEventsByBlockchain } from './event-sorting.js';
import { getHistoricPoolPrice } from './pool-price-fetcher.js';
import { buildEventInput } from './event-builder.js';

/**
 * Parameters for syncLedgerEvents function
 */
export interface SyncLedgerEventsParams {
  /** Position database ID */
  positionId: string;
  /** Chain ID */
  chainId: number;
  /** NFT token ID */
  nftId: bigint;
  /** Force full resync from NFPM deployment block */
  forceFullResync?: boolean;
}

/**
 * Result from syncLedgerEvents function
 */
export interface SyncLedgerEventsResult {
  /** Number of new events added */
  eventsAdded: number;
  /** Last finalized block number */
  finalizedBlock: bigint;
  /** Block number from which syncing started */
  fromBlock: bigint;
}

/**
 * Dependencies for ledger sync operations
 */
export interface LedgerSyncDependencies {
  /** Prisma client for database access */
  prisma: PrismaClient;
  /** Etherscan client for fetching events */
  etherscanClient: EtherscanClient;
  /** EVM block service for finalized block queries */
  evmBlockService: EvmBlockService;
  /** APR service for period calculation */
  aprService: PositionAprService;
  /** Logger instance */
  logger: Logger;
  /** Ledger service for adding events to database */
  ledgerService: UniswapV3PositionLedgerService;
  /** Pool price service for historic price discovery */
  poolPriceService: UniswapV3PoolPriceService;
}

/**
 * Sync ledger events for a Uniswap V3 position
 *
 * Implements incremental event discovery with finalized block boundary:
 * 1. Get last finalized block from chain
 * 2. Determine fromBlock (last event block OR NFPM deployment, whichever is earlier)
 * 3. Delete events >= fromBlock (ensures clean state for re-sync)
 * 4. Fetch new events from Etherscan (fromBlock → finalizedBlock)
 * 5. Process and save events sequentially
 * 6. Refresh APR periods
 *
 * @param params - Sync parameters
 * @param deps - Service dependencies
 * @returns Sync result with event count and block info
 */
export async function syncLedgerEvents(
  params: SyncLedgerEventsParams,
  deps: LedgerSyncDependencies
): Promise<SyncLedgerEventsResult> {
  const { positionId, chainId, nftId, forceFullResync = false } = params;
  const { prisma, etherscanClient, evmBlockService, aprService, logger } = deps;

  logger.info(
    { positionId, chainId, nftId: nftId.toString(), forceFullResync },
    'Starting ledger event sync'
  );

  try {
    // 1. Get last finalized block
    const finalizedBlock = await evmBlockService.getLastFinalizedBlockNumber(chainId);

    if (finalizedBlock === null || finalizedBlock === undefined) {
      const error = new Error(
        `Failed to retrieve finalized block number for chain ${chainId}. ` +
        'Chain may not be supported or RPC endpoint may be unavailable.'
      );
      logger.error(
        { positionId, chainId, error: error.message },
        'Finalized block is null or undefined'
      );
      throw error;
    }

    logger.debug(
      { positionId, finalizedBlock: finalizedBlock.toString() },
      'Retrieved last finalized block'
    );

    // 2. Determine fromBlock
    let fromBlock: bigint;

    if (forceFullResync) {
      // Full resync: start from NFPM deployment
      fromBlock = getNfpmDeploymentBlock(chainId);
      logger.info(
        { positionId, fromBlock: fromBlock.toString() },
        'Force full resync: using NFPM deployment block'
      );
    } else {
      // Incremental sync: start from last event block (or NFPM deployment if no events)
      const lastEvent = await getLastLedgerEvent(positionId, prisma);
      const lastEventBlock = lastEvent?.config.blockNumber ?? null;
      const nfpmBlock = getNfpmDeploymentBlock(chainId);

      // MIN(lastEventBlock || nfpmBlock, finalizedBlock)
      const startBlock = lastEventBlock !== null ? lastEventBlock : nfpmBlock;
      fromBlock = startBlock < finalizedBlock ? startBlock : finalizedBlock;

      logger.debug(
        {
          positionId,
          lastEventBlock: lastEventBlock?.toString() ?? 'null',
          nfpmBlock: nfpmBlock.toString(),
          finalizedBlock: finalizedBlock.toString(),
          fromBlock: fromBlock.toString(),
        },
        'Determined fromBlock for incremental sync'
      );
    }

    // 3. Delete events >= fromBlock (inclusive - ensures clean state)
    const deletedCount = await deleteEventsFromBlock(positionId, fromBlock, prisma, logger);
    logger.info(
      { positionId, fromBlock: fromBlock.toString(), deletedCount },
      'Deleted events from block onwards'
    );

    // 4. Fetch new events from Etherscan
    logger.info(
      {
        positionId,
        chainId,
        nftId: nftId.toString(),
        fromBlock: fromBlock.toString(),
        toBlock: finalizedBlock.toString(),
      },
      'Fetching events from Etherscan'
    );

    const rawEvents = await etherscanClient.fetchPositionEvents(chainId, nftId.toString(), {
      fromBlock: fromBlock.toString(),
      toBlock: finalizedBlock.toString(),
    });

    logger.info(
      { positionId, eventCount: rawEvents.length },
      'Fetched raw events from Etherscan'
    );

    if (rawEvents.length === 0) {
      logger.info({ positionId }, 'No new events found');
      // Still refresh APR in case events were deleted
      await aprService.refresh(positionId);
      return {
        eventsAdded: 0,
        finalizedBlock,
        fromBlock,
      };
    }

    // 5. Process and save events sequentially
    const eventsAdded = await processAndSaveEvents(
      positionId,
      rawEvents,
      deps
    );

    logger.info(
      { positionId, eventsAdded },
      'Processed and saved events'
    );

    // 6. Refresh APR periods
    logger.info({ positionId }, 'Refreshing APR periods');
    await aprService.refresh(positionId);

    logger.info(
      {
        positionId,
        eventsAdded,
        fromBlock: fromBlock.toString(),
        finalizedBlock: finalizedBlock.toString(),
      },
      'Ledger event sync completed'
    );

    return {
      eventsAdded,
      finalizedBlock,
      fromBlock,
    };
  } catch (error) {
    logger.error(
      { error, positionId, chainId, nftId: nftId.toString() },
      'Ledger event sync failed'
    );
    throw error;
  }
}

/**
 * Get the last ledger event for a position
 *
 * @param positionId - Position database ID
 * @param prisma - Prisma client
 * @returns Last event or null if no events exist
 */
async function getLastLedgerEvent(
  positionId: string,
  prisma: PrismaClient
): Promise<{ config: { blockNumber: bigint } } | null> {
  const lastEvent = await prisma.positionLedgerEvent.findFirst({
    where: { positionId },
    orderBy: { timestamp: 'desc' },
    select: { config: true },
  });

  if (!lastEvent) {
    return null;
  }

  // Parse blockNumber from config JSON
  const config = lastEvent.config as { blockNumber?: string };
  const blockNumber = config.blockNumber ? BigInt(config.blockNumber) : null;

  if (blockNumber === null) {
    throw new Error('Last event missing blockNumber in config');
  }

  return { config: { blockNumber } };
}

/**
 * Delete all ledger events from a specific block onwards (inclusive)
 *
 * @param positionId - Position database ID
 * @param fromBlock - Block number to start deletion from (inclusive)
 * @param prisma - Prisma client
 * @param logger - Logger instance
 * @returns Number of events deleted
 */
async function deleteEventsFromBlock(
  positionId: string,
  fromBlock: bigint,
  prisma: PrismaClient,
  logger: Logger
): Promise<number> {
  logger.debug(
    { positionId, fromBlock: fromBlock.toString() },
    'Deleting events from block onwards'
  );

  // Query events to delete (for count)
  const eventsToDelete = await prisma.positionLedgerEvent.findMany({
    where: {
      positionId,
      config: {
        path: ['blockNumber'],
        gte: fromBlock.toString(),
      },
    },
    select: { id: true },
  });

  if (eventsToDelete.length === 0) {
    logger.debug({ positionId }, 'No events to delete');
    return 0;
  }

  // Delete events
  const result = await prisma.positionLedgerEvent.deleteMany({
    where: {
      positionId,
      config: {
        path: ['blockNumber'],
        gte: fromBlock.toString(),
      },
    },
  });

  logger.debug(
    { positionId, deletedCount: result.count },
    'Deleted events successfully'
  );

  return result.count;
}

/**
 * Process and save raw events sequentially
 *
 * Orchestrates the complete event processing pipeline:
 * 1. Fetches position and pool metadata
 * 2. Gets last event for state initialization
 * 3. Sorts events chronologically
 * 4. For each event:
 *    - Discovers historic pool price at event block
 *    - Calculates pool price value in quote token
 *    - Builds event input with all financial calculations
 *    - Saves to database
 *    - Updates state for next iteration
 *
 * @param positionId - Position database ID
 * @param rawEvents - Raw events from Etherscan
 * @param deps - Service dependencies
 * @returns Number of events successfully saved
 */
async function processAndSaveEvents(
  positionId: string,
  rawEvents: RawPositionEvent[],
  deps: LedgerSyncDependencies
): Promise<number> {
  const { prisma, ledgerService, poolPriceService, logger } = deps;

  logger.debug(
    { positionId, rawEventCount: rawEvents.length },
    'Starting event processing'
  );

  // 1. Get poolId from position
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: { poolId: true },
  });

  if (!position) {
    throw new Error(`Position not found: ${positionId}`);
  }

  const poolId = position.poolId;

  // 2. Fetch pool metadata (tokens, decimals, quote designation)
  const poolMetadata = await fetchPoolWithTokens(poolId, prisma, logger);

  // 3. Get last existing event for state initialization
  const existingEvents = await ledgerService.findAllItems(positionId);
  const lastEvent = existingEvents[0]; // Newest first (descending order)

  // 4. Build initial state from last event
  let previousState = buildInitialState(lastEvent);
  let previousEventId = extractPreviousEventId(lastEvent);

  // 5. Sort raw events chronologically (ascending by block → tx → log index)
  const sortedEvents = sortRawEventsByBlockchain(rawEvents);

  logger.debug(
    {
      positionId,
      poolId,
      lastEventId: lastEvent?.id ?? null,
      sortedEventCount: sortedEvents.length,
    },
    'Initialized processing state'
  );

  // 6. Process each event sequentially
  let eventsAdded = 0;

  for (const rawEvent of sortedEvents) {
    logger.debug(
      {
        positionId,
        blockNumber: rawEvent.blockNumber.toString(),
        txIndex: rawEvent.transactionIndex,
        logIndex: rawEvent.logIndex,
        eventType: rawEvent.eventType,
      },
      'Processing event'
    );

    // 6a. Get historic pool price at event block
    const historicPrice = await getHistoricPoolPrice(
      poolId,
      rawEvent.blockNumber,
      poolPriceService,
      logger
    );

    // 6b. Calculate pool price value in quote token
    const poolPriceValue = calculatePoolPriceInQuoteToken(
      historicPrice.sqrtPriceX96,
      poolMetadata.token0IsQuote,
      poolMetadata.token0Decimals,
      poolMetadata.token1Decimals
    );

    // 6c. Build event input with financial calculations
    const eventInput = buildEventInput({
      rawEvent,
      previousState,
      poolMetadata,
      sqrtPriceX96: historicPrice.sqrtPriceX96,
      previousEventId,
      positionId,
      poolPrice: poolPriceValue,
    });

    // 6d. Save event to database
    const updatedEvents = await ledgerService.addItem(positionId, eventInput);

    // 6e. Update state for next iteration
    const justAddedEvent = updatedEvents[0]; // Newest first (just added)
    if (!justAddedEvent) {
      throw new Error(`Failed to save event for position ${positionId}`);
    }
    previousEventId = justAddedEvent.id;

    // Extract state from the event input config
    previousState = {
      uncollectedPrincipal0: eventInput.config.uncollectedPrincipal0After,
      uncollectedPrincipal1: eventInput.config.uncollectedPrincipal1After,
      liquidity: eventInput.config.liquidityAfter,
      costBasis: eventInput.costBasisAfter,
      pnl: eventInput.pnlAfter,
    };

    eventsAdded++;

    logger.debug(
      {
        positionId,
        eventId: previousEventId,
        blockNumber: rawEvent.blockNumber.toString(),
        eventType: rawEvent.eventType,
        costBasisAfter: previousState.costBasis.toString(),
        pnlAfter: previousState.pnl.toString(),
        liquidityAfter: previousState.liquidity.toString(),
      },
      'Event saved successfully'
    );
  }

  logger.info(
    { positionId, eventsAdded, totalRawEvents: rawEvents.length },
    'Event processing completed'
  );

  return eventsAdded;
}
