export const POOL_METRICS_QUERY = `
  query GetPoolMetrics($poolId: ID!) {
    pools(where: {id: $poolId}) {
      id
      poolDayData(orderBy: date, orderDirection: desc, first: 1) {
        volumeUSD
        feesUSD
        tvlUSD
      }
    }
  }
`;
export const POOL_FEE_DATA_QUERY = `
  query GetPoolFeeData($poolId: ID!) {
    pools(where: {id: $poolId}) {
      id
      feeTier
      sqrtPrice
      liquidity
      token0 {
        id
        symbol
        decimals
      }
      token1 {
        id
        symbol
        decimals
      }
      poolDayData(orderBy: date, orderDirection: desc, first: 1) {
        date
        liquidity
        volumeToken0
        volumeToken1
        token0Price
        token1Price
        volumeUSD
        feesUSD
        tvlUSD
      }
    }
  }
`;
export const POOLS_BATCH_QUERY = `
  query GetPoolsBatch($poolIds: [ID!]!) {
    pools(where: {id_in: $poolIds}) {
      id
      feeTier
      liquidity
      sqrtPrice
      token0 {
        id
        symbol
        decimals
      }
      token1 {
        id
        symbol
        decimals
      }
      poolDayData(orderBy: date, orderDirection: desc, first: 1) {
        volumeUSD
        feesUSD
        tvlUSD
      }
    }
  }
`;
export const POOL_HISTORICAL_DATA_QUERY = `
  query GetPoolHistoricalData($poolId: ID!, $days: Int = 30) {
    poolDayDatas(
      where: {pool: $poolId}
      orderBy: date
      orderDirection: desc
      first: $days
    ) {
      date
      liquidity
      volumeUSD
      feesUSD
      tvlUSD
      token0Price
      token1Price
      volumeToken0
      volumeToken1
    }
  }
`;
export const POOL_CREATION_QUERY = `
  query GetPoolCreation($poolId: ID!) {
    pools(where: {id: $poolId}) {
      id
      createdAtTimestamp
      createdAtBlockNumber
    }
  }
`;
//# sourceMappingURL=queries.js.map