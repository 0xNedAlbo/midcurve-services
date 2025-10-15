/**
 * Comprehensive tests for UniswapV3PoolService
 * Tests CRUD operations with address validation, normalization, and bigint handling
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { UniswapV3PoolService } from './uniswapv3-pool-service.js';
import {
  USDC_WETH_500_ETHEREUM,
  USDC_WETH_3000_ETHEREUM,
  DAI_USDC_100_ETHEREUM,
  USDC_WETH_500_ARBITRUM,
  USDC_ETHEREUM,
  WETH_ETHEREUM,
  DAI_ETHEREUM,
  USDC_ARBITRUM,
  WETH_ARBITRUM,
} from './test-fixtures.js';
import type { UniswapV3PoolState } from '../../shared/types/uniswapv3/pool.js';

describe('UniswapV3PoolService', () => {
  let prismaMock: DeepMockProxy<PrismaClient>;
  let poolService: UniswapV3PoolService;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    poolService = new UniswapV3PoolService({
      prisma: prismaMock as unknown as PrismaClient,
    });
  });

  // ==========================================================================
  // Constructor & Dependency Injection Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create instance with provided Prisma client', () => {
      const service = new UniswapV3PoolService({
        prisma: prismaMock as unknown as PrismaClient,
      });
      expect(service).toBeInstanceOf(UniswapV3PoolService);
    });

    it('should create instance with default Prisma client when not provided', () => {
      const service = new UniswapV3PoolService();
      expect(service).toBeInstanceOf(UniswapV3PoolService);
    });

    it('should accept empty dependencies object', () => {
      const service = new UniswapV3PoolService({});
      expect(service).toBeInstanceOf(UniswapV3PoolService);
    });
  });

  // ==========================================================================
  // Create Method - Address Validation & Normalization
  // ==========================================================================

  describe('create - address validation', () => {
    it('should throw error for invalid pool address', async () => {
      const invalidInput = {
        ...USDC_WETH_500_ETHEREUM.input,
        config: {
          ...USDC_WETH_500_ETHEREUM.input.config,
          address: 'invalid_address',
        },
      };

      await expect(poolService.create(invalidInput)).rejects.toThrow(
        'Invalid pool address format: invalid_address'
      );
    });

    it('should throw error for invalid token0 address', async () => {
      const invalidInput = {
        ...USDC_WETH_500_ETHEREUM.input,
        config: {
          ...USDC_WETH_500_ETHEREUM.input.config,
          token0: 'invalid_token0',
        },
      };

      await expect(poolService.create(invalidInput)).rejects.toThrow(
        'Invalid token0 address format: invalid_token0'
      );
    });

    it('should throw error for invalid token1 address', async () => {
      const invalidInput = {
        ...USDC_WETH_500_ETHEREUM.input,
        config: {
          ...USDC_WETH_500_ETHEREUM.input.config,
          token1: 'invalid_token1',
        },
      };

      await expect(poolService.create(invalidInput)).rejects.toThrow(
        'Invalid token1 address format: invalid_token1'
      );
    });

    it('should normalize pool address to EIP-55 checksum format', async () => {
      const lowercaseInput = {
        ...USDC_WETH_500_ETHEREUM.input,
        config: {
          ...USDC_WETH_500_ETHEREUM.input.config,
          address: USDC_WETH_500_ETHEREUM.input.config.address.toLowerCase(),
        },
      };

      // Mock no existing pool
      prismaMock.pool.findFirst.mockResolvedValue(null);

      // Mock token existence checks (UniswapV3PoolService checks ERC-20 type)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ETHEREUM,
        config: WETH_ETHEREUM.config as object,
      });

      // Mock token existence checks (PoolService checks existence)
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

      const result = await poolService.create(lowercaseInput);

      // Verify address was normalized (EIP-55 has mixed case)
      expect(result.config.address).not.toBe(result.config.address.toLowerCase());
      expect(result.config.address).toBe(
        USDC_WETH_500_ETHEREUM.expected.config.address
      );
    });

    it('should normalize token addresses to EIP-55 checksum format', async () => {
      const lowercaseInput = {
        ...USDC_WETH_500_ETHEREUM.input,
        config: {
          ...USDC_WETH_500_ETHEREUM.input.config,
          token0: USDC_WETH_500_ETHEREUM.input.config.token0.toLowerCase(),
          token1: USDC_WETH_500_ETHEREUM.input.config.token1.toLowerCase(),
        },
      };

      prismaMock.pool.findFirst.mockResolvedValue(null);

      // Mock token existence checks (UniswapV3PoolService checks ERC-20 type)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ETHEREUM,
        config: WETH_ETHEREUM.config as object,
      });

      // Mock token existence checks (PoolService checks existence)
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

      const result = await poolService.create(lowercaseInput);

      expect(result.config.token0).toBe(
        USDC_WETH_500_ETHEREUM.expected.config.token0
      );
      expect(result.config.token1).toBe(
        USDC_WETH_500_ETHEREUM.expected.config.token1
      );
    });
  });

  // ==========================================================================
  // Create Method - Token Ordering Validation
  // ==========================================================================

  describe('create - token ordering', () => {
    it('should throw error if token0 >= token1', async () => {
      // Swap token order (invalid)
      const invalidInput = {
        ...USDC_WETH_500_ETHEREUM.input,
        config: {
          ...USDC_WETH_500_ETHEREUM.input.config,
          token0: USDC_WETH_500_ETHEREUM.input.config.token1,
          token1: USDC_WETH_500_ETHEREUM.input.config.token0,
        },
      };

      await expect(poolService.create(invalidInput)).rejects.toThrow(
        /Invalid token ordering: token0 .* must be < token1/
      );
    });

    it('should throw error if token0 === token1', async () => {
      const invalidInput = {
        ...USDC_WETH_500_ETHEREUM.input,
        config: {
          ...USDC_WETH_500_ETHEREUM.input.config,
          token0: USDC_WETH_500_ETHEREUM.input.config.token0,
          token1: USDC_WETH_500_ETHEREUM.input.config.token0, // Same as token0
        },
      };

      await expect(poolService.create(invalidInput)).rejects.toThrow(
        /Invalid token ordering: token0 .* must be < token1/
      );
    });
  });

  // ==========================================================================
  // Create Method - Duplicate Prevention
  // ==========================================================================

  describe('create - duplicate prevention', () => {
    it('should return existing pool if already exists (same address and chain)', async () => {
      // Mock existing pool found
      prismaMock.pool.findFirst.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const result = await poolService.create(USDC_WETH_500_ETHEREUM.input);

      // Should return existing pool
      expect(result.id).toBe(USDC_WETH_500_ETHEREUM.expected.id);

      // Should NOT attempt to create new pool
      expect(prismaMock.pool.create).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive address matching for duplicates', async () => {
      const lowercaseInput = {
        ...USDC_WETH_500_ETHEREUM.input,
        config: {
          ...USDC_WETH_500_ETHEREUM.input.config,
          address: USDC_WETH_500_ETHEREUM.input.config.address.toLowerCase(),
        },
      };

      // Mock existing pool found (normalized address matches)
      prismaMock.pool.findFirst.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const result = await poolService.create(lowercaseInput);

      expect(result.id).toBe(USDC_WETH_500_ETHEREUM.expected.id);
      expect(prismaMock.pool.create).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Create Method - Token Validation
  // ==========================================================================

  describe('create - token validation', () => {
    it('should throw error if token0 does not exist', async () => {
      prismaMock.pool.findFirst.mockResolvedValue(null);

      // Mock token0 not found
      prismaMock.token.findUnique.mockResolvedValueOnce(null);

      await expect(
        poolService.create(USDC_WETH_500_ETHEREUM.input)
      ).rejects.toThrow(
        `Token with id ${USDC_WETH_500_ETHEREUM.input.token0.id} not found`
      );

      expect(prismaMock.pool.create).not.toHaveBeenCalled();
    });

    it('should throw error if token1 does not exist', async () => {
      prismaMock.pool.findFirst.mockResolvedValue(null);

      // Mock token0 exists (UniswapV3PoolService checks ERC-20 type)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      // Mock token1 not found (UniswapV3PoolService checks ERC-20 type - doesn't throw, just continues)
      prismaMock.token.findUnique.mockResolvedValueOnce(null);

      // Mock token0 exists (PoolService checks existence)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      // Mock token1 not found (PoolService checks existence - this is where it throws)
      prismaMock.token.findUnique.mockResolvedValueOnce(null);

      await expect(
        poolService.create(USDC_WETH_500_ETHEREUM.input)
      ).rejects.toThrow(
        `Token with id ${USDC_WETH_500_ETHEREUM.input.token1.id} not found`
      );

      expect(prismaMock.pool.create).not.toHaveBeenCalled();
    });

    it('should throw error if token0 is not ERC-20 type', async () => {
      prismaMock.pool.findFirst.mockResolvedValue(null);

      // Mock token0 as Solana token (wrong type)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        tokenType: 'solana-spl',
        config: { mint: 'fake_mint' },
      });

      await expect(
        poolService.create(USDC_WETH_500_ETHEREUM.input)
      ).rejects.toThrow(
        `Token ${USDC_WETH_500_ETHEREUM.input.token0.id} is not an ERC-20 token`
      );

      expect(prismaMock.pool.create).not.toHaveBeenCalled();
    });

    it('should throw error if token1 is not ERC-20 type', async () => {
      prismaMock.pool.findFirst.mockResolvedValue(null);

      // Mock token0 exists (ERC-20)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      // Mock token1 as Solana token (wrong type)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ETHEREUM,
        tokenType: 'solana-spl',
        config: { mint: 'fake_mint' },
      });

      await expect(
        poolService.create(USDC_WETH_500_ETHEREUM.input)
      ).rejects.toThrow(
        `Token ${USDC_WETH_500_ETHEREUM.input.token1.id} is not an ERC-20 token`
      );

      expect(prismaMock.pool.create).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Create Method - Successful Creation
  // ==========================================================================

  describe('create - successful creation', () => {
    it('should create USDC/WETH 0.05% pool on Ethereum', async () => {
      prismaMock.pool.findFirst.mockResolvedValue(null);

      // Mock token existence checks (UniswapV3PoolService checks ERC-20 type)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ETHEREUM,
        config: WETH_ETHEREUM.config as object,
      });

      // Mock token existence checks (PoolService checks existence)
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

      expect(result.protocol).toBe('uniswapv3');
      expect(result.poolType).toBe('CL_TICKS');
      expect(result.feeBps).toBe(500);
      expect(result.token0.symbol).toBe('USDC');
      expect(result.token1.symbol).toBe('WETH');
      expect(result.config.chainId).toBe(1);
      expect(result.config.tickSpacing).toBe(10);

      // Verify bigint conversion (state should have bigint values)
      expect(typeof result.state.sqrtPriceX96).toBe('bigint');
      expect(typeof result.state.liquidity).toBe('bigint');
      expect(typeof result.state.feeGrowthGlobal0).toBe('bigint');
      expect(typeof result.state.feeGrowthGlobal1).toBe('bigint');
    });

    it('should create pool on different chain (Arbitrum)', async () => {
      prismaMock.pool.findFirst.mockResolvedValue(null);

      // Mock token existence checks (UniswapV3PoolService checks ERC-20 type)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ARBITRUM,
        config: USDC_ARBITRUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ARBITRUM,
        config: WETH_ARBITRUM.config as object,
      });

      // Mock token existence checks (PoolService checks existence)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ARBITRUM,
        config: USDC_ARBITRUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...WETH_ARBITRUM,
        config: WETH_ARBITRUM.config as object,
      });

      prismaMock.pool.create.mockResolvedValue(
        USDC_WETH_500_ARBITRUM.dbResult
      );

      const result = await poolService.create(USDC_WETH_500_ARBITRUM.input);

      expect(result.config.chainId).toBe(42161);
    });

    it('should create pool with different fee tier', async () => {
      prismaMock.pool.findFirst.mockResolvedValue(null);

      // Mock token existence checks (UniswapV3PoolService checks ERC-20 type)
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...DAI_ETHEREUM,
        config: DAI_ETHEREUM.config as object,
      });
      prismaMock.token.findUnique.mockResolvedValueOnce({
        ...USDC_ETHEREUM,
        config: USDC_ETHEREUM.config as object,
      });

      // Mock token existence checks (PoolService checks existence)
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
      expect(result.config.tickSpacing).toBe(1);
    });
  });

  // ==========================================================================
  // FindByAddressAndChain Method
  // ==========================================================================

  describe('findByAddressAndChain', () => {
    it('should find pool by address and chain', async () => {
      prismaMock.pool.findFirst.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const result = await poolService.findByAddressAndChain(
        USDC_WETH_500_ETHEREUM.input.config.address,
        1
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(USDC_WETH_500_ETHEREUM.expected.id);
      expect(result?.config.chainId).toBe(1);
    });

    it('should return null when pool not found', async () => {
      prismaMock.pool.findFirst.mockResolvedValue(null);

      const result = await poolService.findByAddressAndChain(
        '0x1234567890123456789012345678901234567890',
        1
      );

      expect(result).toBeNull();
    });

    it('should handle case-insensitive address lookup', async () => {
      prismaMock.pool.findFirst.mockResolvedValue(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const result = await poolService.findByAddressAndChain(
        USDC_WETH_500_ETHEREUM.input.config.address.toLowerCase(),
        1
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(USDC_WETH_500_ETHEREUM.expected.id);
    });

    it('should throw error for invalid address format', async () => {
      await expect(
        poolService.findByAddressAndChain('invalid_address', 1)
      ).rejects.toThrow('Invalid pool address format: invalid_address');
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
        USDC_WETH_500_ETHEREUM.expected.id
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(USDC_WETH_500_ETHEREUM.expected.id);
      expect(result?.protocol).toBe('uniswapv3');

      // Verify bigint conversion
      expect(typeof result?.state.sqrtPriceX96).toBe('bigint');
    });

    it('should return null when pool not found', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(null);

      const result = await poolService.findById('nonexistent_id');

      expect(result).toBeNull();
    });

    it('should return null for non-Uniswap V3 pool', async () => {
      const nonUniswapPool = {
        ...USDC_WETH_500_ETHEREUM.dbResult,
        protocol: 'pancakeswap',
      };

      prismaMock.pool.findUnique.mockResolvedValue(nonUniswapPool);

      const result = await poolService.findById('pool_123');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // UpdateState Method
  // ==========================================================================

  describe('updateState', () => {
    it('should update pool state successfully', async () => {
      const newState: UniswapV3PoolState = {
        sqrtPriceX96: BigInt('9999999999999999999999999999999'),
        currentTick: -200000,
        liquidity: BigInt('8888888888888888888'),
        feeGrowthGlobal0: BigInt('777777777777777777777777777777'),
        feeGrowthGlobal1: BigInt('666666666666666666666666666666'),
      };

      // Mock findById call in UniswapV3PoolService.updateState() - line 493
      // This delegates to poolService.findById() which calls pool.findUnique
      prismaMock.pool.findUnique.mockResolvedValueOnce(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      // Mock poolService.updateState() which also calls pool.findUnique - line 516 -> line 330 in PoolService
      prismaMock.pool.findUnique.mockResolvedValueOnce(
        USDC_WETH_500_ETHEREUM.dbResult
      );

      const updatedDbResult = {
        ...USDC_WETH_500_ETHEREUM.dbResult,
        state: {
          sqrtPriceX96: '9999999999999999999999999999999',
          currentTick: -200000,
          liquidity: '8888888888888888888',
          feeGrowthGlobal0: '777777777777777777777777777777',
          feeGrowthGlobal1: '666666666666666666666666666666',
        },
      };

      // Mock the pool.update call in poolService.updateState()
      prismaMock.pool.update.mockResolvedValue(updatedDbResult);

      const result = await poolService.updateState(
        USDC_WETH_500_ETHEREUM.expected.id,
        { state: newState }
      );

      expect(result.state.currentTick).toBe(-200000);
      expect(result.state.sqrtPriceX96).toBe(BigInt('9999999999999999999999999999999'));
      expect(typeof result.state.sqrtPriceX96).toBe('bigint');
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
    });

    it('should throw error if pool is not Uniswap V3', async () => {
      const nonUniswapPool = {
        ...USDC_WETH_500_ETHEREUM.dbResult,
        protocol: 'pancakeswap',
      };

      prismaMock.pool.findUnique.mockResolvedValue(nonUniswapPool);

      const newState: UniswapV3PoolState = {
        sqrtPriceX96: BigInt('1111111111111111111111111111111'),
        currentTick: -100000,
        liquidity: BigInt('2222222222222222222'),
        feeGrowthGlobal0: BigInt('333333333333333333333333333333'),
        feeGrowthGlobal1: BigInt('444444444444444444444444444444'),
      };

      await expect(
        poolService.updateState('pool_123', { state: newState })
      ).rejects.toThrow(
        'Pool pool_123 is not a Uniswap V3 pool (protocol: pancakeswap)'
      );
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

      await poolService.delete(USDC_WETH_500_ETHEREUM.expected.id);

      expect(prismaMock.pool.delete).toHaveBeenCalledWith({
        where: { id: USDC_WETH_500_ETHEREUM.expected.id },
      });
    });

    it('should throw error if pool not found', async () => {
      prismaMock.pool.findUnique.mockResolvedValue(null);

      await expect(poolService.delete('nonexistent_id')).rejects.toThrow(
        'Pool with id nonexistent_id not found'
      );

      expect(prismaMock.pool.delete).not.toHaveBeenCalled();
    });

    it('should throw error if pool is not Uniswap V3', async () => {
      const nonUniswapPool = {
        ...USDC_WETH_500_ETHEREUM.dbResult,
        protocol: 'pancakeswap',
      };

      prismaMock.pool.findUnique.mockResolvedValue(nonUniswapPool);

      await expect(poolService.delete('pool_123')).rejects.toThrow(
        'Pool pool_123 is not a Uniswap V3 pool (protocol: pancakeswap)'
      );

      expect(prismaMock.pool.delete).not.toHaveBeenCalled();
    });
  });
});
