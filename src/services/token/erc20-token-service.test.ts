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
});
