export async function getBlockByNumber(blockNumber, chainId, evmConfig) {
    const client = evmConfig.getPublicClient(chainId);
    const chainConfig = evmConfig.getChainConfig(chainId);
    try {
        const block = await client.getBlock({
            blockNumber,
            includeTransactions: false,
        });
        if (!block) {
            throw new Error(`Block not found: ${blockNumber} on ${chainConfig.name} (Chain ID: ${chainId})`);
        }
        return {
            hash: block.hash,
            number: block.number,
            timestamp: block.timestamp,
            gasUsed: block.gasUsed,
            gasLimit: block.gasLimit,
            baseFeePerGas: block.baseFeePerGas ?? null,
            transactionCount: block.transactions.length,
            parentHash: block.parentHash,
        };
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get block ${blockNumber} on ${chainConfig.name} (Chain ID: ${chainId}): ${error.message}`);
        }
        throw new Error(`Unknown error getting block ${blockNumber} on ${chainConfig.name} (Chain ID: ${chainId})`);
    }
}
export async function getBlockByTag(blockTag, chainId, evmConfig) {
    const client = evmConfig.getPublicClient(chainId);
    try {
        const block = await client.getBlock({
            blockTag,
            includeTransactions: false,
        });
        if (!block || !block.number) {
            return null;
        }
        return {
            hash: block.hash,
            number: block.number,
            timestamp: block.timestamp,
            gasUsed: block.gasUsed,
            gasLimit: block.gasLimit,
            baseFeePerGas: block.baseFeePerGas ?? null,
            transactionCount: block.transactions.length,
            parentHash: block.parentHash,
            blockTag,
        };
    }
    catch (error) {
        return null;
    }
}
export async function getCurrentBlockNumber(chainId, evmConfig) {
    const client = evmConfig.getPublicClient(chainId);
    const chainConfig = evmConfig.getChainConfig(chainId);
    try {
        return await client.getBlockNumber();
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get current block number on ${chainConfig.name} (Chain ID: ${chainId}): ${error.message}`);
        }
        throw new Error(`Unknown error getting current block number on ${chainConfig.name} (Chain ID: ${chainId})`);
    }
}
//# sourceMappingURL=block-reader.js.map