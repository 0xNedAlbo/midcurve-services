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
    const now = Date.now();

    // Return cached data if valid
    if (this.tokensCache && now < this.cacheExpiry) {
      return this.tokensCache;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/coins/list?include_platform=true`
      );

      if (!response.ok) {
        throw new CoinGeckoApiError(
          `CoinGecko API error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const allTokens = (await response.json()) as CoinGeckoToken[];

      // Filter to only include tokens on supported chains
      const supportedPlatformIds = Object.values(this.chainIdToPlatformId);
      const filteredTokens = allTokens.filter((token) => {
        return supportedPlatformIds.some(
          (platformId) =>
            token.platforms[platformId] &&
            token.platforms[platformId].trim() !== ''
        );
      });

      // Update cache
      this.tokensCache = filteredTokens;
      this.cacheExpiry = now + this.cacheTimeout;

      return filteredTokens;
    } catch (error) {
      // If we have stale cached data and API fails, return cached data
      if (this.tokensCache) {
        return this.tokensCache;
      }

      // Re-throw CoinGeckoApiError
      if (error instanceof CoinGeckoApiError) {
        throw error;
      }

      // Wrap other errors
      throw new CoinGeckoApiError(
        `Failed to fetch tokens from CoinGecko: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
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
    const tokens = await this.getAllTokens();
    const platformId = this.chainIdToPlatformId[chainId];

    if (!platformId) {
      return null;
    }

    const normalizedAddress = address.toLowerCase();
    const token = tokens.find(
      (token) =>
        token.platforms[platformId] &&
        token.platforms[platformId].toLowerCase() === normalizedAddress
    );

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
    try {
      const response = await fetch(
        `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
      );

      if (!response.ok) {
        throw new CoinGeckoApiError(
          `CoinGecko API error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const coin = (await response.json()) as CoinGeckoDetailedCoin;
      return coin;
    } catch (error) {
      // Re-throw CoinGeckoApiError
      if (error instanceof CoinGeckoApiError) {
        throw error;
      }

      // Wrap other errors
      throw new CoinGeckoApiError(
        `Failed to fetch coin details for ${coinId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
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
    // Find coin ID by address
    const coinId = await this.findCoinByAddress(chainId, address);

    if (!coinId) {
      throw new TokenNotFoundInCoinGeckoError(chainId, address);
    }

    // Fetch detailed coin information
    const coinDetails = await this.getCoinDetails(coinId);

    // Validate market cap data
    const marketCapUsd = coinDetails.market_data?.market_cap?.usd;
    if (!marketCapUsd || marketCapUsd <= 0) {
      throw new CoinGeckoApiError(
        `Market cap data not available for ${coinId}`
      );
    }

    return {
      coingeckoId: coinId,
      logoUrl: coinDetails.image.small,
      marketCap: marketCapUsd,
      symbol: coinDetails.symbol.toUpperCase(),
      name: coinDetails.name,
    };
  }

  /**
   * Clear the token cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.tokensCache = null;
    this.cacheExpiry = 0;
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
