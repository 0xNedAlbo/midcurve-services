import { createPublicClient, http } from 'viem';
import { mainnet, arbitrum, base, bsc, polygon, optimism, } from 'viem/chains';
export var SupportedChainId;
(function (SupportedChainId) {
    SupportedChainId[SupportedChainId["ETHEREUM"] = 1] = "ETHEREUM";
    SupportedChainId[SupportedChainId["ARBITRUM"] = 42161] = "ARBITRUM";
    SupportedChainId[SupportedChainId["BASE"] = 8453] = "BASE";
    SupportedChainId[SupportedChainId["BSC"] = 56] = "BSC";
    SupportedChainId[SupportedChainId["POLYGON"] = 137] = "POLYGON";
    SupportedChainId[SupportedChainId["OPTIMISM"] = 10] = "OPTIMISM";
})(SupportedChainId || (SupportedChainId = {}));
const INVALID_RPC_SENTINEL = '-INVALID-';
export class EvmConfig {
    static instance = null;
    chains;
    clients;
    constructor() {
        this.chains = new Map();
        this.clients = new Map();
        this.initializeChains();
    }
    static getInstance() {
        if (!EvmConfig.instance) {
            EvmConfig.instance = new EvmConfig();
        }
        return EvmConfig.instance;
    }
    static resetInstance() {
        EvmConfig.instance = null;
    }
    initializeChains() {
        const env = process.env;
        this.chains.set(SupportedChainId.ETHEREUM, {
            chainId: SupportedChainId.ETHEREUM,
            name: 'Ethereum',
            rpcUrl: env['RPC_URL_ETHEREUM'] ?? INVALID_RPC_SENTINEL,
            blockExplorer: 'https://etherscan.io',
            viemChain: mainnet,
            finality: { type: 'blockTag' },
        });
        this.chains.set(SupportedChainId.ARBITRUM, {
            chainId: SupportedChainId.ARBITRUM,
            name: 'Arbitrum One',
            rpcUrl: env['RPC_URL_ARBITRUM'] ?? INVALID_RPC_SENTINEL,
            blockExplorer: 'https://arbiscan.io',
            viemChain: arbitrum,
            finality: { type: 'blockTag' },
        });
        this.chains.set(SupportedChainId.BASE, {
            chainId: SupportedChainId.BASE,
            name: 'Base',
            rpcUrl: env['RPC_URL_BASE'] ?? INVALID_RPC_SENTINEL,
            blockExplorer: 'https://basescan.org',
            viemChain: base,
            finality: { type: 'blockTag' },
        });
        this.chains.set(SupportedChainId.BSC, {
            chainId: SupportedChainId.BSC,
            name: 'BNB Smart Chain',
            rpcUrl: env['RPC_URL_BSC'] ?? INVALID_RPC_SENTINEL,
            blockExplorer: 'https://bscscan.com',
            viemChain: bsc,
            finality: { type: 'blockTag' },
        });
        this.chains.set(SupportedChainId.POLYGON, {
            chainId: SupportedChainId.POLYGON,
            name: 'Polygon',
            rpcUrl: env['RPC_URL_POLYGON'] ?? INVALID_RPC_SENTINEL,
            blockExplorer: 'https://polygonscan.com',
            viemChain: polygon,
            finality: { type: 'blockTag' },
        });
        this.chains.set(SupportedChainId.OPTIMISM, {
            chainId: SupportedChainId.OPTIMISM,
            name: 'Optimism',
            rpcUrl: env['RPC_URL_OPTIMISM'] ?? INVALID_RPC_SENTINEL,
            blockExplorer: 'https://optimistic.etherscan.io',
            viemChain: optimism,
            finality: { type: 'blockTag' },
        });
    }
    getEnvVarNameForChain(chainId) {
        const envVarMap = {
            [SupportedChainId.ETHEREUM]: 'RPC_URL_ETHEREUM',
            [SupportedChainId.ARBITRUM]: 'RPC_URL_ARBITRUM',
            [SupportedChainId.BASE]: 'RPC_URL_BASE',
            [SupportedChainId.BSC]: 'RPC_URL_BSC',
            [SupportedChainId.POLYGON]: 'RPC_URL_POLYGON',
            [SupportedChainId.OPTIMISM]: 'RPC_URL_OPTIMISM',
        };
        return envVarMap[chainId] ?? `RPC_URL_UNKNOWN_${chainId}`;
    }
    getChainConfig(chainId) {
        const config = this.chains.get(chainId);
        if (!config) {
            throw new Error(`Chain ${chainId} is not configured. Supported chains: ${Array.from(this.chains.keys()).join(', ')}`);
        }
        if (config.rpcUrl === INVALID_RPC_SENTINEL) {
            const envVarName = this.getEnvVarNameForChain(chainId);
            throw new Error(`RPC URL not configured for ${config.name} (Chain ID: ${chainId}).\n\n` +
                `The environment variable '${envVarName}' is not set.\n\n` +
                `To fix this:\n` +
                `1. Copy .env.example to .env in your project root\n` +
                `2. Set ${envVarName} to your RPC endpoint:\n` +
                `   ${envVarName}=https://your-rpc-provider.com/v2/YOUR_API_KEY\n\n` +
                `Example providers: Alchemy, Infura, QuickNode, or run your own node.\n\n` +
                `Note: Environment variables must be set before starting the application.`);
        }
        return config;
    }
    getPublicClient(chainId) {
        const cached = this.clients.get(chainId);
        if (cached) {
            return cached;
        }
        const config = this.getChainConfig(chainId);
        const client = createPublicClient({
            chain: config.viemChain,
            transport: http(config.rpcUrl),
        });
        this.clients.set(chainId, client);
        return client;
    }
    getSupportedChainIds() {
        return Array.from(this.chains.keys());
    }
    isChainSupported(chainId) {
        return this.chains.has(chainId);
    }
    getFinalityConfig(chainId) {
        const config = this.getChainConfig(chainId);
        return config.finality;
    }
}
export function getEvmConfig() {
    return EvmConfig.getInstance();
}
//# sourceMappingURL=evm.js.map