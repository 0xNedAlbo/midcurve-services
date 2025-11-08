import type { EvmConfig } from '../../config/evm.js';
import type { EvmBlockInfo } from '../types/block/evm-block-info.js';
export interface EvmBlockServiceDependencies {
    evmConfig?: EvmConfig;
}
export declare class EvmBlockService {
    private readonly evmConfig;
    private readonly logger;
    constructor(dependencies?: EvmBlockServiceDependencies);
    getBlockByNumber(blockNumber: bigint, chainId: number): Promise<EvmBlockInfo>;
    getBlockByTag(blockTag: 'finalized' | 'safe' | 'latest', chainId: number): Promise<EvmBlockInfo | null>;
    getCurrentBlockNumber(chainId: number): Promise<bigint>;
    getLastFinalizedBlockNumber(chainId: number): Promise<bigint | null>;
    isBlockFinalized(blockNumber: bigint, chainId: number): Promise<boolean>;
}
//# sourceMappingURL=evm-block-service.d.ts.map