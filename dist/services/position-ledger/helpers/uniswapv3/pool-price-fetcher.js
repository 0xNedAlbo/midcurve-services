export async function getHistoricPoolPrice(poolId, blockNumber, poolPriceService, logger) {
    logger.debug({ poolId, blockNumber: blockNumber.toString() }, 'Discovering historic pool price');
    const poolPrice = await poolPriceService.discover(poolId, {
        blockNumber: Number(blockNumber),
    });
    const sqrtPriceX96 = poolPrice.state.sqrtPriceX96;
    logger.debug({
        poolId,
        blockNumber: blockNumber.toString(),
        sqrtPriceX96: sqrtPriceX96.toString(),
        timestamp: poolPrice.timestamp,
    }, 'Historic pool price discovered');
    return {
        poolPrice,
        sqrtPriceX96,
        timestamp: poolPrice.timestamp,
    };
}
//# sourceMappingURL=pool-price-fetcher.js.map