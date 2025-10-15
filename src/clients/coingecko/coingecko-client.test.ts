/**
 * Tests for CoinGeckoClient
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CoinGeckoClient,
  TokenNotFoundInCoinGeckoError,
  CoinGeckoApiError,
  type CoinGeckoToken,
  type CoinGeckoDetailedCoin,
} from './coingecko-client.js';

describe('CoinGeckoClient', () => {
  let client: CoinGeckoClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset singleton before each test
    CoinGeckoClient.resetInstance();
    client = CoinGeckoClient.getInstance();

    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = CoinGeckoClient.getInstance();
      const instance2 = CoinGeckoClient.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = CoinGeckoClient.getInstance();
      CoinGeckoClient.resetInstance();
      const instance2 = CoinGeckoClient.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getAllTokens()', () => {
    const mockTokens: CoinGeckoToken[] = [
      {
        id: 'usd-coin',
        symbol: 'usdc',
        name: 'USD Coin',
        platforms: {
          ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          'arbitrum-one': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        },
      },
      {
        id: 'wrapped-ether',
        symbol: 'weth',
        name: 'Wrapped Ether',
        platforms: {
          ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        },
      },
      {
        id: 'some-unsupported-token',
        symbol: 'unsup',
        name: 'Unsupported Token',
        platforms: {
          solana: 'SomeBase58Address',
        },
      },
    ];

    it('should fetch and cache tokens from API', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      const tokens = await client.getAllTokens();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/list?include_platform=true'
      );
      expect(tokens).toHaveLength(2); // Unsupported token filtered out
      expect(tokens[0].id).toBe('usd-coin');
      expect(tokens[1].id).toBe('wrapped-ether');
    });

    it('should return cached tokens on subsequent calls', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      // First call - fetches from API
      const tokens1 = await client.getAllTokens();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call - uses cache
      const tokens2 = await client.getAllTokens();
      expect(fetchMock).toHaveBeenCalledTimes(1); // Not called again
      expect(tokens1).toEqual(tokens2);
    });

    it('should filter tokens to only supported chains', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      const tokens = await client.getAllTokens();

      // Should only include tokens with addresses on supported chains
      expect(tokens).toHaveLength(2);
      expect(tokens.every((t) => t.id !== 'some-unsupported-token')).toBe(
        true
      );
    });

    it('should throw CoinGeckoApiError on API failure', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      await expect(client.getAllTokens()).rejects.toThrow(CoinGeckoApiError);
    });

    it('should return stale cache if API fails and cache exists', async () => {
      // First call succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });
      await client.getAllTokens();

      // Clear cache expiry to simulate expired cache
      client.clearCache();
      // Set cache back manually to simulate stale cache
      (client as any).tokensCache = mockTokens.slice(0, 2);
      (client as any).cacheExpiry = 0; // Expired

      // Second call fails but should return stale cache
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const tokens = await client.getAllTokens();
      expect(tokens).toHaveLength(2);
    });

    it('should throw error if API fails and no cache exists', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.getAllTokens()).rejects.toThrow(CoinGeckoApiError);
    });
  });

  describe('findCoinByAddress()', () => {
    const mockTokens: CoinGeckoToken[] = [
      {
        id: 'usd-coin',
        symbol: 'usdc',
        name: 'USD Coin',
        platforms: {
          ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          'arbitrum-one': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        },
      },
    ];

    beforeEach(() => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockTokens,
      });
    });

    it('should find coin ID by address on Ethereum', async () => {
      const coinId = await client.findCoinByAddress(
        1,
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      );
      expect(coinId).toBe('usd-coin');
    });

    it('should find coin ID by address on Arbitrum', async () => {
      const coinId = await client.findCoinByAddress(
        42161,
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
      );
      expect(coinId).toBe('usd-coin');
    });

    it('should be case-insensitive', async () => {
      const coinId = await client.findCoinByAddress(
        1,
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      );
      expect(coinId).toBe('usd-coin');
    });

    it('should return null for non-existent address', async () => {
      const coinId = await client.findCoinByAddress(
        1,
        '0x0000000000000000000000000000000000000000'
      );
      expect(coinId).toBeNull();
    });

    it('should return null for unsupported chain', async () => {
      const coinId = await client.findCoinByAddress(
        999999,
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      );
      expect(coinId).toBeNull();
    });
  });

  describe('getCoinDetails()', () => {
    const mockCoinDetails: CoinGeckoDetailedCoin = {
      id: 'usd-coin',
      symbol: 'usdc',
      name: 'USD Coin',
      image: {
        thumb: 'https://example.com/thumb.png',
        small: 'https://example.com/small.png',
        large: 'https://example.com/large.png',
      },
      market_data: {
        market_cap: {
          usd: 28000000000,
        },
      },
      platforms: {
        ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
    };

    it('should fetch coin details successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCoinDetails,
      });

      const details = await client.getCoinDetails('usd-coin');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/usd-coin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false'
      );
      expect(details.id).toBe('usd-coin');
      expect(details.symbol).toBe('usdc');
      expect(details.market_data.market_cap.usd).toBe(28000000000);
      expect(details.image.small).toBe('https://example.com/small.png');
    });

    it('should throw CoinGeckoApiError on API failure', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(client.getCoinDetails('invalid-coin')).rejects.toThrow(
        CoinGeckoApiError
      );
    });
  });

  describe('getErc20EnrichmentData()', () => {
    const mockTokens: CoinGeckoToken[] = [
      {
        id: 'usd-coin',
        symbol: 'usdc',
        name: 'USD Coin',
        platforms: {
          ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        },
      },
    ];

    const mockCoinDetails: CoinGeckoDetailedCoin = {
      id: 'usd-coin',
      symbol: 'usdc',
      name: 'USD Coin',
      image: {
        thumb: 'https://example.com/thumb.png',
        small: 'https://example.com/small.png',
        large: 'https://example.com/large.png',
      },
      market_data: {
        market_cap: {
          usd: 28000000000,
        },
      },
      platforms: {
        ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
    };

    it('should return enrichment data successfully', async () => {
      // Mock token list
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      // Mock coin details
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCoinDetails,
      });

      const data = await client.getErc20EnrichmentData(
        1,
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      );

      expect(data.coingeckoId).toBe('usd-coin');
      expect(data.logoUrl).toBe('https://example.com/small.png');
      expect(data.marketCap).toBe(28000000000);
      expect(data.symbol).toBe('USDC');
      expect(data.name).toBe('USD Coin');
    });

    it('should throw TokenNotFoundInCoinGeckoError if token not found', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      await expect(
        client.getErc20EnrichmentData(
          1,
          '0x0000000000000000000000000000000000000000'
        )
      ).rejects.toThrow(TokenNotFoundInCoinGeckoError);
    });

    it('should throw CoinGeckoApiError if market cap is missing', async () => {
      const detailsWithoutMarketCap = {
        ...mockCoinDetails,
        market_data: { market_cap: { usd: 0 } },
      };

      // Clear cache to ensure fresh calls
      client.clearCache();

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokens,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => detailsWithoutMarketCap,
        } as Response);

      await expect(
        client.getErc20EnrichmentData(
          1,
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        )
      ).rejects.toThrow(CoinGeckoApiError);

      // Clear cache again for second call
      client.clearCache();

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokens,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => detailsWithoutMarketCap,
        } as Response);

      await expect(
        client.getErc20EnrichmentData(
          1,
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        )
      ).rejects.toThrow('Market cap data not available');
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.getAllTokens();
      expect(client.hasCachedData()).toBe(true);

      client.clearCache();
      expect(client.hasCachedData()).toBe(false);
    });

    it('should report cached data status', async () => {
      expect(client.hasCachedData()).toBe(false);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.getAllTokens();
      expect(client.hasCachedData()).toBe(true);
    });
  });

  describe('chain support', () => {
    it('should return supported chain IDs', () => {
      const chainIds = client.getSupportedChainIds();
      expect(chainIds).toContain(1); // Ethereum
      expect(chainIds).toContain(42161); // Arbitrum
      expect(chainIds).toContain(8453); // Base
      expect(chainIds).toContain(56); // BSC
      expect(chainIds).toContain(137); // Polygon
      expect(chainIds).toContain(10); // Optimism
    });

    it('should check if chain is supported', () => {
      expect(client.isChainSupported(1)).toBe(true);
      expect(client.isChainSupported(42161)).toBe(true);
      expect(client.isChainSupported(999999)).toBe(false);
    });
  });
});
