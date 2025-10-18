/**
 * Clients Exports
 *
 * Third-party API clients and external service integrations
 */

export {
  CoinGeckoClient,
  TokenNotFoundInCoinGeckoError,
  CoinGeckoApiError,
  type CoinGeckoToken,
  type CoinGeckoDetailedCoin,
  type EnrichmentData,
} from './coingecko/index.js';

export {
  EtherscanClient,
  EtherscanApiError,
  EtherscanApiKeyMissingError,
  EVENT_SIGNATURES,
  NFT_POSITION_MANAGER_ADDRESSES,
  SUPPORTED_CHAIN_IDS,
  type EtherscanClientDependencies,
  type EtherscanLog,
  type EtherscanLogsResponse,
  type EtherscanBlockNumberResponse,
  type EtherscanContractCreationResponse,
  type ContractCreationInfo,
  type FetchLogsOptions,
  type FetchPositionEventsOptions,
  type RawPositionEvent,
  type UniswapV3EventType,
} from './etherscan/index.js';
