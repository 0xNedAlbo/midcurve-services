/**
 * Integration tests for UniswapV3PoolPriceService
 * Tests against real PostgreSQL database and Arbitrum RPC endpoints
 *
 * These tests verify:
 * - Pool price discovery from historical on-chain data
 * - CRUD operations with database persistence
 * - BigInt serialization/deserialization
 * - Idempotent discovery (same block twice)
 * - Time-range queries with real historical data
 * - Error handling (invalid blocks, unsupported chains, etc.)
 *
 * Pool Used:
 * - WETH/USDC 0.05% on Arbitrum
 * - Address: 0xC6962004f452bE9203591991D15f6b388e09E8D0
 * - WETH (token0): 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
 * - USDC (token1): 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
 */

import { describe, expect, it, beforeEach, afterAll, beforeAll } from 'vitest';
import { UniswapV3PoolPriceService } from './uniswapv3-pool-price-service.js';
import { UniswapV3PoolService } from '../pool/uniswapv3-pool-service.js';
import { Erc20TokenService } from '../token/erc20-token-service.js';
import { EvmConfig } from '../../config/evm.js';
import {
  getPrismaClient,
  disconnectPrisma,
} from '../../test/helpers.js';
import {
  REAL_ARBITRUM_EARLY_2024,
  REAL_ARBITRUM_MID_2024,
  REAL_ARBITRUM_LATE_2024,
} from './test-fixtures.js';

describe('UniswapV3PoolPriceService - Integration Tests', () => {
  let poolPriceService: UniswapV3PoolPriceService;
  let poolService: UniswapV3PoolService;
  let tokenService: Erc20TokenService;
  let evmConfig: EvmConfig;
  const prisma = getPrismaClient();

  // Real Arbitrum pool
  const WETH_USDC_POOL = {
    address: '0xC6962004f452bE9203591991D15f6b388e09E8D0',
    chainId: 42161, // Arbitrum
  };

  // Track created pool for cleanup
  let createdPoolId: string | null = null;

  beforeAll(async () => {
    // Initialize services
    evmConfig = EvmConfig.getInstance();
    tokenService = new Erc20TokenService({ prisma });
    poolService = new UniswapV3PoolService({
      prisma,
      evmConfig,
      erc20TokenService: tokenService,
    });
    poolPriceService = new UniswapV3PoolPriceService({
      prisma,
      evmConfig,
    });

    // Clean up any existing test data
    await prisma.poolPrice.deleteMany({
      where: { poolId: { contains: 'pool_weth_usdc_arb' } },
    });
    await prisma.pool.deleteMany({
      where: {
        config: {
          path: ['address'],
          equals: WETH_USDC_POOL.address,
        },
      },
    });

    // Discover the pool first (needed for all pool price tests)
    const pool = await poolService.discover({
      poolAddress: WETH_USDC_POOL.address,
      chainId: WETH_USDC_POOL.chainId,
    });
    createdPoolId = pool.id;
    console.log(`✓ Pool discovered: ${createdPoolId}`);
  }, 60000); // Increase timeout for pool discovery

  afterAll(async () => {
    // Clean up test data only if pool was created
    if (createdPoolId) {
      try {
        // Delete pool prices first
        await prisma.poolPrice.deleteMany({
          where: { poolId: createdPoolId },
        });

        // Delete pool
        await prisma.pool.delete({
          where: { id: createdPoolId },
        });

        console.log(`✓ Cleaned up pool: ${createdPoolId}`);
      } catch (error) {
        // Ignore if already deleted or doesn't exist
        console.log(`ℹ Pool cleanup skipped (may have been deleted already)`);
      }
    }

    await disconnectPrisma();
  });

  // ==========================================================================
  // discover() Tests with Real On-Chain Data
  // ==========================================================================

  describe('discover() - Real Historical Blocks', () => {
    it('should discover pool price at block 150,000,000 (Nov 2023)', async () => {
      const blockNumber = REAL_ARBITRUM_EARLY_2024.input.config.blockNumber;

      // Discover pool price from blockchain
      const poolPrice = await poolPriceService.discover(createdPoolId!, {
        blockNumber,
      });

      // Verify basic fields
      expect(poolPrice.id).toBeDefined();
      expect(poolPrice.protocol).toBe('uniswapv3');
      expect(poolPrice.poolId).toBe(createdPoolId);

      // Verify config
      expect(poolPrice.config.blockNumber).toBe(blockNumber);
      expect(poolPrice.config.blockTimestamp).toBe(
        REAL_ARBITRUM_EARLY_2024.input.config.blockTimestamp
      );

      // Verify state (real on-chain data)
      expect(poolPrice.state.sqrtPriceX96).toBe(
        REAL_ARBITRUM_EARLY_2024.input.state.sqrtPriceX96
      );
      expect(poolPrice.state.tick).toBe(
        REAL_ARBITRUM_EARLY_2024.input.state.tick
      );

      // Verify prices
      expect(poolPrice.token1PricePerToken0).toBe(
        REAL_ARBITRUM_EARLY_2024.input.token1PricePerToken0
      );
      expect(poolPrice.token0PricePerToken1).toBe(
        REAL_ARBITRUM_EARLY_2024.input.token0PricePerToken1
      );

      // Verify timestamp
      expect(poolPrice.timestamp.getTime()).toBe(
        REAL_ARBITRUM_EARLY_2024.input.timestamp.getTime()
      );

      console.log(`✓ Block ${blockNumber}: 1 WETH = ${Number(poolPrice.token1PricePerToken0) / 1e6} USDC`);
    }, 30000); // Increase timeout for RPC calls

    it('should discover pool price at block 175,000,000 (Jan 2024)', async () => {
      const blockNumber = REAL_ARBITRUM_MID_2024.input.config.blockNumber;

      const poolPrice = await poolPriceService.discover(createdPoolId!, {
        blockNumber,
      });

      // Verify real on-chain data
      expect(poolPrice.state.sqrtPriceX96).toBe(
        REAL_ARBITRUM_MID_2024.input.state.sqrtPriceX96
      );
      expect(poolPrice.state.tick).toBe(
        REAL_ARBITRUM_MID_2024.input.state.tick
      );
      expect(poolPrice.token1PricePerToken0).toBe(
        REAL_ARBITRUM_MID_2024.input.token1PricePerToken0
      );

      console.log(`✓ Block ${blockNumber}: 1 WETH = ${Number(poolPrice.token1PricePerToken0) / 1e6} USDC`);
    }, 30000);

    it('should discover pool price at block 200,000,000 (Apr 2024)', async () => {
      const blockNumber = REAL_ARBITRUM_LATE_2024.input.config.blockNumber;

      const poolPrice = await poolPriceService.discover(createdPoolId!, {
        blockNumber,
      });

      // Verify real on-chain data
      expect(poolPrice.state.sqrtPriceX96).toBe(
        REAL_ARBITRUM_LATE_2024.input.state.sqrtPriceX96
      );
      expect(poolPrice.state.tick).toBe(
        REAL_ARBITRUM_LATE_2024.input.state.tick
      );
      expect(poolPrice.token1PricePerToken0).toBe(
        REAL_ARBITRUM_LATE_2024.input.token1PricePerToken0
      );

      console.log(`✓ Block ${blockNumber}: 1 WETH = ${Number(poolPrice.token1PricePerToken0) / 1e6} USDC`);
    }, 30000);

    it('should be idempotent - return existing price if already discovered', async () => {
      const blockNumber = REAL_ARBITRUM_EARLY_2024.input.config.blockNumber;

      // First discovery (should already exist from previous test)
      const poolPrice1 = await poolPriceService.discover(createdPoolId!, {
        blockNumber,
      });

      // Second discovery - should return same record
      const poolPrice2 = await poolPriceService.discover(createdPoolId!, {
        blockNumber,
      });

      // Should be the same record
      expect(poolPrice1.id).toBe(poolPrice2.id);
      expect(poolPrice1.createdAt.getTime()).toBe(poolPrice2.createdAt.getTime());

      console.log(`✓ Idempotent: Same price ID returned (${poolPrice1.id})`);
    }, 30000);

    it('should store multiple historical prices for same pool', async () => {
      // All three blocks should now be discovered
      const allPrices = await poolPriceService.findByPoolId(createdPoolId!);

      // Should have at least 3 prices (may have more if tests run multiple times)
      expect(allPrices.length).toBeGreaterThanOrEqual(3);

      // Verify they're ordered by timestamp descending (newest first)
      for (let i = 0; i < allPrices.length - 1; i++) {
        expect(allPrices[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          allPrices[i + 1].timestamp.getTime()
        );
      }

      console.log(`✓ Found ${allPrices.length} historical prices for pool`);
    });
  });

  // ==========================================================================
  // Time-Range Queries with Real Data
  // ==========================================================================

  describe('findByPoolIdAndTimeRange() - Real Historical Data', () => {
    it('should find prices within time range', async () => {
      const startTime = new Date('2023-11-01T00:00:00Z'); // Before first block
      const endTime = new Date('2024-02-01T00:00:00Z'); // Between first and second block

      const prices = await poolPriceService.findByPoolIdAndTimeRange(
        createdPoolId!,
        startTime,
        endTime
      );

      // Should find at least the first and second historical snapshots
      expect(prices.length).toBeGreaterThanOrEqual(2);

      // Verify they're ordered by timestamp ascending (oldest first)
      for (let i = 0; i < prices.length - 1; i++) {
        expect(prices[i].timestamp.getTime()).toBeLessThanOrEqual(
          prices[i + 1].timestamp.getTime()
        );
      }

      // Verify all prices are within range
      for (const price of prices) {
        expect(price.timestamp.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
        expect(price.timestamp.getTime()).toBeLessThanOrEqual(endTime.getTime());
      }

      console.log(`✓ Found ${prices.length} prices in range ${startTime.toISOString()} to ${endTime.toISOString()}`);
    });

    it('should return empty array for time range with no prices', async () => {
      const startTime = new Date('2020-01-01T00:00:00Z');
      const endTime = new Date('2020-12-31T23:59:59Z');

      const prices = await poolPriceService.findByPoolIdAndTimeRange(
        createdPoolId!,
        startTime,
        endTime
      );

      expect(prices).toHaveLength(0);
    });

    it('should find all prices with wide time range', async () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const endTime = new Date('2025-01-01T00:00:00Z');

      const prices = await poolPriceService.findByPoolIdAndTimeRange(
        createdPoolId!,
        startTime,
        endTime
      );

      // Should find all 3 historical snapshots
      expect(prices.length).toBeGreaterThanOrEqual(3);

      console.log(`✓ Found all ${prices.length} historical prices`);
    });
  });

  // ==========================================================================
  // BigInt Serialization/Deserialization
  // ==========================================================================

  describe('BigInt Handling', () => {
    it('should correctly serialize and deserialize bigint values', async () => {
      const blockNumber = REAL_ARBITRUM_EARLY_2024.input.config.blockNumber;

      // Fetch from database
      const poolPrice = await poolPriceService.findById(
        (await poolPriceService.discover(createdPoolId!, { blockNumber })).id
      );

      expect(poolPrice).not.toBeNull();

      // Verify bigint types
      expect(typeof poolPrice!.state.sqrtPriceX96).toBe('bigint');
      expect(typeof poolPrice!.token1PricePerToken0).toBe('bigint');
      expect(typeof poolPrice!.token0PricePerToken1).toBe('bigint');

      // Verify values match expected
      expect(poolPrice!.state.sqrtPriceX96).toBe(
        REAL_ARBITRUM_EARLY_2024.input.state.sqrtPriceX96
      );
    });

    it('should handle very large sqrtPriceX96 values', async () => {
      const blockNumber = REAL_ARBITRUM_MID_2024.input.config.blockNumber;

      const poolPrice = await poolPriceService.discover(createdPoolId!, {
        blockNumber,
      });

      // sqrtPriceX96 is a very large number (Q96.96 format)
      expect(poolPrice.state.sqrtPriceX96).toBeGreaterThan(0n);
      expect(poolPrice.state.sqrtPriceX96.toString().length).toBeGreaterThan(15);

      console.log(`✓ sqrtPriceX96: ${poolPrice.state.sqrtPriceX96} (${poolPrice.state.sqrtPriceX96.toString().length} digits)`);
    }, 30000);
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should throw error for non-existent pool', async () => {
      await expect(
        poolPriceService.discover('non_existent_pool_id', { blockNumber: 150000000 })
      ).rejects.toThrow('Pool not found');
    });

    it('should throw error for invalid block number (too low)', async () => {
      // Block 1000 is way before this pool existed
      await expect(
        poolPriceService.discover(createdPoolId!, { blockNumber: 1000 })
      ).rejects.toThrow();
    }, 30000);
  });

  // ==========================================================================
  // Database Persistence
  // ==========================================================================

  describe('Database Persistence', () => {
    it('should persist pool price to database', async () => {
      const blockNumber = REAL_ARBITRUM_LATE_2024.input.config.blockNumber;

      const poolPrice = await poolPriceService.discover(createdPoolId!, {
        blockNumber,
      });

      // Verify it's in the database by fetching directly
      const fromDb = await prisma.poolPrice.findUnique({
        where: { id: poolPrice.id },
      });

      expect(fromDb).not.toBeNull();
      expect(fromDb!.protocol).toBe('uniswapv3');
      expect(fromDb!.poolId).toBe(createdPoolId);

      // Verify bigint stored as string in DB
      expect(typeof fromDb!.token1PricePerToken0).toBe('string');
      expect(BigInt(fromDb!.token1PricePerToken0)).toBe(poolPrice.token1PricePerToken0);
    }, 30000);

    it('should delete pool price from database', async () => {
      const blockNumber = REAL_ARBITRUM_MID_2024.input.config.blockNumber;

      const poolPrice = await poolPriceService.discover(createdPoolId!, {
        blockNumber,
      });

      // Delete it
      await poolPriceService.delete(poolPrice.id);

      // Verify it's gone
      const found = await poolPriceService.findById(poolPrice.id);
      expect(found).toBeNull();

      // Re-create for other tests
      await poolPriceService.discover(createdPoolId!, { blockNumber });
    }, 30000);
  });
});
