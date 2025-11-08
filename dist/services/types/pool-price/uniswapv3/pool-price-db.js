export function parseUniswapV3PoolPriceState(stateDB) {
    return {
        sqrtPriceX96: BigInt(stateDB.sqrtPriceX96),
        tick: stateDB.tick,
    };
}
export function serializeUniswapV3PoolPriceState(state) {
    return {
        sqrtPriceX96: state.sqrtPriceX96.toString(),
        tick: state.tick,
    };
}
export function parseUniswapV3PoolPriceConfig(configDB) {
    return configDB;
}
export function serializeUniswapV3PoolPriceConfig(config) {
    return config;
}
//# sourceMappingURL=pool-price-db.js.map