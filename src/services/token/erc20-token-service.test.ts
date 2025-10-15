/**
 * Tests for Erc20TokenService
 * Focused on ERC-20 specific functionality including token discovery
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import type { PublicClient } from 'viem';
import { Erc20TokenService } from './erc20-token-service.js';
import { EvmConfig } from '../../config/evm.js';
import { TokenMetadataError } from '../../utils/erc20-reader.js';
import {
  USDC_ETHEREUM,
  DISCOVERED_TOKEN,
  NON_COMPLIANT_TOKEN,
} from './test-fixtures.js';

describe('Erc20TokenService', () => {
  let prismaMock: DeepMockProxy<PrismaClient>;
  let evmConfigMock: DeepMockProxy<EvmConfig>;
  let publicClientMock: DeepMockProxy<PublicClient>;
  let service: Erc20TokenService;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    evmConfigMock = mockDeep<EvmConfig>();
    publicClientMock = mockDeep<PublicClient>();

    service = new Erc20TokenService({
      prisma: prismaMock as unknown as PrismaClient,
      evmConfig: evmConfigMock as unknown as EvmConfig,
    });
  });

  // ==========================================================================
  // Create Tests
  // ==========================================================================

  describe('create', () => {
    describe('successful creation', () => {
      it('should create new token with valid data', async () => {
        const { input, dbResult } = USDC_ETHEREUM;

        // Mock: Token doesn't exist (duplicate check)
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Token creation
        prismaMock.token.create.mockResolvedValue(dbResult);

        // Execute
        const result = await service.create(input);

        // Verify
        expect(result.name).toBe('USD Coin');
        expect(result.symbol).toBe('USDC');
        expect(result.decimals).toBe(6);
        expect(result.config.address).toBe(
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        );
        expect(result.config.chainId).toBe(1);

        // Verify duplicate check was performed
        expect(prismaMock.token.findFirst).toHaveBeenCalledTimes(1);

        // Verify token was created
        expect(prismaMock.token.create).toHaveBeenCalledTimes(1);
      });

      it('should return existing token when duplicate found', async () => {
        const { input, dbResult } = USDC_ETHEREUM;

        // Mock: Token already exists
        prismaMock.token.findFirst.mockResolvedValue(dbResult);

        // Execute
        const result = await service.create(input);

        // Verify
        expect(result.id).toBe(dbResult.id);
        expect(result.symbol).toBe('USDC');

        // Verify duplicate check was performed
        expect(prismaMock.token.findFirst).toHaveBeenCalledTimes(1);

        // Verify no new token was created
        expect(prismaMock.token.create).not.toHaveBeenCalled();
      });

      it('should normalize lowercase address', async () => {
        const input = {
          tokenType: 'evm-erc20' as const,
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 18,
          config: {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // lowercase
            chainId: 1,
          },
        };

        // Mock: No duplicate
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Creation
        prismaMock.token.create.mockResolvedValue({
          id: 'token_test',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: input.name,
          symbol: input.symbol,
          decimals: input.decimals,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // normalized
            chainId: 1,
          },
        });

        // Execute
        const result = await service.create(input);

        // Verify address was normalized
        expect(result.config.address).toBe(
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        );
      });

      it('should normalize mixed case address', async () => {
        const input = {
          tokenType: 'evm-erc20' as const,
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 18,
          config: {
            address: '0xa0B86991c6218b36c1d19d4A2e9Eb0cE3606eB48', // mixed case (not proper checksum)
            chainId: 1,
          },
        };

        // Mock: No duplicate
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Creation
        prismaMock.token.create.mockResolvedValue({
          id: 'token_test',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: input.name,
          symbol: input.symbol,
          decimals: input.decimals,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // normalized
            chainId: 1,
          },
        });

        // Execute
        const result = await service.create(input);

        // Verify address was normalized
        expect(result.config.address).toBe(
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        );
      });

      it('should handle optional fields', async () => {
        const input = {
          tokenType: 'evm-erc20' as const,
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 18,
          logoUrl: 'https://example.com/logo.png',
          coingeckoId: 'test-token',
          marketCap: 1000000,
          config: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId: 1,
          },
        };

        // Mock: No duplicate
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Creation
        prismaMock.token.create.mockResolvedValue({
          id: 'token_test',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: input.name,
          symbol: input.symbol,
          decimals: input.decimals,
          logoUrl: input.logoUrl,
          coingeckoId: input.coingeckoId,
          marketCap: input.marketCap,
          config: input.config,
        });

        // Execute
        const result = await service.create(input);

        // Verify optional fields
        expect(result.logoUrl).toBe('https://example.com/logo.png');
        expect(result.coingeckoId).toBe('test-token');
        expect(result.marketCap).toBe(1000000);
      });

      it('should allow same address on different chains', async () => {
        const inputEth = {
          tokenType: 'evm-erc20' as const,
          name: 'USDC',
          symbol: 'USDC',
          decimals: 6,
          config: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId: 1, // Ethereum
          },
        };

        const inputArb = {
          ...inputEth,
          config: {
            ...inputEth.config,
            chainId: 42161, // Arbitrum
          },
        };

        // Mock: No duplicate for Arbitrum (even though Ethereum exists)
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Creation
        prismaMock.token.create.mockResolvedValue({
          id: 'token_usdc_arb',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: inputArb.name,
          symbol: inputArb.symbol,
          decimals: inputArb.decimals,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: inputArb.config,
        });

        // Execute
        const result = await service.create(inputArb);

        // Verify different chain allowed
        expect(result.config.chainId).toBe(42161);
      });

      it('should handle tokens with special characters', async () => {
        const input = {
          tokenType: 'evm-erc20' as const,
          name: 'Token 中文 🚀',
          symbol: '$MEME',
          decimals: 18,
          config: {
            address: '0x8888888888888888888888888888888888888888',
            chainId: 1,
          },
        };

        // Mock: No duplicate
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Creation
        prismaMock.token.create.mockResolvedValue({
          id: 'token_special',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: input.name,
          symbol: input.symbol,
          decimals: input.decimals,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: input.config,
        });

        // Execute
        const result = await service.create(input);

        // Verify special characters preserved
        expect(result.name).toBe('Token 中文 🚀');
        expect(result.symbol).toBe('$MEME');
      });
    });

    describe('validation errors', () => {
      it('should throw error for invalid address format', async () => {
        const input = {
          tokenType: 'evm-erc20' as const,
          name: 'Test',
          symbol: 'TEST',
          decimals: 18,
          config: {
            address: 'invalid-address',
            chainId: 1,
          },
        };

        await expect(service.create(input)).rejects.toThrow(
          'Invalid Ethereum address format'
        );

        // Should fail before DB operations
        expect(prismaMock.token.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.token.create).not.toHaveBeenCalled();
      });

      it('should throw error for too short address', async () => {
        const input = {
          tokenType: 'evm-erc20' as const,
          name: 'Test',
          symbol: 'TEST',
          decimals: 18,
          config: {
            address: '0x123',
            chainId: 1,
          },
        };

        await expect(service.create(input)).rejects.toThrow(
          'Invalid Ethereum address format'
        );
      });

      it('should throw error for address without 0x prefix', async () => {
        const input = {
          tokenType: 'evm-erc20' as const,
          name: 'Test',
          symbol: 'TEST',
          decimals: 18,
          config: {
            address: 'A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId: 1,
          },
        };

        await expect(service.create(input)).rejects.toThrow(
          'Invalid Ethereum address format'
        );
      });
    });

    describe('edge cases', () => {
      it('should handle zero decimals', async () => {
        const input = {
          tokenType: 'evm-erc20' as const,
          name: 'Zero Decimals',
          symbol: 'ZERO',
          decimals: 0,
          config: {
            address: '0xcccccccccccccccccccccccccccccccccccccccc',
            chainId: 1,
          },
        };

        // Mock: No duplicate
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Creation
        prismaMock.token.create.mockResolvedValue({
          id: 'token_zero',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: input.name,
          symbol: input.symbol,
          decimals: input.decimals,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: input.config,
        });

        // Execute
        const result = await service.create(input);

        // Verify
        expect(result.decimals).toBe(0);
      });

      it('should handle high decimals', async () => {
        const input = {
          tokenType: 'evm-erc20' as const,
          name: 'High Decimals',
          symbol: 'HIGH',
          decimals: 77,
          config: {
            address: '0xdddddddddddddddddddddddddddddddddddddddd',
            chainId: 1,
          },
        };

        // Mock: No duplicate
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Creation
        prismaMock.token.create.mockResolvedValue({
          id: 'token_high',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: input.name,
          symbol: input.symbol,
          decimals: input.decimals,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: input.config,
        });

        // Execute
        const result = await service.create(input);

        // Verify
        expect(result.decimals).toBe(77);
      });

      it('should handle zero marketCap', async () => {
        const input = {
          tokenType: 'evm-erc20' as const,
          name: 'Zero MarketCap',
          symbol: 'ZMC',
          decimals: 18,
          marketCap: 0,
          config: {
            address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            chainId: 1,
          },
        };

        // Mock: No duplicate
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Creation
        prismaMock.token.create.mockResolvedValue({
          id: 'token_zmc',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: input.name,
          symbol: input.symbol,
          decimals: input.decimals,
          logoUrl: null,
          coingeckoId: null,
          marketCap: input.marketCap,
          config: input.config,
        });

        // Execute
        const result = await service.create(input);

        // Verify
        expect(result.marketCap).toBe(0);
      });
    });
  });

  // ==========================================================================
  // Find By Address and Chain Tests
  // ==========================================================================

  describe('findByAddressAndChain', () => {
    describe('successful queries', () => {
      it('should find existing token', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findFirst.mockResolvedValue(dbResult);

        // Execute
        const result = await service.findByAddressAndChain(
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          1
        );

        // Verify
        expect(result).not.toBeNull();
        expect(result?.symbol).toBe('USDC');
        expect(result?.config.chainId).toBe(1);

        // Verify query was made
        expect(prismaMock.token.findFirst).toHaveBeenCalledTimes(1);
      });

      it('should return null when token not found', async () => {
        // Mock: Token doesn't exist
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Execute
        const result = await service.findByAddressAndChain(
          '0x9999999999999999999999999999999999999999',
          1
        );

        // Verify
        expect(result).toBeNull();
      });

      it('should normalize lowercase address', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findFirst.mockResolvedValue(dbResult);

        // Execute with lowercase address
        await service.findByAddressAndChain(
          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          1
        );

        // Verify query used normalized address
        expect(prismaMock.token.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              config: expect.objectContaining({
                path: ['address'],
                equals: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              }),
            }),
          })
        );
      });

      it('should normalize mixed case address', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findFirst.mockResolvedValue(dbResult);

        // Execute with mixed case address (not proper checksum)
        await service.findByAddressAndChain(
          '0xa0B86991c6218b36c1d19d4A2e9Eb0cE3606eB48',
          1
        );

        // Verify query used normalized address
        expect(prismaMock.token.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              config: expect.objectContaining({
                path: ['address'],
                equals: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              }),
            }),
          })
        );
      });

      it('should distinguish between different chains', async () => {
        // Mock: Token exists on Ethereum
        prismaMock.token.findFirst.mockResolvedValue({
          id: 'token_usdc_eth',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: 'USDC',
          symbol: 'USDC',
          decimals: 6,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId: 1,
          },
        });

        // Execute
        const result = await service.findByAddressAndChain(
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          1 // Ethereum
        );

        // Verify
        expect(result?.config.chainId).toBe(1);

        // Verify query included chainId filter
        expect(prismaMock.token.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              AND: expect.objectContaining({
                config: expect.objectContaining({
                  path: ['chainId'],
                  equals: 1,
                }),
              }),
            }),
          })
        );
      });
    });

    describe('validation errors', () => {
      it('should throw error for invalid address format', async () => {
        await expect(
          service.findByAddressAndChain('invalid-address', 1)
        ).rejects.toThrow('Invalid Ethereum address format');

        // Should fail before DB query
        expect(prismaMock.token.findFirst).not.toHaveBeenCalled();
      });

      it('should throw error for too short address', async () => {
        await expect(
          service.findByAddressAndChain('0x123', 1)
        ).rejects.toThrow('Invalid Ethereum address format');
      });

      it('should throw error for address without 0x prefix', async () => {
        await expect(
          service.findByAddressAndChain(
            'A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            1
          )
        ).rejects.toThrow('Invalid Ethereum address format');
      });
    });
  });

  // ==========================================================================
  // Find By ID Tests
  // ==========================================================================

  describe('findById', () => {
    it('should find existing ERC-20 token', async () => {
      const { dbResult } = USDC_ETHEREUM;

      // Mock: Token exists
      prismaMock.token.findUnique.mockResolvedValue(dbResult);

      // Execute
      const result = await service.findById('token_usdc_eth_001');

      // Verify
      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('USDC');
      expect(result?.tokenType).toBe('evm-erc20');
    });

    it('should return null when token not found', async () => {
      // Mock: Token doesn't exist
      prismaMock.token.findUnique.mockResolvedValue(null);

      // Execute
      const result = await service.findById('nonexistent_token');

      // Verify
      expect(result).toBeNull();
    });

    it('should return null when token is not ERC-20', async () => {
      // Mock: Token exists but is Solana SPL type
      prismaMock.token.findUnique.mockResolvedValue({
        id: 'token_sol_001',
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenType: 'solana-spl', // Not ERC-20!
        name: 'Wrapped SOL',
        symbol: 'SOL',
        decimals: 9,
        logoUrl: null,
        coingeckoId: null,
        marketCap: null,
        config: {
          mint: 'So11111111111111111111111111111111111111112',
        },
      });

      // Execute
      const result = await service.findById('token_sol_001');

      // Verify: Returns null because it's not ERC-20
      expect(result).toBeNull();
    });

    it('should include all token fields', async () => {
      // Mock: Token with optional fields
      prismaMock.token.findUnique.mockResolvedValue({
        id: 'token_complete',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        tokenType: 'evm-erc20',
        name: 'Complete Token',
        symbol: 'COMP',
        decimals: 18,
        logoUrl: 'https://example.com/logo.png',
        coingeckoId: 'complete-token',
        marketCap: 5000000,
        config: {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 1,
        },
      });

      // Execute
      const result = await service.findById('token_complete');

      // Verify all fields
      expect(result?.id).toBe('token_complete');
      expect(result?.name).toBe('Complete Token');
      expect(result?.symbol).toBe('COMP');
      expect(result?.decimals).toBe(18);
      expect(result?.logoUrl).toBe('https://example.com/logo.png');
      expect(result?.coingeckoId).toBe('complete-token');
      expect(result?.marketCap).toBe(5000000);
      expect(result?.config.address).toBe(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      );
      expect(result?.config.chainId).toBe(1);
    });

    it('should handle tokens without optional fields', async () => {
      // Mock: Token without optional fields
      prismaMock.token.findUnique.mockResolvedValue({
        id: 'token_minimal',
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenType: 'evm-erc20',
        name: 'Minimal Token',
        symbol: 'MIN',
        decimals: 18,
        logoUrl: null,
        coingeckoId: null,
        marketCap: null,
        config: {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 1,
        },
      });

      // Execute
      const result = await service.findById('token_minimal');

      // Verify optional fields are undefined
      expect(result?.logoUrl).toBeUndefined();
      expect(result?.coingeckoId).toBeUndefined();
      expect(result?.marketCap).toBeUndefined();
    });

    it('should map dates correctly', async () => {
      const createdDate = new Date('2024-01-01T10:00:00Z');
      const updatedDate = new Date('2024-01-02T15:30:00Z');

      // Mock: Token with specific dates
      prismaMock.token.findUnique.mockResolvedValue({
        id: 'token_dates',
        createdAt: createdDate,
        updatedAt: updatedDate,
        tokenType: 'evm-erc20',
        name: 'Date Token',
        symbol: 'DATE',
        decimals: 18,
        logoUrl: null,
        coingeckoId: null,
        marketCap: null,
        config: {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 1,
        },
      });

      // Execute
      const result = await service.findById('token_dates');

      // Verify dates
      expect(result?.createdAt).toEqual(createdDate);
      expect(result?.updatedAt).toEqual(updatedDate);
    });
  });

  // ==========================================================================
  // Update Tests
  // ==========================================================================

  describe('update', () => {
    describe('successful updates', () => {
      it('should update basic fields', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findUnique.mockResolvedValue(dbResult);

        // Mock: Update succeeds
        prismaMock.token.update.mockResolvedValue({
          ...dbResult,
          name: 'USD Coin Updated',
          symbol: 'USDC2',
        });

        // Execute
        const result = await service.update('token_usdc_eth_001', {
          name: 'USD Coin Updated',
          symbol: 'USDC2',
        });

        // Verify
        expect(result.name).toBe('USD Coin Updated');
        expect(result.symbol).toBe('USDC2');

        // Verify update was called
        expect(prismaMock.token.update).toHaveBeenCalledTimes(1);
      });

      it('should update optional fields', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findUnique.mockResolvedValue(dbResult);

        // Mock: Update succeeds
        prismaMock.token.update.mockResolvedValue({
          ...dbResult,
          logoUrl: 'https://example.com/new-logo.png',
          coingeckoId: 'usdc-updated',
          marketCap: 35000000000,
        });

        // Execute
        const result = await service.update('token_usdc_eth_001', {
          logoUrl: 'https://example.com/new-logo.png',
          coingeckoId: 'usdc-updated',
          marketCap: 35000000000,
        });

        // Verify
        expect(result.logoUrl).toBe('https://example.com/new-logo.png');
        expect(result.coingeckoId).toBe('usdc-updated');
        expect(result.marketCap).toBe(35000000000);
      });

      it('should update address with normalization', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findUnique.mockResolvedValue(dbResult);

        const newAddress = '0xdac17f958d2ee523a2206206994597c13d831ec7'; // lowercase

        // Mock: Update succeeds
        prismaMock.token.update.mockResolvedValue({
          ...dbResult,
          config: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // normalized
            chainId: 1,
          },
        });

        // Execute
        const result = await service.update('token_usdc_eth_001', {
          config: {
            address: newAddress,
            chainId: 1,
          },
        });

        // Verify address was normalized
        expect(result.config.address).toBe(
          '0xdAC17F958D2ee523a2206206994597C13D831ec7'
        );
      });

      it('should update chainId in config', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findUnique.mockResolvedValue(dbResult);

        // Mock: Update succeeds
        prismaMock.token.update.mockResolvedValue({
          ...dbResult,
          config: {
            address: dbResult.config.address,
            chainId: 42161, // Arbitrum
          },
        });

        // Execute
        const result = await service.update('token_usdc_eth_001', {
          config: {
            address: dbResult.config.address,
            chainId: 42161,
          },
        });

        // Verify
        expect(result.config.chainId).toBe(42161);
      });

      it('should handle partial updates', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findUnique.mockResolvedValue(dbResult);

        // Mock: Update only name
        prismaMock.token.update.mockResolvedValue({
          ...dbResult,
          name: 'Updated Name Only',
        });

        // Execute (only update name)
        const result = await service.update('token_usdc_eth_001', {
          name: 'Updated Name Only',
        });

        // Verify only name changed
        expect(result.name).toBe('Updated Name Only');
        expect(result.symbol).toBe('USDC'); // Unchanged
        expect(result.decimals).toBe(6); // Unchanged
      });

      it('should update multiple fields at once', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findUnique.mockResolvedValue(dbResult);

        // Mock: Update multiple fields
        prismaMock.token.update.mockResolvedValue({
          ...dbResult,
          name: 'New Name',
          symbol: 'NEW',
          decimals: 18,
          logoUrl: 'https://example.com/logo.png',
          marketCap: 999999,
        });

        // Execute
        const result = await service.update('token_usdc_eth_001', {
          name: 'New Name',
          symbol: 'NEW',
          decimals: 18,
          logoUrl: 'https://example.com/logo.png',
          marketCap: 999999,
        });

        // Verify all updated
        expect(result.name).toBe('New Name');
        expect(result.symbol).toBe('NEW');
        expect(result.decimals).toBe(18);
        expect(result.logoUrl).toBe('https://example.com/logo.png');
        expect(result.marketCap).toBe(999999);
      });
    });

    describe('validation errors', () => {
      it('should throw error when token not found', async () => {
        // Mock: Token doesn't exist
        prismaMock.token.findUnique.mockResolvedValue(null);

        await expect(
          service.update('nonexistent_token', { name: 'New Name' })
        ).rejects.toThrow('Token with id nonexistent_token not found');

        // Verify update was not attempted
        expect(prismaMock.token.update).not.toHaveBeenCalled();
      });

      it('should throw error when token is not ERC-20', async () => {
        // Mock: Token exists but is Solana type
        prismaMock.token.findUnique.mockResolvedValue({
          id: 'token_sol_001',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'solana-spl', // Not ERC-20!
          name: 'Wrapped SOL',
          symbol: 'SOL',
          decimals: 9,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: {
            mint: 'So11111111111111111111111111111111111111112',
          },
        });

        await expect(
          service.update('token_sol_001', { name: 'New Name' })
        ).rejects.toThrow('is not an ERC-20 token');

        // Verify update was not attempted
        expect(prismaMock.token.update).not.toHaveBeenCalled();
      });

      it('should throw error for invalid address in config update', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findUnique.mockResolvedValue(dbResult);

        await expect(
          service.update('token_usdc_eth_001', {
            config: {
              address: 'invalid-address',
              chainId: 1,
            },
          })
        ).rejects.toThrow('Invalid Ethereum address format');

        // Verify update was not attempted
        expect(prismaMock.token.update).not.toHaveBeenCalled();
      });

      it('should throw error for too short address in config update', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findUnique.mockResolvedValue(dbResult);

        await expect(
          service.update('token_usdc_eth_001', {
            config: {
              address: '0x123',
              chainId: 1,
            },
          })
        ).rejects.toThrow('Invalid Ethereum address format');
      });
    });
  });

  // ==========================================================================
  // Delete Tests
  // ==========================================================================

  describe('delete', () => {
    it('should delete existing ERC-20 token', async () => {
      const { dbResult } = USDC_ETHEREUM;

      // Mock: Token exists
      prismaMock.token.findUnique.mockResolvedValue(dbResult);

      // Mock: Delete succeeds
      prismaMock.token.delete.mockResolvedValue(dbResult);

      // Execute
      await service.delete('token_usdc_eth_001');

      // Verify delete was called
      expect(prismaMock.token.delete).toHaveBeenCalledWith({
        where: { id: 'token_usdc_eth_001' },
      });
    });

    it('should throw error when token not found', async () => {
      // Mock: Token doesn't exist
      prismaMock.token.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent_token')).rejects.toThrow(
        'Token with id nonexistent_token not found'
      );

      // Verify delete was not attempted
      expect(prismaMock.token.delete).not.toHaveBeenCalled();
    });

    it('should throw error when token is not ERC-20', async () => {
      // Mock: Token exists but is Solana type
      prismaMock.token.findUnique.mockResolvedValue({
        id: 'token_sol_001',
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenType: 'solana-spl', // Not ERC-20!
        name: 'Wrapped SOL',
        symbol: 'SOL',
        decimals: 9,
        logoUrl: null,
        coingeckoId: null,
        marketCap: null,
        config: {
          mint: 'So11111111111111111111111111111111111111112',
        },
      });

      await expect(service.delete('token_sol_001')).rejects.toThrow(
        'is not an ERC-20 token'
      );

      // Verify delete was not attempted
      expect(prismaMock.token.delete).not.toHaveBeenCalled();
    });

    it('should verify token type before deletion', async () => {
      const { dbResult } = USDC_ETHEREUM;

      // Mock: Token exists and is ERC-20
      prismaMock.token.findUnique.mockResolvedValue(dbResult);

      // Mock: Delete succeeds
      prismaMock.token.delete.mockResolvedValue(dbResult);

      // Execute
      await service.delete('token_usdc_eth_001');

      // Verify existence check was performed first
      expect(prismaMock.token.findUnique).toHaveBeenCalledWith({
        where: { id: 'token_usdc_eth_001' },
      });
    });

    it('should not return anything on successful deletion', async () => {
      const { dbResult } = USDC_ETHEREUM;

      // Mock: Token exists
      prismaMock.token.findUnique.mockResolvedValue(dbResult);

      // Mock: Delete succeeds
      prismaMock.token.delete.mockResolvedValue(dbResult);

      // Execute
      const result = await service.delete('token_usdc_eth_001');

      // Verify returns void (undefined)
      expect(result).toBeUndefined();
    });

    it('should handle deletion with all safeguards', async () => {
      const { dbResult } = USDC_ETHEREUM;

      // Mock: Token exists and is ERC-20
      prismaMock.token.findUnique.mockResolvedValue(dbResult);

      // Mock: Delete succeeds
      prismaMock.token.delete.mockResolvedValue(dbResult);

      // Execute
      await service.delete('token_usdc_eth_001');

      // Verify both checks were performed
      expect(prismaMock.token.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.token.delete).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Token Discovery Tests
  // ==========================================================================

  describe('discoverToken', () => {
    describe('successful discovery', () => {
      it('should discover new token from contract', async () => {
        const { input, dbResult } = DISCOVERED_TOKEN;

        // Mock: Token doesn't exist in DB (both checks: in discoverToken and in create)
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Chain is supported
        evmConfigMock.isChainSupported.mockReturnValue(true);
        evmConfigMock.getSupportedChainIds.mockReturnValue([1, 42161]);

        // Mock: Get public client
        evmConfigMock.getPublicClient.mockReturnValue(
          publicClientMock as unknown as PublicClient
        );

        // Mock: Contract read returns metadata
        publicClientMock.multicall.mockResolvedValue([
          input.name,
          input.symbol,
          input.decimals,
        ]);

        // Mock: Token creation
        prismaMock.token.create.mockResolvedValue(dbResult);

        // Execute
        const result = await service.discoverToken(
          input.config.address,
          input.config.chainId
        );

        // Verify
        expect(result.name).toBe('Discovered Token');
        expect(result.symbol).toBe('DISC');
        expect(result.decimals).toBe(18);

        // Verify DB lookup was attempted (twice: once in discoverToken, once in create's duplicate check)
        expect(prismaMock.token.findFirst).toHaveBeenCalledTimes(2);

        // Verify chain support check
        expect(evmConfigMock.isChainSupported).toHaveBeenCalledWith(1);

        // Verify public client was requested
        expect(evmConfigMock.getPublicClient).toHaveBeenCalledWith(1);

        // Verify multicall was made
        expect(publicClientMock.multicall).toHaveBeenCalledTimes(1);

        // Verify token was created
        expect(prismaMock.token.create).toHaveBeenCalledTimes(1);
      });

      it('should return existing token without RPC call', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists in DB
        prismaMock.token.findFirst.mockResolvedValue(dbResult);

        // Execute
        const result = await service.discoverToken(
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          1
        );

        // Verify
        expect(result.symbol).toBe('USDC');

        // Verify DB lookup was attempted
        expect(prismaMock.token.findFirst).toHaveBeenCalledTimes(1);

        // Verify no chain operations (token already existed)
        expect(evmConfigMock.isChainSupported).not.toHaveBeenCalled();
        expect(evmConfigMock.getPublicClient).not.toHaveBeenCalled();
        expect(publicClientMock.multicall).not.toHaveBeenCalled();
        expect(prismaMock.token.create).not.toHaveBeenCalled();
      });

      it('should normalize address before lookup', async () => {
        const { dbResult } = USDC_ETHEREUM;

        // Mock: Token exists
        prismaMock.token.findFirst.mockResolvedValue(dbResult);

        // Execute with lowercase address
        await service.discoverToken(
          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          1
        );

        // Verify findFirst was called with normalized (checksummed) address
        expect(prismaMock.token.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              config: expect.objectContaining({
                path: ['address'],
                equals: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              }),
            }),
          })
        );
      });

      it('should handle tokens with special characters', async () => {
        const tokenWithSpecialChars = {
          name: 'Token 中文 🚀',
          symbol: '$MEME',
          decimals: 18,
          address: '0x8888888888888888888888888888888888888888',
          chainId: 1,
        };

        // Mock: Token doesn't exist
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Chain supported
        evmConfigMock.isChainSupported.mockReturnValue(true);
        evmConfigMock.getSupportedChainIds.mockReturnValue([1]);

        // Mock: Public client
        evmConfigMock.getPublicClient.mockReturnValue(
          publicClientMock as unknown as PublicClient
        );

        // Mock: Contract returns special chars
        publicClientMock.multicall.mockResolvedValue([
          tokenWithSpecialChars.name,
          tokenWithSpecialChars.symbol,
          tokenWithSpecialChars.decimals,
        ]);

        // Mock: Create token
        prismaMock.token.create.mockResolvedValue({
          id: 'token_special',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          ...tokenWithSpecialChars,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: {
            address: tokenWithSpecialChars.address,
            chainId: tokenWithSpecialChars.chainId,
          },
        });

        // Execute
        const result = await service.discoverToken(
          tokenWithSpecialChars.address,
          tokenWithSpecialChars.chainId
        );

        // Verify special characters preserved
        expect(result.name).toBe('Token 中文 🚀');
        expect(result.symbol).toBe('$MEME');
      });
    });

    describe('validation errors', () => {
      it('should throw error for invalid address format', async () => {
        await expect(
          service.discoverToken('invalid-address', 1)
        ).rejects.toThrow('Invalid Ethereum address format');

        // Should fail before DB lookup
        expect(prismaMock.token.findFirst).not.toHaveBeenCalled();
      });

      it('should throw error for too short address', async () => {
        await expect(service.discoverToken('0x123', 1)).rejects.toThrow(
          'Invalid Ethereum address format'
        );
      });

      it('should throw error for address without 0x prefix', async () => {
        await expect(
          service.discoverToken(
            'A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            1
          )
        ).rejects.toThrow('Invalid Ethereum address format');
      });

      it('should throw error for unsupported chain ID', async () => {
        // Mock: Token doesn't exist
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Chain not supported
        evmConfigMock.isChainSupported.mockReturnValue(false);
        evmConfigMock.getSupportedChainIds.mockReturnValue([1, 42161]);

        await expect(
          service.discoverToken(
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            999999
          )
        ).rejects.toThrow('Chain 999999 is not configured');

        await expect(
          service.discoverToken(
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            999999
          )
        ).rejects.toThrow('Supported chains: 1, 42161');
      });
    });

    describe('contract errors', () => {
      it('should throw TokenMetadataError for non-compliant contract', async () => {
        // Mock: Token doesn't exist
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Chain supported
        evmConfigMock.isChainSupported.mockReturnValue(true);

        // Mock: Public client
        evmConfigMock.getPublicClient.mockReturnValue(
          publicClientMock as unknown as PublicClient
        );

        // Mock: Contract doesn't implement name()
        publicClientMock.multicall.mockResolvedValue(['', 'TOKEN', 18]);

        await expect(
          service.discoverToken(
            NON_COMPLIANT_TOKEN.address,
            NON_COMPLIANT_TOKEN.chainId
          )
        ).rejects.toThrow(TokenMetadataError);

        await expect(
          service.discoverToken(
            NON_COMPLIANT_TOKEN.address,
            NON_COMPLIANT_TOKEN.chainId
          )
        ).rejects.toThrow('does not implement name()');
      });

      it('should throw error for contract execution revert', async () => {
        // Mock: Token doesn't exist
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Chain supported
        evmConfigMock.isChainSupported.mockReturnValue(true);

        // Mock: Public client
        evmConfigMock.getPublicClient.mockReturnValue(
          publicClientMock as unknown as PublicClient
        );

        // Mock: Contract call reverts
        const revertError = new Error('execution reverted');
        publicClientMock.multicall.mockRejectedValue(revertError);

        await expect(
          service.discoverToken(
            '0x9999999999999999999999999999999999999999',
            1
          )
        ).rejects.toThrow(TokenMetadataError);

        await expect(
          service.discoverToken(
            '0x9999999999999999999999999999999999999999',
            1
          )
        ).rejects.toThrow('execution reverted');
      });

      it('should throw error for non-contract address', async () => {
        // Mock: Token doesn't exist
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Chain supported
        evmConfigMock.isChainSupported.mockReturnValue(true);

        // Mock: Public client
        evmConfigMock.getPublicClient.mockReturnValue(
          publicClientMock as unknown as PublicClient
        );

        // Mock: No code at address
        const codeNotFoundError = new Error('Code not found');
        publicClientMock.multicall.mockRejectedValue(codeNotFoundError);

        await expect(
          service.discoverToken(
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            1
          )
        ).rejects.toThrow(TokenMetadataError);
      });

      it('should wrap network errors in TokenMetadataError', async () => {
        // Mock: Token doesn't exist
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Chain supported
        evmConfigMock.isChainSupported.mockReturnValue(true);

        // Mock: Public client
        evmConfigMock.getPublicClient.mockReturnValue(
          publicClientMock as unknown as PublicClient
        );

        // Mock: Network error
        const networkError = new Error('Network request failed');
        publicClientMock.multicall.mockRejectedValue(networkError);

        await expect(
          service.discoverToken(
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            1
          )
        ).rejects.toThrow(TokenMetadataError);

        await expect(
          service.discoverToken(
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            1
          )
        ).rejects.toThrow('Network request failed');
      });
    });

    describe('edge cases', () => {
      it('should handle 0 decimals', async () => {
        // Mock: Token doesn't exist
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Chain supported
        evmConfigMock.isChainSupported.mockReturnValue(true);

        // Mock: Public client
        evmConfigMock.getPublicClient.mockReturnValue(
          publicClientMock as unknown as PublicClient
        );

        // Mock: Contract returns 0 decimals
        publicClientMock.multicall.mockResolvedValue([
          'Zero Decimals',
          'ZERO',
          0,
        ]);

        // Mock: Create token
        prismaMock.token.create.mockResolvedValue({
          id: 'token_zero',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: 'Zero Decimals',
          symbol: 'ZERO',
          decimals: 0,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: {
            address: '0xcccccccccccccccccccccccccccccccccccccccc',
            chainId: 1,
          },
        });

        const result = await service.discoverToken(
          '0xcccccccccccccccccccccccccccccccccccccccc',
          1
        );

        expect(result.decimals).toBe(0);
      });

      it('should handle different chain IDs', async () => {
        // Mock: Token doesn't exist
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Arbitrum supported
        evmConfigMock.isChainSupported.mockReturnValue(true);

        // Mock: Public client for Arbitrum
        evmConfigMock.getPublicClient.mockReturnValue(
          publicClientMock as unknown as PublicClient
        );

        // Mock: Contract read
        publicClientMock.multicall.mockResolvedValue(['USDC', 'USDC', 6]);

        // Mock: Create token
        prismaMock.token.create.mockResolvedValue({
          id: 'token_usdc_arb',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'evm-erc20',
          name: 'USDC',
          symbol: 'USDC',
          decimals: 6,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: {
            address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            chainId: 42161,
          },
        });

        const result = await service.discoverToken(
          '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
          42161
        );

        expect(result.config.chainId).toBe(42161);
        expect(evmConfigMock.getPublicClient).toHaveBeenCalledWith(42161);
      });

      it('should only make one multicall per discovery', async () => {
        const { input, dbResult } = DISCOVERED_TOKEN;

        // Mock: Token doesn't exist
        prismaMock.token.findFirst.mockResolvedValue(null);

        // Mock: Chain supported
        evmConfigMock.isChainSupported.mockReturnValue(true);
        evmConfigMock.getSupportedChainIds.mockReturnValue([1]);

        // Mock: Public client
        evmConfigMock.getPublicClient.mockReturnValue(
          publicClientMock as unknown as PublicClient
        );

        // Mock: Contract read
        publicClientMock.multicall.mockResolvedValue([
          input.name,
          input.symbol,
          input.decimals,
        ]);

        // Mock: Create
        prismaMock.token.create.mockResolvedValue(dbResult);

        await service.discoverToken(input.config.address, input.config.chainId);

        // Should only call multicall once (efficient batch read)
        expect(publicClientMock.multicall).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ==========================================================================
  // EnrichToken Tests
  // ==========================================================================

  describe('enrichToken', () => {
    const mockEnrichmentData = {
      coingeckoId: 'usd-coin',
      logoUrl: 'https://example.com/usdc-logo.png',
      marketCap: 28000000000,
      symbol: 'USDC',
      name: 'USD Coin',
    };

    let coinGeckoClientMock: any;

    beforeEach(() => {
      // Mock CoinGecko client
      coinGeckoClientMock = {
        getErc20EnrichmentData: vi.fn(),
      };

      // Recreate service with mocked CoinGecko client
      service = new Erc20TokenService({
        prisma: prismaMock as unknown as PrismaClient,
        evmConfig: evmConfigMock as unknown as EvmConfig,
        coinGeckoClient: coinGeckoClientMock,
      });
    });

    describe('successful enrichment', () => {
      it('should enrich token with CoinGecko data', async () => {
        const tokenWithoutEnrichment = {
          ...USDC_ETHEREUM.dbResult,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
        };

        // Mock: Token exists in database
        prismaMock.token.findUnique.mockResolvedValue(tokenWithoutEnrichment);

        // Mock: CoinGecko enrichment data
        coinGeckoClientMock.getErc20EnrichmentData.mockResolvedValue(
          mockEnrichmentData
        );

        // Mock: Token update
        const enrichedToken = {
          ...tokenWithoutEnrichment,
          logoUrl: mockEnrichmentData.logoUrl,
          coingeckoId: mockEnrichmentData.coingeckoId,
          marketCap: mockEnrichmentData.marketCap,
        };
        prismaMock.token.update.mockResolvedValue(enrichedToken);

        const result = await service.enrichToken(tokenWithoutEnrichment.id);

        // Should load token from database
        expect(prismaMock.token.findUnique).toHaveBeenCalledWith({
          where: { id: tokenWithoutEnrichment.id },
        });

        // Should fetch enrichment data from CoinGecko
        expect(coinGeckoClientMock.getErc20EnrichmentData).toHaveBeenCalledWith(
          tokenWithoutEnrichment.config.chainId,
          tokenWithoutEnrichment.config.address
        );

        // Should update token with enrichment data
        expect(prismaMock.token.update).toHaveBeenCalledWith({
          where: { id: tokenWithoutEnrichment.id },
          data: {
            logoUrl: mockEnrichmentData.logoUrl,
            coingeckoId: mockEnrichmentData.coingeckoId,
            marketCap: mockEnrichmentData.marketCap,
          },
        });

        // Should return enriched token
        expect(result.logoUrl).toBe(mockEnrichmentData.logoUrl);
        expect(result.coingeckoId).toBe(mockEnrichmentData.coingeckoId);
        expect(result.marketCap).toBe(mockEnrichmentData.marketCap);
      });

      it('should handle tokens without existing enrichment data', async () => {
        const tokenWithoutEnrichment = {
          ...USDC_ETHEREUM.dbResult,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
        };

        prismaMock.token.findUnique.mockResolvedValue(
          tokenWithoutEnrichment
        );
        coinGeckoClientMock.getErc20EnrichmentData.mockResolvedValue(
          mockEnrichmentData
        );

        const enrichedToken = {
          ...tokenWithoutEnrichment,
          logoUrl: mockEnrichmentData.logoUrl,
          coingeckoId: mockEnrichmentData.coingeckoId,
          marketCap: mockEnrichmentData.marketCap,
        };
        prismaMock.token.update.mockResolvedValue(enrichedToken);

        const result = await service.enrichToken(tokenWithoutEnrichment.id);

        expect(result.logoUrl).toBe(mockEnrichmentData.logoUrl);
        expect(result.coingeckoId).toBe(mockEnrichmentData.coingeckoId);
        expect(result.marketCap).toBe(mockEnrichmentData.marketCap);
      });

      it('should skip enrichment if token already has coingeckoId', async () => {
        const alreadyEnrichedToken = {
          ...USDC_ETHEREUM.dbResult,
          logoUrl: 'https://existing-logo.com/usdc.png',
          coingeckoId: 'usd-coin',
          marketCap: 27000000000,
        };

        prismaMock.token.findUnique.mockResolvedValue(alreadyEnrichedToken);

        const result = await service.enrichToken(alreadyEnrichedToken.id);

        // Should return existing token without calling CoinGecko
        expect(coinGeckoClientMock.getErc20EnrichmentData).not.toHaveBeenCalled();
        expect(prismaMock.token.update).not.toHaveBeenCalled();

        // Should return token with existing enrichment data
        expect(result.coingeckoId).toBe('usd-coin');
        expect(result.logoUrl).toBe('https://existing-logo.com/usdc.png');
        expect(result.marketCap).toBe(27000000000);
      });
    });

    describe('error handling', () => {
      it('should throw error if token not found in database', async () => {
        prismaMock.token.findUnique.mockResolvedValue(null);

        await expect(
          service.enrichToken('non-existent-token-id')
        ).rejects.toThrow('Token with id non-existent-token-id not found');

        // Should not call CoinGecko or update
        expect(coinGeckoClientMock.getErc20EnrichmentData).not.toHaveBeenCalled();
        expect(prismaMock.token.update).not.toHaveBeenCalled();
      });

      it('should throw error if token is not ERC-20 type', async () => {
        const solanaToken = {
          id: 'token_solana_001',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenType: 'solana-spl',
          name: 'Wrapped SOL',
          symbol: 'SOL',
          decimals: 9,
          logoUrl: null,
          coingeckoId: null,
          marketCap: null,
          config: {
            mint: 'So11111111111111111111111111111111111111112',
          },
        };

        prismaMock.token.findUnique.mockResolvedValue(solanaToken);

        await expect(service.enrichToken(solanaToken.id)).rejects.toThrow(
          `Token ${solanaToken.id} is not an ERC-20 token (type: solana-spl)`
        );

        // Should not call CoinGecko or update
        expect(coinGeckoClientMock.getErc20EnrichmentData).not.toHaveBeenCalled();
        expect(prismaMock.token.update).not.toHaveBeenCalled();
      });

      it('should throw error if token not found in CoinGecko', async () => {
        const tokenWithoutEnrichment = {
          ...USDC_ETHEREUM.dbResult,
          coingeckoId: null,
        };

        prismaMock.token.findUnique.mockResolvedValue(tokenWithoutEnrichment);

        // Mock: Token not found in CoinGecko
        const error = new Error('Token not found in CoinGecko');
        error.name = 'TokenNotFoundInCoinGeckoError';
        coinGeckoClientMock.getErc20EnrichmentData.mockRejectedValue(error);

        await expect(service.enrichToken(tokenWithoutEnrichment.id)).rejects.toThrow(
          'Token not found in CoinGecko'
        );

        // Should not update token
        expect(prismaMock.token.update).not.toHaveBeenCalled();
      });

      it('should throw error if CoinGecko API fails', async () => {
        const tokenWithoutEnrichment = {
          ...USDC_ETHEREUM.dbResult,
          coingeckoId: null,
        };

        prismaMock.token.findUnique.mockResolvedValue(tokenWithoutEnrichment);

        // Mock: CoinGecko API error
        const error = new Error('CoinGecko API error: 429 Too Many Requests');
        error.name = 'CoinGeckoApiError';
        coinGeckoClientMock.getErc20EnrichmentData.mockRejectedValue(error);

        await expect(service.enrichToken(tokenWithoutEnrichment.id)).rejects.toThrow(
          'CoinGecko API error: 429 Too Many Requests'
        );

        // Should not update token
        expect(prismaMock.token.update).not.toHaveBeenCalled();
      });
    });

    describe('integration with address normalization', () => {
      it('should work with any case address in token config', async () => {
        const tokenWithLowercaseAddress = {
          ...USDC_ETHEREUM.dbResult,
          coingeckoId: null,
          config: {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // lowercase
            chainId: 1,
          },
        };

        prismaMock.token.findUnique.mockResolvedValue(
          tokenWithLowercaseAddress
        );
        coinGeckoClientMock.getErc20EnrichmentData.mockResolvedValue(
          mockEnrichmentData
        );

        const enrichedToken = {
          ...tokenWithLowercaseAddress,
          logoUrl: mockEnrichmentData.logoUrl,
          coingeckoId: mockEnrichmentData.coingeckoId,
          marketCap: mockEnrichmentData.marketCap,
        };
        prismaMock.token.update.mockResolvedValue(enrichedToken);

        await service.enrichToken(tokenWithLowercaseAddress.id);

        // Should pass lowercase address to CoinGecko (it handles normalization)
        expect(coinGeckoClientMock.getErc20EnrichmentData).toHaveBeenCalledWith(
          1,
          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
        );
      });
    });
  });
});
