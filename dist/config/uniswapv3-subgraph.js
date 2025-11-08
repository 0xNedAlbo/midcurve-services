import { SupportedChainId } from "./evm.js";
export const UNISWAP_V3_SUBGRAPH_ENDPOINTS = {
    [SupportedChainId.ETHEREUM]: "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV",
    [SupportedChainId.ARBITRUM]: "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM",
    [SupportedChainId.BASE]: "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/HMuAwufqZ1YCRmzL2SfHTVkzZovC9VL2UAKhjvRqKiR1",
    [SupportedChainId.OPTIMISM]: "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/AUpZ47RTWDBpco7YTTffGyRkBJ2i26Ms8dQSkUdxPHGc",
    [SupportedChainId.POLYGON]: "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm",
};
function getTheGraphApiKey() {
    const apiKey = process.env.THE_GRAPH_API_KEY;
    if (!apiKey) {
        if (process.env.NODE_ENV === 'test') {
            return 'test-api-key-placeholder';
        }
        throw new Error(`The Graph API key not configured.\n\n` +
            `Please set the THE_GRAPH_API_KEY environment variable.\n` +
            `You can get an API key from: https://thegraph.com/studio/apikeys/\n\n` +
            `Example:\n` +
            `THE_GRAPH_API_KEY=your_api_key_here`);
    }
    return apiKey;
}
export function getUniswapV3SubgraphEndpoint(chainId) {
    const endpointTemplate = UNISWAP_V3_SUBGRAPH_ENDPOINTS[chainId];
    if (!endpointTemplate) {
        const supportedChains = Object.keys(UNISWAP_V3_SUBGRAPH_ENDPOINTS)
            .map(Number)
            .join(", ");
        throw new Error(`Uniswap V3 subgraph not available for chain ${chainId}. ` +
            `Supported chains: ${supportedChains}\n\n` +
            `If you believe this chain should have a subgraph, please check:\n` +
            `- https://docs.uniswap.org/api/subgraph/overview\n` +
            `- https://thegraph.com/explorer`);
    }
    const apiKey = getTheGraphApiKey();
    const endpoint = endpointTemplate.replace("[api-key]", apiKey);
    return endpoint;
}
export function isUniswapV3SubgraphSupported(chainId) {
    return chainId in UNISWAP_V3_SUBGRAPH_ENDPOINTS;
}
export function getSupportedUniswapV3SubgraphChains() {
    return Object.keys(UNISWAP_V3_SUBGRAPH_ENDPOINTS).map(Number);
}
//# sourceMappingURL=uniswapv3-subgraph.js.map