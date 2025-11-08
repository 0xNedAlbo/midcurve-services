import { getNfpmDeploymentBlock } from '../../../../config/uniswapv3.js';
import { calculatePoolPriceInQuoteToken } from '../../../../utils/uniswapv3/ledger-calculations.js';
import { fetchPoolWithTokens } from './pool-metadata.js';
import { buildInitialState, extractPreviousEventId, } from './state-builder.js';
import { sortRawEventsByBlockchain } from './event-sorting.js';
import { getHistoricPoolPrice } from './pool-price-fetcher.js';
import { buildEventInput } from './event-builder.js';
import { convertMissingEventToRawEvent, mergeEvents, deduplicateEvents, } from './missing-events.js';
import { UniswapV3PositionSyncState } from '../../position-sync-state.js';
export async function syncLedgerEvents(params, deps) {
    const { positionId, chainId, nftId, forceFullResync = false } = params;
    const { prisma, etherscanClient, evmBlockService, aprService, logger } = deps;
    logger.info({ positionId, chainId, nftId: nftId.toString(), forceFullResync }, 'Starting ledger event sync');
    try {
        const finalizedBlock = await evmBlockService.getLastFinalizedBlockNumber(chainId);
        if (finalizedBlock === null || finalizedBlock === undefined) {
            const error = new Error(`Failed to retrieve finalized block number for chain ${chainId}. ` +
                'Chain may not be supported or RPC endpoint may be unavailable.');
            logger.error({ positionId, chainId, error: error.message }, 'Finalized block is null or undefined');
            throw error;
        }
        logger.debug({ positionId, finalizedBlock: finalizedBlock.toString() }, 'Retrieved last finalized block');
        const syncState = await UniswapV3PositionSyncState.load(prisma, positionId);
        const missingEventsDB = syncState.getMissingEventsSorted();
        logger.debug({ positionId, missingEventCount: missingEventsDB.length }, 'Loaded sync state');
        let fromBlock;
        if (forceFullResync) {
            fromBlock = getNfpmDeploymentBlock(chainId);
            logger.info({ positionId, fromBlock: fromBlock.toString() }, 'Force full resync: using NFPM deployment block');
        }
        else {
            const lastEvent = await getLastLedgerEvent(positionId, prisma);
            const lastEventBlock = lastEvent?.config.blockNumber ?? null;
            const nfpmBlock = getNfpmDeploymentBlock(chainId);
            const startBlock = lastEventBlock !== null ? lastEventBlock : nfpmBlock;
            fromBlock = startBlock < finalizedBlock ? startBlock : finalizedBlock;
            logger.debug({
                positionId,
                lastEventBlock: lastEventBlock?.toString() ?? 'null',
                nfpmBlock: nfpmBlock.toString(),
                finalizedBlock: finalizedBlock.toString(),
                fromBlock: fromBlock.toString(),
            }, 'Determined fromBlock for incremental sync');
        }
        const deletedCount = await deleteEventsFromBlock(positionId, fromBlock, prisma, logger);
        logger.info({ positionId, fromBlock: fromBlock.toString(), deletedCount }, 'Deleted events from block onwards');
        logger.info({
            positionId,
            chainId,
            nftId: nftId.toString(),
            fromBlock: fromBlock.toString(),
            toBlock: 'latest',
        }, 'Fetching events from Etherscan');
        const etherscanEvents = await etherscanClient.fetchPositionEvents(chainId, nftId.toString(), {
            fromBlock: fromBlock.toString(),
            toBlock: 'latest',
        });
        logger.info({ positionId, etherscanEventCount: etherscanEvents.length }, 'Fetched raw events from Etherscan');
        const missingEventsRaw = missingEventsDB.map(event => convertMissingEventToRawEvent(event, chainId, nftId.toString()));
        logger.debug({ positionId, missingEventCount: missingEventsRaw.length }, 'Converted missing events to raw format');
        const mergedEvents = mergeEvents(etherscanEvents, missingEventsRaw);
        const deduplicatedEvents = deduplicateEvents(mergedEvents);
        logger.info({
            positionId,
            etherscanCount: etherscanEvents.length,
            missingCount: missingEventsRaw.length,
            mergedCount: mergedEvents.length,
            deduplicatedCount: deduplicatedEvents.length,
        }, 'Merged and deduplicated events');
        if (deduplicatedEvents.length === 0) {
            logger.info({ positionId }, 'No new events found after merge');
            await aprService.refresh(positionId);
            await syncState.save(prisma, 'ledger-sync');
            return {
                eventsAdded: 0,
                finalizedBlock,
                fromBlock,
            };
        }
        const eventsAdded = await processAndSaveEvents(positionId, deduplicatedEvents, deps);
        logger.info({ positionId, eventsAdded }, 'Processed and saved events');
        if (missingEventsDB.length > 0) {
            let totalRemoved = 0;
            for (const missingEvent of missingEventsDB) {
                const eventBlock = BigInt(missingEvent.blockNumber);
                let shouldRemove = false;
                let reason = '';
                const foundInEtherscan = etherscanEvents.some((ethEvent) => ethEvent.transactionHash === missingEvent.transactionHash &&
                    ethEvent.logIndex === missingEvent.logIndex);
                if (foundInEtherscan) {
                    shouldRemove = true;
                    reason = 'found-in-etherscan';
                }
                else if (eventBlock <= finalizedBlock) {
                    shouldRemove = true;
                    reason = 'finalized-but-not-found';
                }
                if (shouldRemove) {
                    if (syncState.removeMissingEvent(missingEvent.transactionHash, missingEvent.logIndex)) {
                        totalRemoved++;
                        logger.debug({
                            positionId,
                            transactionHash: missingEvent.transactionHash,
                            blockNumber: missingEvent.blockNumber,
                            eventType: missingEvent.eventType,
                            reason,
                        }, 'Removed missing event');
                    }
                }
            }
            logger.info({
                positionId,
                missingEventsBefore: missingEventsDB.length,
                removedCount: totalRemoved,
                missingEventsAfter: syncState.getMissingEventsSorted().length,
                finalizedBlock: finalizedBlock.toString(),
            }, 'Cleaned up missing events');
        }
        await syncState.save(prisma, 'ledger-sync');
        logger.info({ positionId }, 'Refreshing APR periods');
        await aprService.refresh(positionId);
        logger.info({
            positionId,
            eventsAdded,
            fromBlock: fromBlock.toString(),
            finalizedBlock: finalizedBlock.toString(),
        }, 'Ledger event sync completed');
        return {
            eventsAdded,
            finalizedBlock,
            fromBlock,
        };
    }
    catch (error) {
        logger.error({ error, positionId, chainId, nftId: nftId.toString() }, 'Ledger event sync failed');
        throw error;
    }
}
async function getLastLedgerEvent(positionId, prisma) {
    const lastEvent = await prisma.positionLedgerEvent.findFirst({
        where: { positionId },
        orderBy: { timestamp: 'desc' },
        select: { config: true },
    });
    if (!lastEvent) {
        return null;
    }
    const config = lastEvent.config;
    const blockNumber = config.blockNumber ? BigInt(config.blockNumber) : null;
    if (blockNumber === null) {
        throw new Error('Last event missing blockNumber in config');
    }
    return { config: { blockNumber } };
}
async function deleteEventsFromBlock(positionId, fromBlock, prisma, logger) {
    logger.debug({ positionId, fromBlock: fromBlock.toString() }, 'Deleting events from block onwards');
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
    const result = await prisma.positionLedgerEvent.deleteMany({
        where: {
            positionId,
            config: {
                path: ['blockNumber'],
                gte: fromBlock.toString(),
            },
        },
    });
    logger.debug({ positionId, deletedCount: result.count }, 'Deleted events successfully');
    return result.count;
}
async function processAndSaveEvents(positionId, rawEvents, deps) {
    const { prisma, ledgerService, poolPriceService, logger } = deps;
    logger.debug({ positionId, rawEventCount: rawEvents.length }, 'Starting event processing');
    const position = await prisma.position.findUnique({
        where: { id: positionId },
        select: { poolId: true },
    });
    if (!position) {
        throw new Error(`Position not found: ${positionId}`);
    }
    const poolId = position.poolId;
    const poolMetadata = await fetchPoolWithTokens(poolId, prisma, logger);
    const existingEvents = await ledgerService.findAllItems(positionId);
    const lastEvent = existingEvents[0];
    let previousState = buildInitialState(lastEvent);
    let previousEventId = extractPreviousEventId(lastEvent);
    const sortedEvents = sortRawEventsByBlockchain(rawEvents);
    logger.debug({
        positionId,
        poolId,
        lastEventId: lastEvent?.id ?? null,
        sortedEventCount: sortedEvents.length,
    }, 'Initialized processing state');
    let eventsAdded = 0;
    for (const rawEvent of sortedEvents) {
        logger.debug({
            positionId,
            blockNumber: rawEvent.blockNumber.toString(),
            txIndex: rawEvent.transactionIndex,
            logIndex: rawEvent.logIndex,
            eventType: rawEvent.eventType,
        }, 'Processing event');
        const historicPrice = await getHistoricPoolPrice(poolId, rawEvent.blockNumber, poolPriceService, logger);
        const poolPriceValue = calculatePoolPriceInQuoteToken(historicPrice.sqrtPriceX96, poolMetadata.token0IsQuote, poolMetadata.token0Decimals, poolMetadata.token1Decimals);
        const eventInput = buildEventInput({
            rawEvent,
            previousState,
            poolMetadata,
            sqrtPriceX96: historicPrice.sqrtPriceX96,
            previousEventId,
            positionId,
            poolPrice: poolPriceValue,
        });
        const updatedEvents = await ledgerService.addItem(positionId, eventInput);
        const justAddedEvent = updatedEvents[0];
        if (!justAddedEvent) {
            throw new Error(`Failed to save event for position ${positionId}`);
        }
        previousEventId = justAddedEvent.id;
        previousState = {
            uncollectedPrincipal0: eventInput.config.uncollectedPrincipal0After,
            uncollectedPrincipal1: eventInput.config.uncollectedPrincipal1After,
            liquidity: eventInput.config.liquidityAfter,
            costBasis: eventInput.costBasisAfter,
            pnl: eventInput.pnlAfter,
        };
        eventsAdded++;
        logger.debug({
            positionId,
            eventId: previousEventId,
            blockNumber: rawEvent.blockNumber.toString(),
            eventType: rawEvent.eventType,
            costBasisAfter: previousState.costBasis.toString(),
            pnlAfter: previousState.pnl.toString(),
            liquidityAfter: previousState.liquidity.toString(),
        }, 'Event saved successfully');
    }
    logger.info({ positionId, eventsAdded, totalRawEvents: rawEvents.length }, 'Event processing completed');
    return eventsAdded;
}
//# sourceMappingURL=ledger-sync.js.map