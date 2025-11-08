export interface EvmBlockInfo {
    hash: string;
    number: bigint;
    timestamp: bigint;
    gasUsed: bigint;
    gasLimit: bigint;
    baseFeePerGas: bigint | null;
    transactionCount: number;
    parentHash: string;
    blockTag?: string;
}
//# sourceMappingURL=evm-block-info.d.ts.map