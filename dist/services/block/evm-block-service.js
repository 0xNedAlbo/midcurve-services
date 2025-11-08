import { getEvmConfig } from '../../config/evm.js';
import { getBlockByNumber, getBlockByTag, getCurrentBlockNumber, } from '../../utils/evm/block-reader.js';
import { createServiceLogger, log } from '../../logging/logger-factory.js';
export class EvmBlockService {
    evmConfig;
    logger = createServiceLogger('EvmBlockService');
    constructor(dependencies = {}) {
        this.evmConfig = dependencies.evmConfig ?? getEvmConfig();
    }
    async getBlockByNumber(blockNumber, chainId) {
        log.methodEntry(this.logger, 'getBlockByNumber', {
            blockNumber: blockNumber.toString(),
            chainId,
        });
        try {
            const block = await getBlockByNumber(blockNumber, chainId, this.evmConfig);
            log.methodExit(this.logger, 'getBlockByNumber', {
                blockNumber: blockNumber.toString(),
                chainId,
                hash: block.hash,
            });
            return block;
        }
        catch (error) {
            log.methodError(this.logger, 'getBlockByNumber', error, {
                blockNumber: blockNumber.toString(),
                chainId,
            });
            throw error;
        }
    }
    async getBlockByTag(blockTag, chainId) {
        log.methodEntry(this.logger, 'getBlockByTag', { blockTag, chainId });
        try {
            const block = await getBlockByTag(blockTag, chainId, this.evmConfig);
            if (block) {
                log.methodExit(this.logger, 'getBlockByTag', {
                    blockTag,
                    chainId,
                    blockNumber: block.number.toString(),
                    hash: block.hash,
                });
            }
            else {
                this.logger.info({ blockTag, chainId }, 'Block tag not supported');
            }
            return block;
        }
        catch (error) {
            log.methodError(this.logger, 'getBlockByTag', error, {
                blockTag,
                chainId,
            });
            throw error;
        }
    }
    async getCurrentBlockNumber(chainId) {
        log.methodEntry(this.logger, 'getCurrentBlockNumber', { chainId });
        try {
            const blockNumber = await getCurrentBlockNumber(chainId, this.evmConfig);
            log.methodExit(this.logger, 'getCurrentBlockNumber', {
                chainId,
                blockNumber: blockNumber.toString(),
            });
            return blockNumber;
        }
        catch (error) {
            log.methodError(this.logger, 'getCurrentBlockNumber', error, {
                chainId,
            });
            throw error;
        }
    }
    async getLastFinalizedBlockNumber(chainId) {
        log.methodEntry(this.logger, 'getLastFinalizedBlockNumber', { chainId });
        try {
            const finalityConfig = this.evmConfig.getFinalityConfig(chainId);
            let finalizedBlockNumber = null;
            if (finalityConfig.type === 'blockTag') {
                const finalizedBlock = await getBlockByTag('finalized', chainId, this.evmConfig);
                finalizedBlockNumber = finalizedBlock?.number ?? null;
            }
            else if (finalityConfig.type === 'blockHeight') {
                const latestBlockNumber = await getCurrentBlockNumber(chainId, this.evmConfig);
                if (latestBlockNumber !== null) {
                    const calculated = latestBlockNumber - BigInt(finalityConfig.minBlockHeight);
                    finalizedBlockNumber = calculated >= 0n ? calculated : null;
                }
            }
            if (finalizedBlockNumber !== null) {
                log.methodExit(this.logger, 'getLastFinalizedBlockNumber', {
                    chainId,
                    finalizedBlockNumber: finalizedBlockNumber.toString(),
                    finalityType: finalityConfig.type,
                });
            }
            else {
                this.logger.info({ chainId, finalityType: finalityConfig.type }, 'No finalized block available');
            }
            return finalizedBlockNumber;
        }
        catch (error) {
            log.methodError(this.logger, 'getLastFinalizedBlockNumber', error, {
                chainId,
            });
            throw error;
        }
    }
    async isBlockFinalized(blockNumber, chainId) {
        log.methodEntry(this.logger, 'isBlockFinalized', {
            blockNumber: blockNumber.toString(),
            chainId,
        });
        try {
            const finalizedBlockNumber = await this.getLastFinalizedBlockNumber(chainId);
            if (finalizedBlockNumber === null) {
                this.logger.info({ blockNumber: blockNumber.toString(), chainId }, 'Cannot determine finality (no finalized block)');
                return false;
            }
            const isFinalized = blockNumber <= finalizedBlockNumber;
            log.methodExit(this.logger, 'isBlockFinalized', {
                blockNumber: blockNumber.toString(),
                chainId,
                finalizedBlockNumber: finalizedBlockNumber.toString(),
                isFinalized,
            });
            return isFinalized;
        }
        catch (error) {
            log.methodError(this.logger, 'isBlockFinalized', error, {
                blockNumber: blockNumber.toString(),
                chainId,
            });
            throw error;
        }
    }
}
//# sourceMappingURL=evm-block-service.js.map