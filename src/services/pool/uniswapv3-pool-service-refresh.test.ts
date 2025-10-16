/**
 * Tests for UniswapV3PoolService.refreshState()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import type { PublicClient } from 'viem';
import { UniswapV3PoolService } from './uniswapv3-pool-service.js';
import { EvmConfig } from '../../config/evm.js';
import type { UniswapV3Pool, UniswapV3PoolState } from '../../shared/types/uniswapv3/pool.js';
import { USDC_WETH_500_ETHEREUM } from './test-fixtures.js';
import { PoolStateError } from '../../utils/uniswapv3/pool-reader.js';

// Mock the pool-reader module
vi.mock('../../utils/uniswapv3/pool-reader.js', () => ({
  readPoolState: vi.fn(),
  PoolStateError: class PoolStateError extends Error {
    constructor(
      message: string,
      public readonly address: string,
      public override readonly cause?: unknown
    ) {
      super(message);
      this.name = 'PoolStateError';
    }
  },
}));

// Import mocked function
import { readPoolState } from '../../utils/uniswapv3/pool-reader.js';

describe('UniswapV3PoolService.refreshState()', () => {
  let prismaMock: DeepMockProxy<PrismaClient>;
  let evmConfigMock: DeepMockProxy<EvmConfig>;
  let publicClientMock: DeepMockProxy<PublicClient>;
  let service: UniswapV3PoolService;

  // Test pool from fixtures
  const testPool: UniswapV3Pool = {
    id: 'pool_usdc_weth_500_eth_001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    protocol: 'uniswapv3',
    poolType: 'CL_TICKS',
    token0: USDC_WETH_500_ETHEREUM.input.token0,
    token1: USDC_WETH_500_ETHEREUM.input.token1,
    feeBps: 500,
    config: USDC_WETH_500_ETHEREUM.input.config,
    state: USDC_WETH_500_ETHEREUM.input.state,
  };

  // New state from on-chain
  const newOnChainState: UniswapV3PoolState = {
    sqrtPriceX96: BigInt('1461446703485210103287273052203988822378723970999'),
    currentTick: -197310,
    liquidity: BigInt('27831485581196817999'),
    feeGrowthGlobal0: BigInt('123456789012345678901234567890'),
    feeGrowthGlobal1: BigInt('987654321098765432109876543210'),
  };

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    evmConfigMock = mockDeep<EvmConfig>();
    publicClientMock = mockDeep<PublicClient>();

    service = new UniswapV3PoolService({
      prisma: prismaMock,
      evmConfig: evmConfigMock as unknown as EvmConfig,
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('successful state refresh', () => {
    it('should fetch on-chain state and update database', async () => {
      // Mock findById to return test pool
      prismaMock.pool.findUnique.mockResolvedValue({
        id: testPool.id,
        createdAt: testPool.createdAt,
        updatedAt: testPool.updatedAt,
        protocol: testPool.protocol,
        poolType: testPool.poolType,
        token0Id: testPool.token0.id,
        token1Id: testPool.token1.id,
        feeBps: testPool.feeBps,
        config: testPool.config as object,
        state: {
          sqrtPriceX96: testPool.state.sqrtPriceX96.toString(),
          currentTick: testPool.state.currentTick,
          liquidity: testPool.state.liquidity.toString(),
          feeGrowthGlobal0: testPool.state.feeGrowthGlobal0.toString(),
          feeGrowthGlobal1: testPool.state.feeGrowthGlobal1.toString(),
        },
        token0: {
          id: testPool.token0.id,
          createdAt: testPool.token0.createdAt,
          updatedAt: testPool.token0.updatedAt,
          tokenType: testPool.token0.tokenType,
          name: testPool.token0.name,
          symbol: testPool.token0.symbol,
          decimals: testPool.token0.decimals,
          logoUrl: testPool.token0.logoUrl ?? null,
          coingeckoId: testPool.token0.coingeckoId ?? null,
          marketCap: testPool.token0.marketCap ?? null,
          config: testPool.token0.config as object,
        },
        token1: {
          id: testPool.token1.id,
          createdAt: testPool.token1.createdAt,
          updatedAt: testPool.token1.updatedAt,
          tokenType: testPool.token1.tokenType,
          name: testPool.token1.name,
          symbol: testPool.token1.symbol,
          decimals: testPool.token1.decimals,
          logoUrl: testPool.token1.logoUrl ?? null,
          coingeckoId: testPool.token1.coingeckoId ?? null,
          marketCap: testPool.token1.marketCap ?? null,
          config: testPool.token1.config as object,
        },
      });

      // Mock getPublicClient
      evmConfigMock.getPublicClient.mockReturnValue(
        publicClientMock as unknown as PublicClient
      );

      // Mock readPoolState
      vi.mocked(readPoolState).mockResolvedValue(newOnChainState);

      // Mock update
      prismaMock.pool.update.mockResolvedValue({
        id: testPool.id,
        createdAt: testPool.createdAt,
        updatedAt: new Date('2024-01-02'),
        protocol: testPool.protocol,
        poolType: testPool.poolType,
        token0Id: testPool.token0.id,
        token1Id: testPool.token1.id,
        feeBps: testPool.feeBps,
        config: testPool.config as object,
        state: {
          sqrtPriceX96: newOnChainState.sqrtPriceX96.toString(),
          currentTick: newOnChainState.currentTick,
          liquidity: newOnChainState.liquidity.toString(),
          feeGrowthGlobal0: newOnChainState.feeGrowthGlobal0.toString(),
          feeGrowthGlobal1: newOnChainState.feeGrowthGlobal1.toString(),
        },
        token0: {
          id: testPool.token0.id,
          createdAt: testPool.token0.createdAt,
          updatedAt: testPool.token0.updatedAt,
          tokenType: testPool.token0.tokenType,
          name: testPool.token0.name,
          symbol: testPool.token0.symbol,
          decimals: testPool.token0.decimals,
          logoUrl: testPool.token0.logoUrl ?? null,
          coingeckoId: testPool.token0.coingeckoId ?? null,
          marketCap: testPool.token0.marketCap ?? null,
          config: testPool.token0.config as object,
        },
        token1: {
          id: testPool.token1.id,
          createdAt: testPool.token1.createdAt,
          updatedAt: testPool.token1.updatedAt,
          tokenType: testPool.token1.tokenType,
          name: testPool.token1.name,
          symbol: testPool.token1.symbol,
          decimals: testPool.token1.decimals,
          logoUrl: testPool.token1.logoUrl ?? null,
          coingeckoId: testPool.token1.coingeckoId ?? null,
          marketCap: testPool.token1.marketCap ?? null,
          config: testPool.token1.config as object,
        },
      });

      // Execute
      const result = await service.refreshState(testPool.id);

      // Assertions
      expect(result).toEqual(newOnChainState);
      expect(evmConfigMock.getPublicClient).toHaveBeenCalledWith(1);
      expect(readPoolState).toHaveBeenCalledWith(
        publicClientMock,
        testPool.config.address
      );
      expect(prismaMock.pool.update).toHaveBeenCalledWith({
        where: { id: testPool.id },
        data: {
          state: {
            sqrtPriceX96: newOnChainState.sqrtPriceX96.toString(),
            currentTick: newOnChainState.currentTick,
            liquidity: newOnChainState.liquidity.toString(),
            feeGrowthGlobal0: newOnChainState.feeGrowthGlobal0.toString(),
            feeGrowthGlobal1: newOnChainState.feeGrowthGlobal1.toString(),
          },
        },
        include: {
          token0: true,
          token1: true,
        },
      });
    });
  });

  describe('error handling', () => {
    it('should throw error if pool not found', async () => {
      // Mock findById to return null
      prismaMock.pool.findUnique.mockResolvedValue(null);

      // Execute and expect error
      await expect(service.refreshState('nonexistent_pool')).rejects.toThrow(
        'Pool with id nonexistent_pool not found'
      );

      // Verify no RPC call was made
      expect(evmConfigMock.getPublicClient).not.toHaveBeenCalled();
      expect(readPoolState).not.toHaveBeenCalled();
    });

    it('should throw error if chain not supported', async () => {
      // Mock findById to return test pool
      prismaMock.pool.findUnique.mockResolvedValue({
        id: testPool.id,
        createdAt: testPool.createdAt,
        updatedAt: testPool.updatedAt,
        protocol: testPool.protocol,
        poolType: testPool.poolType,
        token0Id: testPool.token0.id,
        token1Id: testPool.token1.id,
        feeBps: testPool.feeBps,
        config: testPool.config as object,
        state: {
          sqrtPriceX96: testPool.state.sqrtPriceX96.toString(),
          currentTick: testPool.state.currentTick,
          liquidity: testPool.state.liquidity.toString(),
          feeGrowthGlobal0: testPool.state.feeGrowthGlobal0.toString(),
          feeGrowthGlobal1: testPool.state.feeGrowthGlobal1.toString(),
        },
        token0: {
          id: testPool.token0.id,
          createdAt: testPool.token0.createdAt,
          updatedAt: testPool.token0.updatedAt,
          tokenType: testPool.token0.tokenType,
          name: testPool.token0.name,
          symbol: testPool.token0.symbol,
          decimals: testPool.token0.decimals,
          logoUrl: testPool.token0.logoUrl ?? null,
          coingeckoId: testPool.token0.coingeckoId ?? null,
          marketCap: testPool.token0.marketCap ?? null,
          config: testPool.token0.config as object,
        },
        token1: {
          id: testPool.token1.id,
          createdAt: testPool.token1.createdAt,
          updatedAt: testPool.token1.updatedAt,
          tokenType: testPool.token1.tokenType,
          name: testPool.token1.name,
          symbol: testPool.token1.symbol,
          decimals: testPool.token1.decimals,
          logoUrl: testPool.token1.logoUrl ?? null,
          coingeckoId: testPool.token1.coingeckoId ?? null,
          marketCap: testPool.token1.marketCap ?? null,
          config: testPool.token1.config as object,
        },
      });

      // Mock getPublicClient to throw error
      evmConfigMock.getPublicClient.mockImplementation(() => {
        throw new Error('Chain 1 is not configured');
      });

      // Execute and expect error
      await expect(service.refreshState(testPool.id)).rejects.toThrow(
        'Failed to get RPC client for chain 1'
      );

      // Verify readPoolState was not called
      expect(readPoolState).not.toHaveBeenCalled();
    });

    it('should throw PoolStateError if on-chain read fails', async () => {
      // Mock findById to return test pool
      prismaMock.pool.findUnique.mockResolvedValue({
        id: testPool.id,
        createdAt: testPool.createdAt,
        updatedAt: testPool.updatedAt,
        protocol: testPool.protocol,
        poolType: testPool.poolType,
        token0Id: testPool.token0.id,
        token1Id: testPool.token1.id,
        feeBps: testPool.feeBps,
        config: testPool.config as object,
        state: {
          sqrtPriceX96: testPool.state.sqrtPriceX96.toString(),
          currentTick: testPool.state.currentTick,
          liquidity: testPool.state.liquidity.toString(),
          feeGrowthGlobal0: testPool.state.feeGrowthGlobal0.toString(),
          feeGrowthGlobal1: testPool.state.feeGrowthGlobal1.toString(),
        },
        token0: {
          id: testPool.token0.id,
          createdAt: testPool.token0.createdAt,
          updatedAt: testPool.token0.updatedAt,
          tokenType: testPool.token0.tokenType,
          name: testPool.token0.name,
          symbol: testPool.token0.symbol,
          decimals: testPool.token0.decimals,
          logoUrl: testPool.token0.logoUrl ?? null,
          coingeckoId: testPool.token0.coingeckoId ?? null,
          marketCap: testPool.token0.marketCap ?? null,
          config: testPool.token0.config as object,
        },
        token1: {
          id: testPool.token1.id,
          createdAt: testPool.token1.createdAt,
          updatedAt: testPool.token1.updatedAt,
          tokenType: testPool.token1.tokenType,
          name: testPool.token1.name,
          symbol: testPool.token1.symbol,
          decimals: testPool.token1.decimals,
          logoUrl: testPool.token1.logoUrl ?? null,
          coingeckoId: testPool.token1.coingeckoId ?? null,
          marketCap: testPool.token1.marketCap ?? null,
          config: testPool.token1.config as object,
        },
      });

      // Mock getPublicClient
      evmConfigMock.getPublicClient.mockReturnValue(
        publicClientMock as unknown as PublicClient
      );

      // Mock readPoolState to throw PoolStateError
      const poolStateError = new PoolStateError(
        'Pool contract returned invalid slot0 data',
        testPool.config.address
      );
      vi.mocked(readPoolState).mockRejectedValue(poolStateError);

      // Execute and expect error
      await expect(service.refreshState(testPool.id)).rejects.toThrow(
        PoolStateError
      );

      // Verify update was not called
      expect(prismaMock.pool.update).not.toHaveBeenCalled();
    });

    it('should wrap generic RPC errors', async () => {
      // Mock findById to return test pool
      prismaMock.pool.findUnique.mockResolvedValue({
        id: testPool.id,
        createdAt: testPool.createdAt,
        updatedAt: testPool.updatedAt,
        protocol: testPool.protocol,
        poolType: testPool.poolType,
        token0Id: testPool.token0.id,
        token1Id: testPool.token1.id,
        feeBps: testPool.feeBps,
        config: testPool.config as object,
        state: {
          sqrtPriceX96: testPool.state.sqrtPriceX96.toString(),
          currentTick: testPool.state.currentTick,
          liquidity: testPool.state.liquidity.toString(),
          feeGrowthGlobal0: testPool.state.feeGrowthGlobal0.toString(),
          feeGrowthGlobal1: testPool.state.feeGrowthGlobal1.toString(),
        },
        token0: {
          id: testPool.token0.id,
          createdAt: testPool.token0.createdAt,
          updatedAt: testPool.token0.updatedAt,
          tokenType: testPool.token0.tokenType,
          name: testPool.token0.name,
          symbol: testPool.token0.symbol,
          decimals: testPool.token0.decimals,
          logoUrl: testPool.token0.logoUrl ?? null,
          coingeckoId: testPool.token0.coingeckoId ?? null,
          marketCap: testPool.token0.marketCap ?? null,
          config: testPool.token0.config as object,
        },
        token1: {
          id: testPool.token1.id,
          createdAt: testPool.token1.createdAt,
          updatedAt: testPool.token1.updatedAt,
          tokenType: testPool.token1.tokenType,
          name: testPool.token1.name,
          symbol: testPool.token1.symbol,
          decimals: testPool.token1.decimals,
          logoUrl: testPool.token1.logoUrl ?? null,
          coingeckoId: testPool.token1.coingeckoId ?? null,
          marketCap: testPool.token1.marketCap ?? null,
          config: testPool.token1.config as object,
        },
      });

      // Mock getPublicClient
      evmConfigMock.getPublicClient.mockReturnValue(
        publicClientMock as unknown as PublicClient
      );

      // Mock readPoolState to throw generic error
      vi.mocked(readPoolState).mockRejectedValue(
        new Error('Network timeout')
      );

      // Execute and expect error
      await expect(service.refreshState(testPool.id)).rejects.toThrow(
        'Failed to read pool state: Network timeout'
      );

      // Verify update was not called
      expect(prismaMock.pool.update).not.toHaveBeenCalled();
    });
  });
});
