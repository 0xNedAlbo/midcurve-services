import { SupportedChainId } from "./evm.js";
export declare const UNISWAP_V3_SUBGRAPH_ENDPOINTS: Partial<Record<SupportedChainId, string>>;
export declare function getUniswapV3SubgraphEndpoint(chainId: number): string;
export declare function isUniswapV3SubgraphSupported(chainId: number): boolean;
export declare function getSupportedUniswapV3SubgraphChains(): number[];
//# sourceMappingURL=uniswapv3-subgraph.d.ts.map