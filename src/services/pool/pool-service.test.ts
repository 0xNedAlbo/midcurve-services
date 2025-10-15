/**
 * Comprehensive tests for PoolService
 * Tests CRUD operations with mocked Prisma client
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  mockDeep,
  type DeepMockProxy,
} from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { PoolService } from './pool-service.js';
import {
  USDC_WETH_500_ETHEREUM,
  USDC_WETH_3000_ETHEREUM,
  DAI_USDC_100_ETHEREUM,
  USDC_WETH_500_ARBITRUM,
  WETH_ETHEREUM,
  USDC_ETHEREUM,
  DAI_ETHEREUM,
} from './test-fixtures.js';
import type { UniswapV3PoolState } from '../../shared/types/uniswapv3/pool.js';

describe('PoolService', () => {
  let prismaMock: DeepMockProxy<PrismaClient>;
  let poolService: PoolService;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    poolService = new PoolService({
      prisma: prismaMock as unknown as PrismaClient,
    });
  });

  // ==========================================================================
  // Constructor & Dependency Injection Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create instance with provided Prisma client', () => {
      const service = new PoolService({
        prisma: prismaMock as unknown as PrismaClient,
      });
      expect(service).toBeInstanceOf(PoolService);
    });

    it('should create instance with default Prisma client when not provided', () => {
      const service = new PoolService();
      expect(service).toBeInstanceOf(PoolService);
    });

    it('should accept empty dependencies object', () => {
      const service = new PoolService({});
      expect(service).toBeInstanceOf(PoolService);
    });
  });

  // ==========================================================================
  // Create Method - UniswapV3 Pools
  // ==========================================================================

  describe('create - Uniswap V3 pools', () => {
    it('should create USDC/WETH 0.05% pool on Ethereum with all fields', async () => {
      // Mock token existence checks
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ETHEREUM,
        config: WETH_ETHEREUM.config as object,
      });

      // Mock pool creation
      prismaMock.pool.create.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const result = await poolService.create(USDC_WETH_500_ETHEREUM.input);

      expect(result).toMatchObject({
        id: USDC_WETH_500_ETHEREUM.expected.id,
        protocol: 'uniswapv3',
        poolType: 'CL_TICKS',
        feeBps: 500,
      });
      expect(result.token0.symbol).toBe('USDC');
      expect(result.token1.symbol).toBe('WETH');
      expect(result.config).toHaveProperty('chainId', 1);
      expect(result.config).toHaveProperty('tickSpacing', 10);
      expect(result.state).toHaveProperty('sqrtPriceX96');
      expect(result.state).toHaveProperty('currentTick');
      expect(result.state).toHaveProperty('liquidity');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should create USDC/WETH 0.3% pool on Ethereum', async () => {
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ETHEREUM,
        config: WETH_ETHEREUM.config as object,
      });

      prismaMock.pool.create.mockResolvedValue(
        USDC_WETH_3000_ETHEREUM.dbResult
      );

      const result = await poolService.create(USDC_WETH_3000_ETHEREUM.input);

      expect(result.feeBps).toBe(3000);
      expect(result.config).toHaveProperty('tickSpacing', 60);
      expect(result.token0.symbol).toBe('USDC');
      expect(result.token1.symbol).toBe('WETH');
    });

    it('should create DAI/USDC 0.01% stablecoin pool', async () => {
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...DAI_ETHEREUM,
        config: DAI_ETHEREUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });

      prismaMock.pool.create.mockResolvedValue(DAI_USDC_100_ETHEREUM.dbResult);

      const result = await poolService.create(DAI_USDC_100_ETHEREUM.input);

      expect(result.feeBps).toBe(100);
      expect(result.config).toHaveProperty('tickSpacing', 1);
      expect(result.token0.symbol).toBe('DAI');
      expect(result.token1.symbol).toBe('USDC');
    });

    it('should create pool on Arbitrum', async () => {
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_WETH_500_ARBITRUM.dbResult.token0,
        config: USDC_WETH_500_ARBITRUM.dbResult.token0.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_WETH_500_ARBITRUM.dbResult.token1,
        config: USDC_WETH_500_ARBITRUM.dbResult.token1.config as object,
      });

      prismaMock.pool.create.mockResolvedValue(
        USDC_WETH_500_ARBITRUM.dbResult
      );

      const result = await poolService.create(USDC_WETH_500_ARBITRUM.input);

      expect(result.config).toHaveProperty('chainId', 42161);
      expect(result.token0.config).toHaveProperty('chainId', 42161);
      expect(result.token1.config).toHaveProperty('chainId', 42161);
    });

    it('should handle bigint state values correctly', async () => {
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ETHEREUM,
        config: WETH_ETHEREUM.config as object,
      });

      prismaMock.pool.create.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const result = await poolService.create(USDC_WETH_500_ETHEREUM.input);

      // State from database is string, should be returned as-is
      expect(typeof (result.state as UniswapV3PoolState).sqrtPriceX96).toBe(
        'string'
      );
      expect(typeof (result.state as UniswapV3PoolState).liquidity).toBe(
        'string'
      );
    });

    it('should throw error if token0 does not exist', async () => {
      // Mock token0 not found
      prismaMock.token.findUnique.mockResolvedValueOnce(null);

      await expect(
        poolService.create(USDC_WETH_500_ETHEREUM.input)
      ).rejects.toThrow(
        `Token with id ${USDC_WETH_500_ETHEREUM.input.token0.id} not found`
      );

      // Verify only one token lookup was attempted
      expect(prismaMock.token.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.pool.create).not.toHaveBeenCalled();
    });

    it('should throw error if token1 does not exist', async () => {
      // Mock token0 exists
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      // Mock token1 not found
      prismaMock.token.findUnique.mockResolvedValueOnce(null);

      await expect(
        poolService.create(USDC_WETH_500_ETHEREUM.input)
      ).rejects.toThrow(
        `Token with id ${USDC_WETH_500_ETHEREUM.input.token1.id} not found`
      );

      expect(prismaMock.token.findUnique).toHaveBeenCalledTimes(2);
      expect(prismaMock.pool.create).not.toHaveBeenCalled();
    });

    it('should call Prisma create with correct data structure', async () => {
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ETHEREUM,
        config: WETH_ETHEREUM.config as object,
      });

      prismaMock.pool.create.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      await poolService.create(USDC_WETH_500_ETHEREUM.input);

      expect(prismaMock.pool.create).toHaveBeenCalledWith({
        data: {
          protocol: 'uniswapv3',
          poolType: 'CL_TICKS',
          token0Id: USDC_ETHEREUM.id,
          token1Id: WETH_ETHEREUM.id,
          feeBps: 500,
          config: USDC_WETH_500_ETHEREUM.input.config,
          state: USDC_WETH_500_ETHEREUM.input.state,
        },
        include: {
          token0: true,
          token1: true,
        },
      });
    });
  });

  // ==========================================================================
  // FindById Method
  // ==========================================================================

  describe('findById', () => {
    it('should find pool by ID', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const result = await poolService.findById(
        USDC_WETH_500_ETHEREUM.dbResult.id
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(USDC_WETH_500_ETHEREUM.dbResult.id);
      expect(result?.protocol).toBe('uniswapv3');
      expect(result?.token0.symbol).toBe('USDC');
      expect(result?.token1.symbol).toBe('WETH');
    });

    it('should return null when pool not found', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(null);

      const result = await poolService.findById('nonexistent_id');

      expect(result).toBeNull();
      expect(prismaMock.pool.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent_id' },
        include: {
          token0: true,
          token1: true,
        },
      });
    });

    it('should call Prisma with correct query structure', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      await poolService.findById('pool_123');

      expect(prismaMock.pool.findUnique).toHaveBeenCalledWith({
        where: { id: 'pool_123' },
        include: {
          token0: true,
          token1: true,
        },
      });
    });

    it('should handle different pool types', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(DAI_USDC_100_ETHEREUM.dbResult);

      const result = await poolService.findById(DAI_USDC_100_ETHEREUM.dbResult.id);

      expect(result?.token0.symbol).toBe('DAI');
      expect(result?.token1.symbol).toBe('USDC');
      expect(result?.feeBps).toBe(100);
    });
  });

  // ==========================================================================
  // UpdateState Method
  // ==========================================================================

  describe('updateState', () => {
    it('should update pool state successfully', async () => {
      const updatedState: UniswapV3PoolState = {
        sqrtPriceX96: BigInt('9999999999999999999999999999999'),
        currentTick: -200000,
        liquidity: BigInt('8888888888888888888'),
        feeGrowthGlobal0: BigInt('777777777777777777777777777777'),
        feeGrowthGlobal1: BigInt('666666666666666666666666666666'),
      };

      // Mock pool exists check
      prismaMock.pool.findUnique.mockResolvedValueOnce(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      // Mock update result
      const updatedDbResult = {
        ...USDC_WETH_500_ETHEREUM.dbResult,
        state: {
          sqrtPriceX96: '9999999999999999999999999999999',
          currentTick: -200000,
          liquidity: '8888888888888888888',
          feeGrowthGlobal0: '777777777777777777777777777777',
          feeGrowthGlobal1: '666666666666666666666666666666',
        },
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };
      prismaMock.pool.update.mockResolvedValue(updatedDbResult);

      const result = await poolService.updateState(
        USDC_WETH_500_ETHEREUM.dbResult.id,
        { state: updatedState }
      );

      expect(result.id).toBe(USDC_WETH_500_ETHEREUM.dbResult.id);
      expect((result.state as UniswapV3PoolState).currentTick).toBe(-200000);
    });

    it('should throw error if pool not found', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(null);

      const newState: UniswapV3PoolState = {
        sqrtPriceX96: BigInt('1111111111111111111111111111111'),
        currentTick: -100000,
        liquidity: BigInt('2222222222222222222'),
        feeGrowthGlobal0: BigInt('333333333333333333333333333333'),
        feeGrowthGlobal1: BigInt('444444444444444444444444444444'),
      };

      await expect(
        poolService.updateState('nonexistent_id', { state: newState })
      ).rejects.toThrow('Pool with id nonexistent_id not found');

      expect(prismaMock.pool.update).not.toHaveBeenCalled();
    });

    it('should call Prisma update with correct data', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const newState: UniswapV3PoolState = {
        sqrtPriceX96: BigInt('5555555555555555555555555555555'),
        currentTick: -150000,
        liquidity: BigInt('6666666666666666666'),
        feeGrowthGlobal0: BigInt('777777777777777777777777777777'),
        feeGrowthGlobal1: BigInt('888888888888888888888888888888'),
      };

      prismaMock.pool.update.mockResolvedValue({
        ...USDC_WETH_500_ETHEREUM.dbResult,
        state: {
          sqrtPriceX96: '5555555555555555555555555555555',
          currentTick: -150000,
          liquidity: '6666666666666666666',
          feeGrowthGlobal0: '777777777777777777777777777777',
          feeGrowthGlobal1: '888888888888888888888888888888',
        },
      });

      await poolService.updateState('pool_123', { state: newState });

      expect(prismaMock.pool.update).toHaveBeenCalledWith({
        where: { id: 'pool_123' },
        data: {
          state: newState,
        },
        include: {
          token0: true,
          token1: true,
        },
      });
    });
  });

  // ==========================================================================
  // Delete Method
  // ==========================================================================

  describe('delete', () => {
    it('should delete pool successfully', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );
      prismaMock.pool.delete.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      await poolService.delete(USDC_WETH_500_ETHEREUM.dbResult.id);

      expect(prismaMock.pool.delete).toHaveBeenCalledWith({
        where: { id: USDC_WETH_500_ETHEREUM.dbResult.id },
      });
    });

    it('should throw error if pool not found', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(null);

      await expect(poolService.delete('nonexistent_id')).rejects.toThrow(
        'Pool with id nonexistent_id not found'
      );

      expect(prismaMock.pool.delete).not.toHaveBeenCalled();
    });

    it('should verify pool existence before deletion', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );
      prismaMock.pool.delete.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      await poolService.delete('pool_123');

      expect(prismaMock.pool.findUnique).toHaveBeenCalledWith({
        where: { id: 'pool_123' },
        include: {
          token0: true,
          token1: true,
        },
      });
      expect(prismaMock.pool.delete).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('should propagate database errors on create', async () => {
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ETHEREUM,
        config: WETH_ETHEREUM.config as object,
      });

      const dbError = new Error('Database connection failed');
      prismaMock.pool.create.mockRejectedValue(dbError);

      await expect(
        poolService.create(USDC_WETH_500_ETHEREUM.input)
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate database errors on findById', async () => {
      const dbError = new Error('Database connection failed');
      prismaMock.pool.findUnique.mockRejectedValue(dbError);

      await expect(poolService.findById('pool_123')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should propagate database errors on updateState', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const dbError = new Error('Database connection failed');
      prismaMock.pool.update.mockRejectedValue(dbError);

      const newState: UniswapV3PoolState = {
        sqrtPriceX96: BigInt('1111111111111111111111111111111'),
        currentTick: -100000,
        liquidity: BigInt('2222222222222222222'),
        feeGrowthGlobal0: BigInt('333333333333333333333333333333'),
        feeGrowthGlobal1: BigInt('444444444444444444444444444444'),
      };

      await expect(
        poolService.updateState('pool_123', { state: newState })
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate database errors on delete', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const dbError = new Error('Database connection failed');
      prismaMock.pool.delete.mockRejectedValue(dbError);

      await expect(poolService.delete('pool_123')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
