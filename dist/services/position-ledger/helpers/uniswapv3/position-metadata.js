import { log } from '../../../../logging/index.js';
export async function fetchPositionMetadata(positionId, prisma, logger) {
    log.dbOperation(logger, 'findUnique', 'Position', { id: positionId });
    const position = await prisma.position.findUnique({
        where: { id: positionId },
        include: { pool: true },
    });
    if (!position) {
        throw new Error(`Position not found: ${positionId}`);
    }
    if (position.protocol !== 'uniswapv3') {
        throw new Error(`Invalid position protocol '${position.protocol}'. Expected 'uniswapv3'.`);
    }
    const config = position.config;
    return {
        position: position,
        nftId: BigInt(config.nftId),
        chainId: config.chainId,
        poolId: position.poolId,
    };
}
//# sourceMappingURL=position-metadata.js.map