import { type PublicClient } from 'viem';
import { type Chain } from 'viem/chains';
export type FinalityConfig = {
    type: 'blockTag';
} | {
    type: 'blockHeight';
    minBlockHeight: number;
};
export interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    blockExplorer?: string;
    viemChain: Chain;
    finality: FinalityConfig;
}
export declare enum SupportedChainId {
    ETHEREUM = 1,
    ARBITRUM = 42161,
    BASE = 8453,
    BSC = 56,
    POLYGON = 137,
    OPTIMISM = 10
}
export declare class EvmConfig {
    private static instance;
    private readonly chains;
    private readonly clients;
    constructor();
    static getInstance(): EvmConfig;
    static resetInstance(): void;
    private initializeChains;
    private getEnvVarNameForChain;
    getChainConfig(chainId: number): ChainConfig;
    getPublicClient(chainId: number): PublicClient;
    getSupportedChainIds(): number[];
    isChainSupported(chainId: number): boolean;
    getFinalityConfig(chainId: number): FinalityConfig;
}
export declare function getEvmConfig(): EvmConfig;
//# sourceMappingURL=evm.d.ts.map