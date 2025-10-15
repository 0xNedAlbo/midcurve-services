/**
 * Comprehensive tests for TokenService
 * Tests CRUD operations with mocked Prisma client
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { TokenService } from './token-service.js';
import {
  USDC_ETHEREUM,
  WETH_ETHEREUM,
  DAI_ETHEREUM,
  USDC_ARBITRUM,
  USDC_BASE,
  WSOL_SOLANA,
  USDC_SOLANA,
  MINIMAL_ERC20,
  SPECIAL_CHARS_TOKEN,
  ZERO_MARKET_CAP_TOKEN,
  HIGH_DECIMALS_TOKEN,
  ZERO_DECIMALS_TOKEN,
  ERC20_FIXTURES,
  SOLANA_FIXTURES,
  createTokenFixture,
} from './test-fixtures.js';

describe('TokenService', () => {
  let prismaMock: DeepMockProxy<PrismaClient>;
  let tokenService: TokenService;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    tokenService = new TokenService({
      prisma: prismaMock as unknown as PrismaClient,
    });
  });

  // ==========================================================================
  // Constructor & Dependency Injection Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create instance with provided Prisma client', () => {
      const service = new TokenService({
        prisma: prismaMock as unknown as PrismaClient,
      });
      expect(service).toBeInstanceOf(TokenService);
    });

    it('should create instance with default Prisma client when not provided', () => {
      const service = new TokenService();
      expect(service).toBeInstanceOf(TokenService);
    });

    it('should accept empty dependencies object', () => {
      const service = new TokenService({});
      expect(service).toBeInstanceOf(TokenService);
    });
  });

  // ==========================================================================
  // Create Method - ERC-20 Tokens
  // ==========================================================================

  describe('create - ERC-20 tokens', () => {
    it('should create USDC on Ethereum with all fields', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_ETHEREUM.dbResult);

      const result = await tokenService.create(USDC_ETHEREUM.input);

      expect(result).toMatchObject({
        id: 'token_usdc_eth_001',
        tokenType: 'evm-erc20',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        logoUrl: 'https://example.com/usdc.png',
        coingeckoId: 'usd-coin',
        marketCap: 28000000000,
      });
      expect(result.config).toHaveProperty('address');
      expect(result.config).toHaveProperty('chainId', 1);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should create WETH on Ethereum', async () => {
      prismaMock.token.create.mockResolvedValue(WETH_ETHEREUM.dbResult);

      const result = await tokenService.create(WETH_ETHEREUM.input);

      expect(result.symbol).toBe('WETH');
      expect(result.decimals).toBe(18);
      expect(result.config).toHaveProperty(
        'address',
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      );
    });

    it('should create DAI without optional fields (converts null to undefined)', async () => {
      prismaMock.token.create.mockResolvedValue(DAI_ETHEREUM.dbResult);

      const result = await tokenService.create(DAI_ETHEREUM.input);

      expect(result.symbol).toBe('DAI');
      expect(result.logoUrl).toBeUndefined();
      expect(result.marketCap).toBeUndefined();
      expect(result.coingeckoId).toBe('dai');
    });

    it('should create USDC on Arbitrum with correct chainId', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_ARBITRUM.dbResult);

      const result = await tokenService.create(USDC_ARBITRUM.input);

      expect(result.symbol).toBe('USDC');
      expect(result.config).toHaveProperty('chainId', 42161);
      expect(result.config).toHaveProperty(
        'address',
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
      );
    });

    it('should create USDC on Base with correct chainId', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_BASE.dbResult);

      const result = await tokenService.create(USDC_BASE.input);

      expect(result.symbol).toBe('USDC');
      expect(result.config).toHaveProperty('chainId', 8453);
    });

    it('should pass all fields to Prisma create', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_ETHEREUM.dbResult);

      await tokenService.create(USDC_ETHEREUM.input);

      expect(prismaMock.token.create).toHaveBeenCalledWith({
        data: {
          tokenType: 'evm-erc20',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          logoUrl: 'https://example.com/usdc.png',
          coingeckoId: 'usd-coin',
          marketCap: 28000000000,
          config: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId: 1,
          },
        },
      });
    });
  });

  // ==========================================================================
  // Create Method - Solana Tokens
  // ==========================================================================

  describe('create - Solana tokens', () => {
    it('should create Wrapped SOL with all fields', async () => {
      prismaMock.token.create.mockResolvedValue(WSOL_SOLANA.dbResult);

      const result = await tokenService.create(WSOL_SOLANA.input);

      expect(result.tokenType).toBe('solana-spl');
      expect(result.symbol).toBe('SOL');
      expect(result.decimals).toBe(9);
      expect(result.config).toHaveProperty(
        'mint',
        'So11111111111111111111111111111111111111112'
      );
    });

    it('should create USDC on Solana with programId', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_SOLANA.dbResult);

      const result = await tokenService.create(USDC_SOLANA.input);

      expect(result.tokenType).toBe('solana-spl');
      expect(result.symbol).toBe('USDC');
      expect(result.config).toHaveProperty(
        'mint',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      );
      expect(result.config).toHaveProperty(
        'programId',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
      );
    });

    it('should pass Solana config correctly to Prisma', async () => {
      prismaMock.token.create.mockResolvedValue(WSOL_SOLANA.dbResult);

      await tokenService.create(WSOL_SOLANA.input);

      expect(prismaMock.token.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenType: 'solana-spl',
          config: {
            mint: 'So11111111111111111111111111111111111111112',
          },
        }),
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should create minimal token with only required fields', async () => {
      prismaMock.token.create.mockResolvedValue(MINIMAL_ERC20.dbResult);

      const result = await tokenService.create(MINIMAL_ERC20.input);

      expect(result.name).toBe('Minimal Token');
      expect(result.logoUrl).toBeUndefined();
      expect(result.coingeckoId).toBeUndefined();
      expect(result.marketCap).toBeUndefined();
    });

    it('should handle special characters in name and symbol', async () => {
      prismaMock.token.create.mockResolvedValue(SPECIAL_CHARS_TOKEN.dbResult);

      const result = await tokenService.create(SPECIAL_CHARS_TOKEN.input);

      expect(result.name).toBe('Ether.fi Staked ETH');
      expect(result.symbol).toBe('$MEME');
    });

    it('should handle zero marketCap', async () => {
      prismaMock.token.create.mockResolvedValue(
        ZERO_MARKET_CAP_TOKEN.dbResult
      );

      const result = await tokenService.create(ZERO_MARKET_CAP_TOKEN.input);

      expect(result.marketCap).toBe(0);
    });

    it('should handle high decimals (24)', async () => {
      prismaMock.token.create.mockResolvedValue(HIGH_DECIMALS_TOKEN.dbResult);

      const result = await tokenService.create(HIGH_DECIMALS_TOKEN.input);

      expect(result.decimals).toBe(24);
    });

    it('should handle zero decimals', async () => {
      prismaMock.token.create.mockResolvedValue(ZERO_DECIMALS_TOKEN.dbResult);

      const result = await tokenService.create(ZERO_DECIMALS_TOKEN.input);

      expect(result.decimals).toBe(0);
    });
  });

  // ==========================================================================
  // Type Conversions & Null Handling
  // ==========================================================================

  describe('type conversions', () => {
    it('should convert null logoUrl to undefined', async () => {
      const fixture = createTokenFixture({ logoUrl: undefined });
      const dbResult = { ...fixture.dbResult, logoUrl: null };
      prismaMock.token.create.mockResolvedValue(dbResult);

      const result = await tokenService.create(fixture.input);

      expect(result.logoUrl).toBeUndefined();
    });

    it('should convert null coingeckoId to undefined', async () => {
      const fixture = createTokenFixture({ coingeckoId: undefined });
      const dbResult = { ...fixture.dbResult, coingeckoId: null };
      prismaMock.token.create.mockResolvedValue(dbResult);

      const result = await tokenService.create(fixture.input);

      expect(result.coingeckoId).toBeUndefined();
    });

    it('should convert null marketCap to undefined', async () => {
      const fixture = createTokenFixture({ marketCap: undefined });
      const dbResult = { ...fixture.dbResult, marketCap: null };
      prismaMock.token.create.mockResolvedValue(dbResult);

      const result = await tokenService.create(fixture.input);

      expect(result.marketCap).toBeUndefined();
    });

    it('should preserve defined optional field values', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_ETHEREUM.dbResult);

      const result = await tokenService.create(USDC_ETHEREUM.input);

      expect(result.logoUrl).toBe('https://example.com/usdc.png');
      expect(result.coingeckoId).toBe('usd-coin');
      expect(result.marketCap).toBe(28000000000);
    });

    it('should cast tokenType to correct union type', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_ETHEREUM.dbResult);

      const result = await tokenService.create(USDC_ETHEREUM.input);

      expect(result.tokenType).toBe('evm-erc20');
      // Type check at compile time ensures it's the correct union type
    });

    it('should cast config to correct type structure', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_ETHEREUM.dbResult);

      const result = await tokenService.create(USDC_ETHEREUM.input);

      // Config should have the correct structure
      expect(result.config).toHaveProperty('address');
      expect(result.config).toHaveProperty('chainId');
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      prismaMock.token.create.mockRejectedValue(dbError);

      await expect(tokenService.create(USDC_ETHEREUM.input)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should propagate Prisma constraint violations', async () => {
      const constraintError = new Error('Unique constraint failed');
      prismaMock.token.create.mockRejectedValue(constraintError);

      await expect(tokenService.create(USDC_ETHEREUM.input)).rejects.toThrow(
        'Unique constraint failed'
      );
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      prismaMock.token.create.mockRejectedValue(networkError);

      await expect(tokenService.create(WETH_ETHEREUM.input)).rejects.toThrow(
        'Network timeout'
      );
    });
  });

  // ==========================================================================
  // Prisma Interaction Verification
  // ==========================================================================

  describe('Prisma interaction', () => {
    it('should call prisma.token.create exactly once', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_ETHEREUM.dbResult);

      await tokenService.create(USDC_ETHEREUM.input);

      expect(prismaMock.token.create).toHaveBeenCalledTimes(1);
    });

    it('should not call other Prisma methods', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_ETHEREUM.dbResult);

      await tokenService.create(USDC_ETHEREUM.input);

      expect(prismaMock.token.update).not.toHaveBeenCalled();
      expect(prismaMock.token.delete).not.toHaveBeenCalled();
      expect(prismaMock.token.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.token.findUnique).not.toHaveBeenCalled();
    });

    it('should pass config as object (not stringified JSON)', async () => {
      prismaMock.token.create.mockResolvedValue(USDC_ETHEREUM.dbResult);

      await tokenService.create(USDC_ETHEREUM.input);

      const callArgs = prismaMock.token.create.mock.calls[0][0];
      expect(typeof callArgs.data.config).toBe('object');
      expect(callArgs.data.config).not.toBeInstanceOf(String);
    });
  });

  // ==========================================================================
  // Real-World Scenarios
  // ==========================================================================

  describe('real-world scenarios', () => {
    it('should create all popular ERC-20 tokens', async () => {
      for (const [name, fixture] of Object.entries(ERC20_FIXTURES)) {
        prismaMock.token.create.mockResolvedValue(fixture.dbResult);

        const result = await tokenService.create(fixture.input);

        expect(result.symbol).toBe(fixture.input.symbol);
        expect(result.tokenType).toBe('evm-erc20');
      }
    });

    it('should create all Solana tokens', async () => {
      for (const [name, fixture] of Object.entries(SOLANA_FIXTURES)) {
        prismaMock.token.create.mockResolvedValue(fixture.dbResult);

        const result = await tokenService.create(fixture.input);

        expect(result.symbol).toBe(fixture.input.symbol);
        expect(result.tokenType).toBe('solana-spl');
      }
    });

    it('should create USDC on multiple chains with different addresses', async () => {
      const usdcChains = [USDC_ETHEREUM, USDC_ARBITRUM, USDC_BASE];

      for (const fixture of usdcChains) {
        prismaMock.token.create.mockResolvedValue(fixture.dbResult);

        const result = await tokenService.create(fixture.input);

        expect(result.symbol).toBe('USDC');
        expect(result.decimals).toBe(6);
        expect(result.config).toHaveProperty('address');
        expect(result.config).toHaveProperty('chainId');
      }
    });

    it('should handle tokens with CoinGecko integration', async () => {
      const tokensWithCoingecko = [USDC_ETHEREUM, WETH_ETHEREUM, WSOL_SOLANA];

      for (const fixture of tokensWithCoingecko) {
        prismaMock.token.create.mockResolvedValue(fixture.dbResult);

        const result = await tokenService.create(fixture.input);

        expect(result.coingeckoId).toBeDefined();
        expect(result.marketCap).toBeDefined();
      }
    });

    it('should handle meme tokens without market data', async () => {
      const memeToken = createTokenFixture({
        name: 'Doge Killer',
        symbol: 'DOGEKILL',
        coingeckoId: undefined,
        marketCap: undefined,
        logoUrl: undefined,
      });
      prismaMock.token.create.mockResolvedValue(memeToken.dbResult);

      const result = await tokenService.create(memeToken.input);

      expect(result.symbol).toBe('DOGEKILL');
      expect(result.coingeckoId).toBeUndefined();
      expect(result.marketCap).toBeUndefined();
    });
  });

  // ==========================================================================
  // Custom Fixtures with Helper Function
  // ==========================================================================

  describe('custom fixtures', () => {
    it('should create token with custom symbol using helper', async () => {
      const customToken = createTokenFixture({
        symbol: 'CUSTOM',
        name: 'Custom Token',
      });
      prismaMock.token.create.mockResolvedValue(customToken.dbResult);

      const result = await tokenService.create(customToken.input);

      expect(result.symbol).toBe('CUSTOM');
      expect(result.name).toBe('Custom Token');
    });

    it('should create token with custom chainId using helper', async () => {
      const customToken = createTokenFixture({
        config: {
          address: '0x9999999999999999999999999999999999999999',
          chainId: 999,
        },
      });
      prismaMock.token.create.mockResolvedValue(customToken.dbResult);

      const result = await tokenService.create(customToken.input);

      expect(result.config).toHaveProperty('chainId', 999);
    });
  });
});
