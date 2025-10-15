/**
 * Test fixtures for pool service tests
 */

import type { Erc20Token } from '../../shared/types/token-config.js';
import type {
  UniswapV3PoolConfig,
  UniswapV3PoolState,
} from '../../shared/types/uniswapv3/pool.js';

// Token fixtures
export const USDC_ETHEREUM: Erc20Token = {
  id: 'token_usdc_eth_001',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  tokenType: 'evm-erc20',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  config: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
  },
};

export const WETH_ETHEREUM: Erc20Token = {
  id: 'token_weth_eth_001',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  tokenType: 'evm-erc20',
  name: 'Wrapped Ether',
  symbol: 'WETH',
  decimals: 18,
  config: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    chainId: 1,
  },
};

export const DAI_ETHEREUM: Erc20Token = {
  id: 'token_dai_eth_001',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  tokenType: 'evm-erc20',
  name: 'Dai Stablecoin',
  symbol: 'DAI',
  decimals: 18,
  config: {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    chainId: 1,
  },
};

export const USDC_ARBITRUM: Erc20Token = {
  id: 'token_usdc_arb_001',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  tokenType: 'evm-erc20',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  config: {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    chainId: 42161,
  },
};

export const WETH_ARBITRUM: Erc20Token = {
  id: 'token_weth_arb_001',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  tokenType: 'evm-erc20',
  name: 'Wrapped Ether',
  symbol: 'WETH',
  decimals: 18,
  config: {
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    chainId: 42161,
  },
};

// Pool fixtures
export const USDC_WETH_500_ETHEREUM = {
  input: {
    protocol: 'uniswapv3' as const,
    poolType: 'CL_TICKS' as const,
    token0: USDC_ETHEREUM,
    token1: WETH_ETHEREUM,
    feeBps: 500,
    config: {
      chainId: 1,
      address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0: USDC_ETHEREUM.config.address,
      token1: WETH_ETHEREUM.config.address,
      feeBps: 500,
      tickSpacing: 10,
    } as UniswapV3PoolConfig,
    state: {
      sqrtPriceX96: BigInt('1461446703485210103287273052203988822378723970341'),
      currentTick: -197312,
      liquidity: BigInt('2345678901234567890'),
      feeGrowthGlobal0: BigInt('123456789012345678901234567890'),
      feeGrowthGlobal1: BigInt('987654321098765432109876543210'),
    } as UniswapV3PoolState,
  },
  dbResult: {
    id: 'pool_usdc_weth_500_eth_001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    protocol: 'uniswapv3',
    poolType: 'CL_TICKS',
    token0Id: USDC_ETHEREUM.id,
    token1Id: WETH_ETHEREUM.id,
    feeBps: 500,
    config: {
      chainId: 1,
      address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0: USDC_ETHEREUM.config.address,
      token1: WETH_ETHEREUM.config.address,
      feeBps: 500,
      tickSpacing: 10,
    },
    state: {
      sqrtPriceX96: '1461446703485210103287273052203988822378723970341',
      currentTick: -197312,
      liquidity: '2345678901234567890',
      feeGrowthGlobal0: '123456789012345678901234567890',
      feeGrowthGlobal1: '987654321098765432109876543210',
    },
    token0: USDC_ETHEREUM,
    token1: WETH_ETHEREUM,
  },
  expected: {
    id: 'pool_usdc_weth_500_eth_001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    protocol: 'uniswapv3' as const,
    poolType: 'CL_TICKS' as const,
    token0: USDC_ETHEREUM,
    token1: WETH_ETHEREUM,
    feeBps: 500,
    config: {
      chainId: 1,
      address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0: USDC_ETHEREUM.config.address,
      token1: WETH_ETHEREUM.config.address,
      feeBps: 500,
      tickSpacing: 10,
    } as UniswapV3PoolConfig,
    state: {
      sqrtPriceX96: BigInt('1461446703485210103287273052203988822378723970341'),
      currentTick: -197312,
      liquidity: BigInt('2345678901234567890'),
      feeGrowthGlobal0: BigInt('123456789012345678901234567890'),
      feeGrowthGlobal1: BigInt('987654321098765432109876543210'),
    } as UniswapV3PoolState,
  },
};

export const USDC_WETH_3000_ETHEREUM = {
  input: {
    protocol: 'uniswapv3' as const,
    poolType: 'CL_TICKS' as const,
    token0: USDC_ETHEREUM,
    token1: WETH_ETHEREUM,
    feeBps: 3000,
    config: {
      chainId: 1,
      address: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8',
      token0: USDC_ETHEREUM.config.address,
      token1: WETH_ETHEREUM.config.address,
      feeBps: 3000,
      tickSpacing: 60,
    } as UniswapV3PoolConfig,
    state: {
      sqrtPriceX96: BigInt('1461446703485210103287273052203988822378723970341'),
      currentTick: -197312,
      liquidity: BigInt('9876543210987654321'),
      feeGrowthGlobal0: BigInt('111111111111111111111111111111'),
      feeGrowthGlobal1: BigInt('222222222222222222222222222222'),
    } as UniswapV3PoolState,
  },
  dbResult: {
    id: 'pool_usdc_weth_3000_eth_001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    protocol: 'uniswapv3',
    poolType: 'CL_TICKS',
    token0Id: USDC_ETHEREUM.id,
    token1Id: WETH_ETHEREUM.id,
    feeBps: 3000,
    config: {
      chainId: 1,
      address: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8',
      token0: USDC_ETHEREUM.config.address,
      token1: WETH_ETHEREUM.config.address,
      feeBps: 3000,
      tickSpacing: 60,
    },
    state: {
      sqrtPriceX96: '1461446703485210103287273052203988822378723970341',
      currentTick: -197312,
      liquidity: '9876543210987654321',
      feeGrowthGlobal0: '111111111111111111111111111111',
      feeGrowthGlobal1: '222222222222222222222222222222',
    },
    token0: USDC_ETHEREUM,
    token1: WETH_ETHEREUM,
  },
  expected: {
    id: 'pool_usdc_weth_3000_eth_001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    protocol: 'uniswapv3' as const,
    poolType: 'CL_TICKS' as const,
    token0: USDC_ETHEREUM,
    token1: WETH_ETHEREUM,
    feeBps: 3000,
    config: {
      chainId: 1,
      address: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8',
      token0: USDC_ETHEREUM.config.address,
      token1: WETH_ETHEREUM.config.address,
      feeBps: 3000,
      tickSpacing: 60,
    } as UniswapV3PoolConfig,
    state: {
      sqrtPriceX96: BigInt('1461446703485210103287273052203988822378723970341'),
      currentTick: -197312,
      liquidity: BigInt('9876543210987654321'),
      feeGrowthGlobal0: BigInt('111111111111111111111111111111'),
      feeGrowthGlobal1: BigInt('222222222222222222222222222222'),
    } as UniswapV3PoolState,
  },
};

export const DAI_USDC_100_ETHEREUM = {
  input: {
    protocol: 'uniswapv3' as const,
    poolType: 'CL_TICKS' as const,
    token0: DAI_ETHEREUM,
    token1: USDC_ETHEREUM,
    feeBps: 100,
    config: {
      chainId: 1,
      address: '0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168',
      token0: DAI_ETHEREUM.config.address,
      token1: USDC_ETHEREUM.config.address,
      feeBps: 100,
      tickSpacing: 1,
    } as UniswapV3PoolConfig,
    state: {
      sqrtPriceX96: BigInt('79228162514264337593543950336'),
      currentTick: 0,
      liquidity: BigInt('5555555555555555555'),
      feeGrowthGlobal0: BigInt('333333333333333333333333333333'),
      feeGrowthGlobal1: BigInt('444444444444444444444444444444'),
    } as UniswapV3PoolState,
  },
  dbResult: {
    id: 'pool_dai_usdc_100_eth_001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    protocol: 'uniswapv3',
    poolType: 'CL_TICKS',
    token0Id: DAI_ETHEREUM.id,
    token1Id: USDC_ETHEREUM.id,
    feeBps: 100,
    config: {
      chainId: 1,
      address: '0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168',
      token0: DAI_ETHEREUM.config.address,
      token1: USDC_ETHEREUM.config.address,
      feeBps: 100,
      tickSpacing: 1,
    },
    state: {
      sqrtPriceX96: '79228162514264337593543950336',
      currentTick: 0,
      liquidity: '5555555555555555555',
      feeGrowthGlobal0: '333333333333333333333333333333',
      feeGrowthGlobal1: '444444444444444444444444444444',
    },
    token0: DAI_ETHEREUM,
    token1: USDC_ETHEREUM,
  },
  expected: {
    id: 'pool_dai_usdc_100_eth_001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    protocol: 'uniswapv3' as const,
    poolType: 'CL_TICKS' as const,
    token0: DAI_ETHEREUM,
    token1: USDC_ETHEREUM,
    feeBps: 100,
    config: {
      chainId: 1,
      address: '0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168',
      token0: DAI_ETHEREUM.config.address,
      token1: USDC_ETHEREUM.config.address,
      feeBps: 100,
      tickSpacing: 1,
    } as UniswapV3PoolConfig,
    state: {
      sqrtPriceX96: BigInt('79228162514264337593543950336'),
      currentTick: 0,
      liquidity: BigInt('5555555555555555555'),
      feeGrowthGlobal0: BigInt('333333333333333333333333333333'),
      feeGrowthGlobal1: BigInt('444444444444444444444444444444'),
    } as UniswapV3PoolState,
  },
};

export const USDC_WETH_500_ARBITRUM = {
  input: {
    protocol: 'uniswapv3' as const,
    poolType: 'CL_TICKS' as const,
    token0: WETH_ARBITRUM,  // Note: WETH < USDC on Arbitrum 
    token1: USDC_ARBITRUM,
    feeBps: 500,
    config: {
      chainId: 42161,
      address: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443',
      token0: WETH_ARBITRUM.config.address,
      token1: USDC_ARBITRUM.config.address,
      feeBps: 500,
      tickSpacing: 10,
    } as UniswapV3PoolConfig,
    state: {
      sqrtPriceX96: BigInt('1461446703485210103287273052203988822378723970341'),
      currentTick: -197312,
      liquidity: BigInt('1111111111111111111'),
      feeGrowthGlobal0: BigInt('555555555555555555555555555555'),
      feeGrowthGlobal1: BigInt('666666666666666666666666666666'),
    } as UniswapV3PoolState,
  },
  dbResult: {
    id: 'pool_usdc_weth_500_arb_001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    protocol: 'uniswapv3',
    poolType: 'CL_TICKS',
    token0Id: WETH_ARBITRUM.id,
    token1Id: USDC_ARBITRUM.id,
    feeBps: 500,
    config: {
      chainId: 42161,
      address: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443',
      token0: WETH_ARBITRUM.config.address,
      token1: USDC_ARBITRUM.config.address,
      feeBps: 500,
      tickSpacing: 10,
    },
    state: {
      sqrtPriceX96: '1461446703485210103287273052203988822378723970341',
      currentTick: -197312,
      liquidity: '1111111111111111111',
      feeGrowthGlobal0: '555555555555555555555555555555',
      feeGrowthGlobal1: '666666666666666666666666666666',
    },
    token0: WETH_ARBITRUM,
    token1: USDC_ARBITRUM,
  },
  expected: {
    id: 'pool_usdc_weth_500_arb_001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    protocol: 'uniswapv3' as const,
    poolType: 'CL_TICKS' as const,
    token0: WETH_ARBITRUM,
    token1: USDC_ARBITRUM,
    feeBps: 500,
    config: {
      chainId: 42161,
      address: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443',
      token0: WETH_ARBITRUM.config.address,
      token1: USDC_ARBITRUM.config.address,
      feeBps: 500,
      tickSpacing: 10,
    } as UniswapV3PoolConfig,
    state: {
      sqrtPriceX96: BigInt('1461446703485210103287273052203988822378723970341'),
      currentTick: -197312,
      liquidity: BigInt('1111111111111111111'),
      feeGrowthGlobal0: BigInt('555555555555555555555555555555'),
      feeGrowthGlobal1: BigInt('666666666666666666666666666666'),
    } as UniswapV3PoolState,
  },
};
