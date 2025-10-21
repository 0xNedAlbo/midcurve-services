/**
 * Tests for UniswapV3PositionService
 * Comprehensive test suite covering CRUD operations, serialization, and duplicate checking
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { UniswapV3PositionService } from './uniswapv3-position-service.js';
import {
  TEST_USER_ID,
  TEST_USER_ID_2,
  ACTIVE_ETH_USDC_POSITION,
  CLOSED_POSITION,
  BOB_POSITION,
  ARBITRUM_POSITION,
  BASE_POSITION,
  ACTIVE_POSITION_CONFIG,
  ACTIVE_POSITION_STATE,
  ZERO_POSITION_STATE,
} from './test-fixtures.js';

describe('UniswapV3PositionService', () => {
  let prismaMock: DeepMockProxy<PrismaClient>;
  let service: UniswapV3PositionService;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    service = new UniswapV3PositionService({
      prisma: prismaMock as unknown as PrismaClient,
    });
  });

  // ==========================================================================
  // Serialization Tests
  // ==========================================================================

  describe('parseConfig', () => {
    it('should parse valid config from database', () => {
      const configDB = {
        chainId: 1,
        nftId: 123456,
        poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
        tickLower: -887220,
        tickUpper: 887220,
      };

      const result = service.parseConfig(configDB);

      expect(result.chainId).toBe(1);
      expect(result.nftId).toBe(123456);
      expect(result.poolAddress).toBe('0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640');
      expect(result.tickLower).toBe(-887220);
      expect(result.tickUpper).toBe(887220);
    });
  });

  describe('serializeConfig', () => {
    it('should serialize config to database format', () => {
      const result = service.serializeConfig(ACTIVE_POSITION_CONFIG);

      expect(result).toEqual({
        chainId: 1,
        nftId: 123456,
        poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
        tickLower: -887220,
        tickUpper: 887220,
      });
    });
  });

  describe('parseState', () => {
    it('should parse state with bigint conversion', () => {
      const stateDB = {
        ownerAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
        liquidity: '1000000000000000000',
        feeGrowthInside0LastX128: '123456789012345678901234567890',
        feeGrowthInside1LastX128: '987654321098765432109876543210',
        tokensOwed0: '500000',
        tokensOwed1: '100000000000000000',
      };

      const result = service.parseState(stateDB);

      expect(result.ownerAddress).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1');
      expect(result.liquidity).toBe(1000000000000000000n);
      expect(result.feeGrowthInside0LastX128).toBe(123456789012345678901234567890n);
      expect(result.feeGrowthInside1LastX128).toBe(987654321098765432109876543210n);
      expect(result.tokensOwed0).toBe(500000n);
      expect(result.tokensOwed1).toBe(100000000000000000n);
    });

    it('should handle zero values', () => {
      const stateDB = {
        ownerAddress: '0x0000000000000000000000000000000000000000',
        liquidity: '0',
        feeGrowthInside0LastX128: '0',
        feeGrowthInside1LastX128: '0',
        tokensOwed0: '0',
        tokensOwed1: '0',
      };

      const result = service.parseState(stateDB);

      expect(result.liquidity).toBe(0n);
      expect(result.feeGrowthInside0LastX128).toBe(0n);
      expect(result.feeGrowthInside1LastX128).toBe(0n);
      expect(result.tokensOwed0).toBe(0n);
      expect(result.tokensOwed1).toBe(0n);
    });
  });

  describe('serializeState', () => {
    it('should serialize state with bigint to string conversion', () => {
      const result = service.serializeState(ACTIVE_POSITION_STATE);

      expect(result).toEqual({
        ownerAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
        liquidity: '1000000000000000000',
        feeGrowthInside0LastX128: '123456789012345678901234567890',
        feeGrowthInside1LastX128: '987654321098765432109876543210',
        tokensOwed0: '500000',
        tokensOwed1: '100000000000000000',
      });
    });

    it('should handle zero bigint values', () => {
      const result = service.serializeState(ZERO_POSITION_STATE);

      expect(result).toEqual({
        ownerAddress: '0x0000000000000000000000000000000000000000',
        liquidity: '0',
        feeGrowthInside0LastX128: '0',
        feeGrowthInside1LastX128: '0',
        tokensOwed0: '0',
        tokensOwed1: '0',
      });
    });
  });

  // ==========================================================================
  // CRUD Tests - Create
  // ==========================================================================

  describe('create', () => {
    it('should create a new position successfully', async () => {
      // Mock: No existing position found
      prismaMock.position.findFirst.mockResolvedValue(null);

      // Mock: Position creation succeeds
      prismaMock.position.create.mockResolvedValue(
        ACTIVE_ETH_USDC_POSITION.dbResult as any
      );

      const result = await service.create(ACTIVE_ETH_USDC_POSITION.input);

      expect(result).toBeDefined();
      expect(result.id).toBe('position_001');
      expect(result.protocol).toBe('uniswapv3');
      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.config.nftId).toBe(123456);
      expect(result.config.chainId).toBe(1);
      expect(prismaMock.position.create).toHaveBeenCalledTimes(1);
    });

    it('should return existing position if duplicate found (same userId + chainId + nftId)', async () => {
      // Mock: Existing position found
      prismaMock.position.findFirst.mockResolvedValue(
        ACTIVE_ETH_USDC_POSITION.dbResult as any
      );

      const result = await service.create(ACTIVE_ETH_USDC_POSITION.input);

      expect(result).toBeDefined();
      expect(result.id).toBe('position_001');
      expect(result.userId).toBe(TEST_USER_ID);
      // Should NOT call create if duplicate found
      expect(prismaMock.position.create).not.toHaveBeenCalled();
      expect(prismaMock.position.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should allow same nftId for different users', async () => {
      // Mock: No existing position for Bob
      prismaMock.position.findFirst.mockResolvedValue(null);

      // Mock: Position creation succeeds
      prismaMock.position.create.mockResolvedValue(BOB_POSITION.dbResult as any);

      // Create position for Bob with same nftId/chainId as Alice
      const result = await service.create({
        ...ACTIVE_ETH_USDC_POSITION.input,
        userId: TEST_USER_ID_2, // Different user
      });

      expect(result).toBeDefined();
      expect(result.userId).toBe(TEST_USER_ID_2);
      expect(prismaMock.position.create).toHaveBeenCalledTimes(1);
    });

    it('should allow same user to have positions with different nftIds', async () => {
      // Mock: No existing position found
      prismaMock.position.findFirst.mockResolvedValue(null);

      // Mock: Position creation succeeds
      prismaMock.position.create.mockResolvedValue({
        ...ACTIVE_ETH_USDC_POSITION.dbResult,
        id: 'position_004',
        config: {
          ...ACTIVE_ETH_USDC_POSITION.dbResult.config,
          nftId: 999999, // Different NFT
        },
      } as any);

      const result = await service.create({
        ...ACTIVE_ETH_USDC_POSITION.input,
        config: {
          ...ACTIVE_ETH_USDC_POSITION.input.config,
          nftId: 999999, // Different NFT
        },
      });

      expect(result).toBeDefined();
      expect(result.config.nftId).toBe(999999);
      expect(prismaMock.position.create).toHaveBeenCalledTimes(1);
    });

    it('should serialize bigint fields correctly', async () => {
      prismaMock.position.findFirst.mockResolvedValue(null);
      prismaMock.position.create.mockResolvedValue(
        ACTIVE_ETH_USDC_POSITION.dbResult as any
      );

      await service.create(ACTIVE_ETH_USDC_POSITION.input);

      const createCall = prismaMock.position.create.mock.calls[0][0];

      // Should store bigint fields as strings
      expect(typeof createCall.data.currentValue).toBe('string');
      expect(typeof createCall.data.currentCostBasis).toBe('string');
      expect(typeof createCall.data.realizedPnl).toBe('string');
    });
  });

  // ==========================================================================
  // CRUD Tests - FindById
  // ==========================================================================

  describe('findById', () => {
    it('should find position by ID', async () => {
      prismaMock.position.findUnique.mockResolvedValue(
        ACTIVE_ETH_USDC_POSITION.dbResult as any
      );

      const result = await service.findById('position_001');

      expect(result).toBeDefined();
      expect(result!.id).toBe('position_001');
      expect(result!.protocol).toBe('uniswapv3');
      expect(result!.userId).toBe(TEST_USER_ID);
      expect(result!.currentValue).toBe(1500000000n); // bigint parsed
      expect(prismaMock.position.findUnique).toHaveBeenCalledWith({
        where: { id: 'position_001' },
        include: {
          pool: {
            include: {
              token0: true,
              token1: true,
            },
          },
        },
      });
    });

    it('should return null if position not found', async () => {
      prismaMock.position.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
      expect(prismaMock.position.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should return null if position is not uniswapv3 protocol', async () => {
      prismaMock.position.findUnique.mockResolvedValue({
        ...ACTIVE_ETH_USDC_POSITION.dbResult,
        protocol: 'orca', // Different protocol
      } as any);

      const result = await service.findById('position_001');

      expect(result).toBeNull();
    });

    it('should parse bigint fields correctly', async () => {
      prismaMock.position.findUnique.mockResolvedValue(
        ACTIVE_ETH_USDC_POSITION.dbResult as any
      );

      const result = await service.findById('position_001');

      // Should parse strings to bigints
      expect(typeof result!.currentValue).toBe('bigint');
      expect(typeof result!.currentCostBasis).toBe('bigint');
      expect(typeof result!.realizedPnl).toBe('bigint');
      expect(typeof result!.unrealizedPnl).toBe('bigint');
      expect(typeof result!.collectedFees).toBe('bigint');
      expect(typeof result!.unClaimedFees).toBe('bigint');
      expect(typeof result!.priceRangeLower).toBe('bigint');
      expect(typeof result!.priceRangeUpper).toBe('bigint');
    });

    it('should parse state bigint fields correctly', async () => {
      prismaMock.position.findUnique.mockResolvedValue(
        ACTIVE_ETH_USDC_POSITION.dbResult as any
      );

      const result = await service.findById('position_001');

      expect(typeof result!.state.liquidity).toBe('bigint');
      expect(typeof result!.state.feeGrowthInside0LastX128).toBe('bigint');
      expect(typeof result!.state.feeGrowthInside1LastX128).toBe('bigint');
      expect(typeof result!.state.tokensOwed0).toBe('bigint');
      expect(typeof result!.state.tokensOwed1).toBe('bigint');
    });
  });

  // ==========================================================================
  // CRUD Tests - Update
  // ==========================================================================

  describe('update', () => {
    it('should update position (no-op when no mutable fields)', async () => {
      prismaMock.position.update.mockResolvedValue(
        ACTIVE_ETH_USDC_POSITION.dbResult as any
      );

      const result = await service.update('position_001', {});

      expect(result).toBeDefined();
      expect(result.id).toBe('position_001');
      expect(prismaMock.position.update).toHaveBeenCalledWith({
        where: { id: 'position_001' },
        data: {},
        include: {
          pool: {
            include: {
              token0: true,
              token1: true,
            },
          },
        },
      });
    });

    it('should handle empty updates', async () => {
      prismaMock.position.update.mockResolvedValue(
        ACTIVE_ETH_USDC_POSITION.dbResult as any
      );

      await service.update('position_001', {});

      const updateCall = prismaMock.position.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({});
    });

    it('should throw error if position not found', async () => {
      prismaMock.position.update.mockRejectedValue({
        code: 'P2025',
        message: 'Record not found',
      });

      await expect(service.update('nonexistent', {})).rejects.toThrow();
    });
  });

  // ==========================================================================
  // CRUD Tests - Delete
  // ==========================================================================

  describe('delete', () => {
    it('should delete position if it exists and is uniswapv3', async () => {
      prismaMock.position.findUnique.mockResolvedValue(
        ACTIVE_ETH_USDC_POSITION.dbResult as any
      );
      prismaMock.position.delete.mockResolvedValue(
        ACTIVE_ETH_USDC_POSITION.dbResult as any
      );

      await service.delete('position_001');

      expect(prismaMock.position.findUnique).toHaveBeenCalledWith({
        where: { id: 'position_001' },
      });
      expect(prismaMock.position.delete).toHaveBeenCalledWith({
        where: { id: 'position_001' },
      });
    });

    it('should silently succeed if position not found', async () => {
      prismaMock.position.findUnique.mockResolvedValue(null);

      await service.delete('nonexistent');

      expect(prismaMock.position.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.position.delete).not.toHaveBeenCalled();
    });

    it('should throw error if position is not uniswapv3 protocol', async () => {
      prismaMock.position.findUnique.mockResolvedValue({
        ...ACTIVE_ETH_USDC_POSITION.dbResult,
        protocol: 'orca',
      } as any);

      await expect(service.delete('position_001')).rejects.toThrow(
        "Cannot delete position position_001: expected protocol 'uniswapv3', got 'orca'"
      );

      expect(prismaMock.position.delete).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle closed positions', async () => {
      prismaMock.position.findUnique.mockResolvedValue(
        CLOSED_POSITION.dbResult as any
      );

      const result = await service.findById('position_002');

      expect(result).toBeDefined();
      expect(result!.isActive).toBe(false);
      expect(result!.positionClosedAt).toBeInstanceOf(Date);
      expect(result!.currentValue).toBe(0n);
      expect(result!.realizedPnl).toBe(100000000n);
    });

    it('should handle positions with zero liquidity', async () => {
      prismaMock.position.findUnique.mockResolvedValue({
        ...ACTIVE_ETH_USDC_POSITION.dbResult,
        state: {
          ...ACTIVE_ETH_USDC_POSITION.dbResult.state,
          liquidity: '0',
        },
      } as any);

      const result = await service.findById('position_001');

      expect(result!.state.liquidity).toBe(0n);
    });

    it('should handle positions with very large bigint values', async () => {
      const largeBigInt = '999999999999999999999999999999999999';

      prismaMock.position.findUnique.mockResolvedValue({
        ...ACTIVE_ETH_USDC_POSITION.dbResult,
        currentValue: largeBigInt,
      } as any);

      const result = await service.findById('position_001');

      expect(result!.currentValue).toBe(BigInt(largeBigInt));
    });
  });

  // ==========================================================================
  // Query Tests - FindMany
  // ==========================================================================

  describe('findMany', () => {
    describe('basic queries', () => {
      it('should return all positions for a user with no filters', async () => {
        const mockPositions = [
          ACTIVE_ETH_USDC_POSITION.dbResult,
          CLOSED_POSITION.dbResult,
          ARBITRUM_POSITION.dbResult,
        ];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(3);

        const result = await service.findMany(TEST_USER_ID, {});

        expect(result.positions).toHaveLength(3);
        expect(result.total).toBe(3);
        expect(result.positions[0].id).toBe('position_001');
        expect(result.positions[1].id).toBe('position_002');
        expect(result.positions[2].id).toBe('position_004');

        // Verify Prisma was called with correct parameters
        expect(prismaMock.position.findMany).toHaveBeenCalledWith({
          where: {
            protocol: 'uniswapv3',
            userId: TEST_USER_ID,
          },
          include: {
            pool: {
              include: {
                token0: true,
                token1: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 20, // default limit
          skip: 0,  // default offset
        });

        expect(prismaMock.position.count).toHaveBeenCalledWith({
          where: {
            protocol: 'uniswapv3',
            userId: TEST_USER_ID,
          },
        });
      });

      it('should return empty array when user has no positions', async () => {
        prismaMock.position.findMany.mockResolvedValue([]);
        prismaMock.position.count.mockResolvedValue(0);

        const result = await service.findMany(TEST_USER_ID, {});

        expect(result.positions).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe('status filtering', () => {
      it('should filter by status="active"', async () => {
        const mockPositions = [
          ACTIVE_ETH_USDC_POSITION.dbResult,
          ARBITRUM_POSITION.dbResult,
        ];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(2);

        const result = await service.findMany(TEST_USER_ID, { status: 'active' });

        expect(result.positions).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.positions.every((p) => p.isActive)).toBe(true);

        // Verify where clause includes isActive filter
        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              protocol: 'uniswapv3',
              userId: TEST_USER_ID,
              isActive: true,
            },
          })
        );
      });

      it('should filter by status="closed"', async () => {
        const mockPositions = [CLOSED_POSITION.dbResult, BASE_POSITION.dbResult];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(2);

        const result = await service.findMany(TEST_USER_ID, { status: 'closed' });

        expect(result.positions).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.positions.every((p) => !p.isActive)).toBe(true);

        // Verify where clause includes isActive = false
        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              protocol: 'uniswapv3',
              userId: TEST_USER_ID,
              isActive: false,
            },
          })
        );
      });

      it('should return all positions with status="all"', async () => {
        const mockPositions = [
          ACTIVE_ETH_USDC_POSITION.dbResult,
          CLOSED_POSITION.dbResult,
          ARBITRUM_POSITION.dbResult,
        ];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(3);

        const result = await service.findMany(TEST_USER_ID, { status: 'all' });

        expect(result.positions).toHaveLength(3);
        expect(result.total).toBe(3);

        // Verify where clause does NOT include isActive filter
        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              protocol: 'uniswapv3',
              userId: TEST_USER_ID,
              // no isActive field
            },
          })
        );
      });

      it('should default to status="all" when not specified', async () => {
        const mockPositions = [
          ACTIVE_ETH_USDC_POSITION.dbResult,
          CLOSED_POSITION.dbResult,
        ];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(2);

        const result = await service.findMany(TEST_USER_ID);

        expect(result.positions).toHaveLength(2);

        // Verify no isActive filter when status not specified
        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              protocol: 'uniswapv3',
              userId: TEST_USER_ID,
            },
          })
        );
      });
    });

    describe('chainId filtering', () => {
      it('should filter by chainId', async () => {
        const mockPositions = [
          ACTIVE_ETH_USDC_POSITION.dbResult,
          CLOSED_POSITION.dbResult,
        ];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(2);

        const result = await service.findMany(TEST_USER_ID, { chainId: 1 });

        expect(result.positions).toHaveLength(2);
        expect(result.total).toBe(2);

        // Verify JSON field query for chainId
        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              protocol: 'uniswapv3',
              userId: TEST_USER_ID,
              config: {
                path: ['chainId'],
                equals: 1,
              },
            },
          })
        );
      });

      it('should return empty when no positions match chainId', async () => {
        prismaMock.position.findMany.mockResolvedValue([]);
        prismaMock.position.count.mockResolvedValue(0);

        const result = await service.findMany(TEST_USER_ID, { chainId: 137 }); // Polygon

        expect(result.positions).toHaveLength(0);
        expect(result.total).toBe(0);
      });

      it('should filter Arbitrum positions correctly', async () => {
        const mockPositions = [ARBITRUM_POSITION.dbResult];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(1);

        const result = await service.findMany(TEST_USER_ID, { chainId: 42161 });

        expect(result.positions).toHaveLength(1);
        expect(result.positions[0].config.chainId).toBe(42161);
      });
    });

    describe('combined filters', () => {
      it('should filter by both chainId and status', async () => {
        const mockPositions = [ACTIVE_ETH_USDC_POSITION.dbResult];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(1);

        const result = await service.findMany(TEST_USER_ID, {
          chainId: 1,
          status: 'active',
        });

        expect(result.positions).toHaveLength(1);
        expect(result.positions[0].isActive).toBe(true);
        expect(result.positions[0].config.chainId).toBe(1);

        // Verify both filters in where clause
        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              protocol: 'uniswapv3',
              userId: TEST_USER_ID,
              isActive: true,
              config: {
                path: ['chainId'],
                equals: 1,
              },
            },
          })
        );
      });

      it('should handle chainId filter with status="all"', async () => {
        const mockPositions = [
          ACTIVE_ETH_USDC_POSITION.dbResult,
          CLOSED_POSITION.dbResult,
        ];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(2);

        const result = await service.findMany(TEST_USER_ID, {
          chainId: 1,
          status: 'all',
        });

        expect(result.positions).toHaveLength(2);

        // Verify chainId filter but no isActive filter
        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              protocol: 'uniswapv3',
              userId: TEST_USER_ID,
              config: {
                path: ['chainId'],
                equals: 1,
              },
            },
          })
        );
      });
    });

    describe('pagination', () => {
      it('should paginate with limit and offset', async () => {
        const mockPositions = [
          ACTIVE_ETH_USDC_POSITION.dbResult,
          CLOSED_POSITION.dbResult,
        ];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(5);

        const result = await service.findMany(TEST_USER_ID, {
          limit: 2,
          offset: 0,
        });

        expect(result.positions).toHaveLength(2);
        expect(result.total).toBe(5);

        // Verify pagination parameters
        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 2,
            skip: 0,
          })
        );
      });

      it('should handle offset beyond results', async () => {
        prismaMock.position.findMany.mockResolvedValue([]);
        prismaMock.position.count.mockResolvedValue(3);

        const result = await service.findMany(TEST_USER_ID, {
          limit: 10,
          offset: 10,
        });

        expect(result.positions).toHaveLength(0);
        expect(result.total).toBe(3);

        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 10,
            skip: 10,
          })
        );
      });

      it('should use default limit of 20 when not specified', async () => {
        prismaMock.position.findMany.mockResolvedValue([]);
        prismaMock.position.count.mockResolvedValue(0);

        await service.findMany(TEST_USER_ID, {});

        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 20,
          })
        );
      });

      it('should use default offset of 0 when not specified', async () => {
        prismaMock.position.findMany.mockResolvedValue([]);
        prismaMock.position.count.mockResolvedValue(0);

        await service.findMany(TEST_USER_ID, {});

        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 0,
          })
        );
      });

      it('should respect custom limit and offset', async () => {
        prismaMock.position.findMany.mockResolvedValue([]);
        prismaMock.position.count.mockResolvedValue(100);

        await service.findMany(TEST_USER_ID, {
          limit: 50,
          offset: 25,
        });

        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 50,
            skip: 25,
          })
        );
      });
    });

    describe('data integrity', () => {
      it('should only query uniswapv3 positions', async () => {
        prismaMock.position.findMany.mockResolvedValue([]);
        prismaMock.position.count.mockResolvedValue(0);

        await service.findMany(TEST_USER_ID, {});

        // Verify protocol filter is always applied
        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              protocol: 'uniswapv3',
            }),
          })
        );
      });

      it('should order by createdAt DESC', async () => {
        prismaMock.position.findMany.mockResolvedValue([]);
        prismaMock.position.count.mockResolvedValue(0);

        await service.findMany(TEST_USER_ID, {});

        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              createdAt: 'desc',
            },
          })
        );
      });

      it('should include full pool with token0 and token1', async () => {
        prismaMock.position.findMany.mockResolvedValue([]);
        prismaMock.position.count.mockResolvedValue(0);

        await service.findMany(TEST_USER_ID, {});

        expect(prismaMock.position.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: {
              pool: {
                include: {
                  token0: true,
                  token1: true,
                },
              },
            },
          })
        );
      });

      it('should parse bigint fields correctly', async () => {
        const mockPositions = [ACTIVE_ETH_USDC_POSITION.dbResult];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(1);

        const result = await service.findMany(TEST_USER_ID, {});

        // Verify bigint parsing
        expect(typeof result.positions[0].currentValue).toBe('bigint');
        expect(typeof result.positions[0].currentCostBasis).toBe('bigint');
        expect(typeof result.positions[0].realizedPnl).toBe('bigint');
        expect(typeof result.positions[0].unrealizedPnl).toBe('bigint');
        expect(typeof result.positions[0].collectedFees).toBe('bigint');
        expect(typeof result.positions[0].unClaimedFees).toBe('bigint');
        expect(typeof result.positions[0].priceRangeLower).toBe('bigint');
        expect(typeof result.positions[0].priceRangeUpper).toBe('bigint');

        // State bigints
        expect(typeof result.positions[0].state.liquidity).toBe('bigint');
        expect(typeof result.positions[0].state.feeGrowthInside0LastX128).toBe('bigint');
        expect(typeof result.positions[0].state.feeGrowthInside1LastX128).toBe('bigint');
        expect(typeof result.positions[0].state.tokensOwed0).toBe('bigint');
        expect(typeof result.positions[0].state.tokensOwed1).toBe('bigint');
      });

      it('should include nested pool and token objects', async () => {
        const mockPositions = [ACTIVE_ETH_USDC_POSITION.dbResult];

        prismaMock.position.findMany.mockResolvedValue(mockPositions as any);
        prismaMock.position.count.mockResolvedValue(1);

        const result = await service.findMany(TEST_USER_ID, {});

        expect(result.positions[0].pool).toBeDefined();
        expect(result.positions[0].pool.token0).toBeDefined();
        expect(result.positions[0].pool.token1).toBeDefined();
        expect(result.positions[0].pool.token0.symbol).toBe('USDC');
        expect(result.positions[0].pool.token1.symbol).toBe('WETH');
      });
    });

    describe('error handling', () => {
      it('should propagate Prisma errors', async () => {
        const error = new Error('Database connection failed');
        prismaMock.position.findMany.mockRejectedValue(error);

        await expect(service.findMany(TEST_USER_ID, {})).rejects.toThrow(
          'Database connection failed'
        );
      });

      it('should propagate count errors', async () => {
        prismaMock.position.findMany.mockResolvedValue([]);
        prismaMock.position.count.mockRejectedValue(new Error('Count failed'));

        await expect(service.findMany(TEST_USER_ID, {})).rejects.toThrow('Count failed');
      });
    });
  });
});
