export class UniswapV3SubgraphApiError extends Error {
    statusCode;
    graphqlErrors;
    constructor(message, statusCode, graphqlErrors) {
        super(message);
        this.statusCode = statusCode;
        this.graphqlErrors = graphqlErrors;
        this.name = 'UniswapV3SubgraphApiError';
    }
}
export class UniswapV3SubgraphUnavailableError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.name = 'UniswapV3SubgraphUnavailableError';
        this.cause = cause;
    }
}
export class PoolNotFoundInSubgraphError extends Error {
    chainId;
    poolAddress;
    constructor(chainId, poolAddress) {
        super(`Pool ${poolAddress} not found in Uniswap V3 subgraph for chain ${chainId}`);
        this.chainId = chainId;
        this.poolAddress = poolAddress;
        this.name = 'PoolNotFoundInSubgraphError';
    }
}
//# sourceMappingURL=types.js.map