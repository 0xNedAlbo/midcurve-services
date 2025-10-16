/**
 * CoinGecko API Client
 *
 * Provides access to CoinGecko token metadata including logos, market caps,
 * and token identification across multiple chains.
 *
 * Features:
 * - Token list caching (1-hour TTL)
 * - Multi-chain support (Ethereum, Arbitrum, Base, BSC, Polygon, Optimism)
 * - Market cap and logo URL fetching
 * - Address-based token lookup
 */

import { createServiceLogger, log } from '../../logging/index.js';
import type { ServiceLogger } from '../../logging/index.js';

/**
 * CoinGecko token representation from the coins list API
 */
export interface CoinGeckoToken {
  /** CoinGecko coin ID (e.g., 'usd-coin') */
  id: string;
  /** Token symbol (e.g., 'USDC') */
  symbol: string;
  /** Token name (e.g., 'USD Coin') */
  name: string;
  /** Platform addresses keyed by CoinGecko platform ID */
  platforms: Record<string, string>;
}

/**
 * Detailed coin information from the coins/{id} API
 */
export interface CoinGeckoDetailedCoin {
  /** CoinGecko coin ID */
  id: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Logo URLs in various sizes */
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  /** Market data including market cap */
  market_data: {
    market_cap: {
      usd: number;
    };
  };
  /** Platform addresses */
  platforms: Record<string, string>;
}

/**
 * Enrichment data extracted from CoinGecko
 */
export interface EnrichmentData {
  /** CoinGecko coin ID */
  coingeckoId: string;
  /** Logo URL (small size, ~32x32) */
  logoUrl: string;
  /** Market cap in USD */
  marketCap: number;
  /** Token symbol from CoinGecko */
  symbol: string;
  /** Token name from CoinGecko */
  name: string;
}

/**
 * Error thrown when token is not found in CoinGecko
 */
export class TokenNotFoundInCoinGeckoError extends Error {
  constructor(chainId: number, address: string) {
    super(
      `Token not found in CoinGecko for chain ${chainId} and address ${address}`
    );
    this.name = 'TokenNotFoundInCoinGeckoError';
  }
}

/**
 * Error thrown when CoinGecko API request fails
 */
export class CoinGeckoApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'CoinGeckoApiError';
  }
}

/**
 * CoinGecko API Client
 *
 * Manages API requests to CoinGecko with caching and error handling.
 * Uses singleton pattern for convenient default access.
 */
export class CoinGeckoClient {
  private static instance: CoinGeckoClient | null = null;

  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private tokensCache: CoinGeckoToken[] | null = null;
  private cacheExpiry: number = 0;
  private readonly cacheTimeout = 60 * 60 * 1000; // 1 hour

  // Cache for individual coin details (by coinId)
  private coinDetailsCache: Map<string, { data: CoinGeckoDetailedCoin; expiry: number }> = new Map();
  private readonly coinDetailsCacheTimeout = 60 * 60 * 1000; // 1 hour

  private readonly logger: ServiceLogger;

  /**
   * Map chain IDs to CoinGecko platform IDs
   * See: https://api.coingecko.com/api/v3/asset_platforms
   */
  private readonly chainIdToPlatformId: Record<number, string> = {
    1: 'ethereum', // Ethereum
    42161: 'arbitrum-one', // Arbitrum One
    8453: 'base', // Base
    56: 'binance-smart-chain', // BNB Smart Chain
    137: 'polygon-pos', // Polygon
    10: 'optimistic-ethereum', // Optimism
  };

  constructor() {
    this.logger = createServiceLogger('CoinGeckoClient');
  }

  /**
   * Get singleton instance of CoinGeckoClient
   */
  static getInstance(): CoinGeckoClient {
    if (!CoinGeckoClient.instance) {
      CoinGeckoClient.instance = new CoinGeckoClient();
    }
    return CoinGeckoClient.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    CoinGeckoClient.instance = null;
  }

  /**
   * Get all tokens from CoinGecko with caching
   *
   * Fetches the complete token list from CoinGecko and filters to only
   * include tokens available on supported chains. Results are cached
   * for 1 hour to minimize API calls.
   *
   * @returns Array of CoinGecko tokens on supported chains
   * @throws CoinGeckoApiError if API request fails
   */
  async getAllTokens(): Promise<CoinGeckoToken[]> {
    log.methodEntry(this.logger, 'getAllTokens');

    const now = Date.now();

    // Return cached data if valid
    if (this.tokensCache && now < this.cacheExpiry) {
      log.cacheHit(this.logger, 'getAllTokens', 'tokens');
      log.methodExit(this.logger, 'getAllTokens', {
        count: this.tokensCache.length,
      });
      return this.tokensCache;
    }

    log.cacheMiss(this.logger, 'getAllTokens', 'tokens');

    try {
      log.externalApiCall(
        this.logger,
        'CoinGecko',
        '/coins/list',
        { include_platform: true }
      );

      const response = await fetch(
        `${this.baseUrl}/coins/list?include_platform=true`
      );

      if (!response.ok) {
        const error = new CoinGeckoApiError(
          `CoinGecko API error: ${response.status} ${response.statusText}`,
          response.status
        );
        log.methodError(this.logger, 'getAllTokens', error, {
          statusCode: response.status,
        });
        throw error;
      }

      const allTokens = (await response.json()) as CoinGeckoToken[];
      this.logger.debug(
        { totalTokens: allTokens.length },
        'Received tokens from CoinGecko API'
      );

      // Filter to only include tokens on supported chains
      const supportedPlatformIds = Object.values(this.chainIdToPlatformId);
      const filteredTokens = allTokens.filter((token) => {
        return supportedPlatformIds.some(
          (platformId) =>
            token.platforms[platformId] &&
            token.platforms[platformId].trim() !== ''
        );
      });

      this.logger.info(
        {
          totalTokens: allTokens.length,
          filteredTokens: filteredTokens.length,
        },
        'Filtered tokens for supported chains'
      );

      // Update cache
      this.tokensCache = filteredTokens;
      this.cacheExpiry = now + this.cacheTimeout;

      log.methodExit(this.logger, 'getAllTokens', {
        count: filteredTokens.length,
      });
      return filteredTokens;
    } catch (error) {
      // If we have stale cached data and API fails, return cached data
      if (this.tokensCache) {
        this.logger.warn(
          { cachedCount: this.tokensCache.length },
          'Returning stale cached data due to API error'
        );
        return this.tokensCache;
      }

      // Re-throw CoinGeckoApiError
      if (error instanceof CoinGeckoApiError) {
        throw error;
      }

      // Wrap other errors
      const wrappedError = new CoinGeckoApiError(
        `Failed to fetch tokens from CoinGecko: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      log.methodError(this.logger, 'getAllTokens', wrappedError);
      throw wrappedError;
    }
  }

  /**
   * Find CoinGecko coin ID by contract address and chain ID
   *
   * @param chainId - Chain ID (e.g., 1 for Ethereum)
   * @param address - Token contract address (case-insensitive)
   * @returns CoinGecko coin ID or null if not found
   * @throws CoinGeckoApiError if API request fails
   */
  async findCoinByAddress(
    chainId: number,
    address: string
  ): Promise<string | null> {
    log.methodEntry(this.logger, 'findCoinByAddress', {
      chainId,
      address,
    });

    const tokens = await this.getAllTokens();
    const platformId = this.chainIdToPlatformId[chainId];

    if (!platformId) {
      this.logger.debug({ chainId }, 'Chain not supported');
      log.methodExit(this.logger, 'findCoinByAddress', {
        found: false,
      });
      return null;
    }

    const normalizedAddress = address.toLowerCase();
    const token = tokens.find(
      (token) =>
        token.platforms[platformId] &&
        token.platforms[platformId].toLowerCase() === normalizedAddress
    );

    if (token) {
      this.logger.debug(
        { chainId, address, coinId: token.id },
        'Token found in CoinGecko'
      );
    } else {
      this.logger.debug({ chainId, address }, 'Token not found in CoinGecko');
    }

    log.methodExit(this.logger, 'findCoinByAddress', {
      coinId: token?.id || null,
    });
    return token ? token.id : null;
  }

  /**
   * Get detailed coin information including market cap and logo
   *
   * @param coinId - CoinGecko coin ID
   * @returns Detailed coin information
   * @throws CoinGeckoApiError if API request fails or coin not found
   */
  async getCoinDetails(coinId: string): Promise<CoinGeckoDetailedCoin> {
    log.methodEntry(this.logger, 'getCoinDetails', { coinId });

    const now = Date.now();

    // Check cache first
    const cached = this.coinDetailsCache.get(coinId);
    if (cached && now < cached.expiry) {
      log.cacheHit(this.logger, 'getCoinDetails', `coinDetails:${coinId}`);
      log.methodExit(this.logger, 'getCoinDetails', {
        coinId: cached.data.id,
        fromCache: true,
      });
      return cached.data;
    }

    log.cacheMiss(this.logger, 'getCoinDetails', `coinDetails:${coinId}`);

    try {
      log.externalApiCall(this.logger, 'CoinGecko', `/coins/${coinId}`, {
        market_data: true,
      });

      const response = await fetch(
        `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
      );

      if (!response.ok) {
        const error = new CoinGeckoApiError(
          `CoinGecko API error: ${response.status} ${response.statusText}`,
          response.status
        );
        log.methodError(this.logger, 'getCoinDetails', error, {
          coinId,
          statusCode: response.status,
        });
        throw error;
      }

      const coin = (await response.json()) as CoinGeckoDetailedCoin;
      this.logger.debug(
        { coinId, symbol: coin.symbol, name: coin.name },
        'Retrieved coin details'
      );

      // Cache the result
      this.coinDetailsCache.set(coinId, {
        data: coin,
        expiry: now + this.coinDetailsCacheTimeout,
      });

      log.methodExit(this.logger, 'getCoinDetails', {
        coinId: coin.id,
        fromCache: false,
      });
      return coin;
    } catch (error) {
      // Re-throw CoinGeckoApiError
      if (error instanceof CoinGeckoApiError) {
        throw error;
      }

      // Wrap other errors
      const wrappedError = new CoinGeckoApiError(
        `Failed to fetch coin details for ${coinId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      log.methodError(this.logger, 'getCoinDetails', wrappedError, {
        coinId,
      });
      throw wrappedError;
    }
  }

  /**
   * Get enrichment data for an ERC-20 token by address and chain ID
   *
   * This is the primary method for enriching ERC-20 tokens. It finds the token
   * in CoinGecko's database, fetches detailed information, and returns
   * structured enrichment data.
   *
   * @param chainId - EVM chain ID where the token exists
   * @param address - ERC-20 token contract address (case-insensitive)
   * @returns Enrichment data (coingeckoId, logoUrl, marketCap, symbol, name)
   * @throws TokenNotFoundInCoinGeckoError if token not found
   * @throws CoinGeckoApiError if API request fails
   *
   * @example
   * ```typescript
   * const client = CoinGeckoClient.getInstance();
   * const data = await client.getErc20EnrichmentData(
   *   1,
   *   '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
   * );
   * // { coingeckoId: 'usd-coin', logoUrl: '...', marketCap: 28000000000, ... }
   * ```
   */
  async getErc20EnrichmentData(
    chainId: number,
    address: string
  ): Promise<EnrichmentData> {
    log.methodEntry(this.logger, 'getErc20EnrichmentData', {
      chainId,
      address,
    });

    try {
      // Find coin ID by address
      const coinId = await this.findCoinByAddress(chainId, address);

      if (!coinId) {
        const error = new TokenNotFoundInCoinGeckoError(chainId, address);
        log.methodError(
          this.logger,
          'getErc20EnrichmentData',
          error,
          { chainId, address }
        );
        throw error;
      }

      this.logger.info(
        { chainId, address, coinId },
        'Found token in CoinGecko, fetching enrichment data'
      );

      // Fetch detailed coin information
      const coinDetails = await this.getCoinDetails(coinId);

      // Validate market cap data
      const marketCapUsd = coinDetails.market_data?.market_cap?.usd;
      if (!marketCapUsd || marketCapUsd <= 0) {
        const error = new CoinGeckoApiError(
          `Market cap data not available for ${coinId}`
        );
        log.methodError(
          this.logger,
          'getErc20EnrichmentData',
          error,
          { coinId, chainId, address }
        );
        throw error;
      }

      const enrichmentData = {
        coingeckoId: coinId,
        logoUrl: coinDetails.image.small,
        marketCap: marketCapUsd,
        symbol: coinDetails.symbol.toUpperCase(),
        name: coinDetails.name,
      };

      this.logger.info(
        {
          chainId,
          address,
          coingeckoId: enrichmentData.coingeckoId,
          symbol: enrichmentData.symbol,
          marketCap: enrichmentData.marketCap,
        },
        'Successfully enriched token data'
      );

      log.methodExit(this.logger, 'getErc20EnrichmentData', {
        coingeckoId: enrichmentData.coingeckoId,
      });

      return enrichmentData;
    } catch (error) {
      // Errors are already logged by log.methodError in the try block
      // or by the called methods. Just re-throw.
      throw error;
    }
  }

  /**
   * Clear all caches (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.tokensCache = null;
    this.cacheExpiry = 0;
    this.coinDetailsCache.clear();
  }

  /**
   * Check if service has valid cached data
   */
  hasCachedData(): boolean {
    return this.tokensCache !== null && Date.now() < this.cacheExpiry;
  }

  /**
   * Get supported chain IDs
   */
  getSupportedChainIds(): number[] {
    return Object.keys(this.chainIdToPlatformId).map(Number);
  }

  /**
   * Check if chain is supported
   */
  isChainSupported(chainId: number): boolean {
    return chainId in this.chainIdToPlatformId;
  }
}
