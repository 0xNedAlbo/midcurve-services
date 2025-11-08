import type { EvmConfig } from '../../config/evm.js';
import type { EvmBlockInfo } from '../../services/types/block/evm-block-info.js';
export declare function getBlockByNumber(blockNumber: bigint, chainId: number, evmConfig: EvmConfig): Promise<EvmBlockInfo>;
export declare function getBlockByTag(blockTag: 'finalized' | 'safe' | 'latest', chainId: number, evmConfig: EvmConfig): Promise<EvmBlockInfo | null>;
export declare function getCurrentBlockNumber(chainId: number, evmConfig: EvmConfig): Promise<bigint>;
//# sourceMappingURL=block-reader.d.ts.map