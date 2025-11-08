import { createServiceLogger, log } from '../../logging/index.js';
import { CacheService } from '../../services/cache/index.js';
import { RequestScheduler } from '../../utils/request-scheduler/index.js';
const API_BASE_URL = 'https://api.etherscan.io/v2/api';
export const EVENT_SIGNATURES = {
    INCREASE_LIQUIDITY: '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f',
    DECREASE_LIQUIDITY: '0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4',
    COLLECT: '0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01',
};
export const NFT_POSITION_MANAGER_ADDRESSES = {
    1: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    42161: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    8453: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
    10: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    137: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
};
export const SUPPORTED_CHAIN_IDS = [1, 42161, 8453, 10, 137];
export class EtherscanApiError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'EtherscanApiError';
    }
}
export class EtherscanApiKeyMissingError extends Error {
    constructor() {
        super('ETHERSCAN_API_KEY environment variable is not set. ' +
            'Get your API key at: https://etherscan.io/myapikey');
        this.name = 'EtherscanApiKeyMissingError';
    }
}
export class EtherscanClient {
    static instance = null;
    cacheService;
    requestScheduler;
    apiKey;
    logger;
    contractCreationCacheTtl = 365 * 24 * 60 * 60;
    constructor(dependencies = {}) {
        this.logger = createServiceLogger('EtherscanClient');
        this.apiKey = dependencies.apiKey ?? process.env.ETHERSCAN_API_KEY ?? '';
        if (!this.apiKey) {
            throw new EtherscanApiKeyMissingError();
        }
        this.cacheService = dependencies.cacheService ?? CacheService.getInstance();
        this.requestScheduler =
            dependencies.requestScheduler ??
                new RequestScheduler({
                    minSpacingMs: 220,
                    name: 'EtherscanScheduler',
                });
        this.logger.info('EtherscanClient initialized');
    }
    static getInstance() {
        if (!EtherscanClient.instance) {
            EtherscanClient.instance = new EtherscanClient();
        }
        return EtherscanClient.instance;
    }
    static resetInstance() {
        EtherscanClient.instance = null;
    }
    isEtherscanRateLimited(data) {
        return (data.status !== '1' &&
            data.message === 'NOTOK' &&
            typeof data.result === 'string' &&
            data.result.toLowerCase().includes('max calls per sec'));
    }
    async scheduledFetch(url) {
        return this.requestScheduler.schedule(async () => {
            const maxRetries = 6;
            const baseDelayMs = 800;
            const maxDelayMs = 8000;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const response = await fetch(url, {
                        headers: {
                            'User-Agent': 'Midcurve-Services/1.0',
                        },
                    });
                    if (response.ok) {
                        const text = await response.text();
                        let data;
                        try {
                            data = JSON.parse(text);
                        }
                        catch {
                            return new Response(text, {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.headers,
                            });
                        }
                        if (this.isEtherscanRateLimited(data)) {
                            if (attempt >= maxRetries) {
                                return new Response(text, {
                                    status: response.status,
                                    statusText: response.statusText,
                                    headers: response.headers,
                                });
                            }
                            const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
                            const jitter = Math.floor(Math.random() * 200);
                            this.logger.warn({
                                attempt: attempt + 1,
                                maxRetries,
                                delay: delay + jitter,
                                result: data.result,
                            }, 'Etherscan API rate limit detected (NOTOK), retrying');
                            await new Promise((resolve) => setTimeout(resolve, delay + jitter));
                            continue;
                        }
                        return new Response(text, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers,
                        });
                    }
                    const isRetryable = response.status === 429 || (response.status >= 500 && response.status < 600);
                    if (!isRetryable || attempt >= maxRetries) {
                        return response;
                    }
                    const retryAfterHeader = response.headers.get('Retry-After');
                    let delay;
                    if (retryAfterHeader) {
                        const retryAfterSeconds = Number(retryAfterHeader);
                        if (!isNaN(retryAfterSeconds)) {
                            delay = Math.min(maxDelayMs, Math.max(baseDelayMs, retryAfterSeconds * 1000));
                        }
                        else {
                            const retryAfterDate = new Date(retryAfterHeader);
                            delay = Math.min(maxDelayMs, Math.max(baseDelayMs, retryAfterDate.getTime() - Date.now()));
                        }
                    }
                    else {
                        delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
                    }
                    delay += Math.floor(Math.random() * 200);
                    this.logger.warn({
                        attempt: attempt + 1,
                        maxRetries,
                        status: response.status,
                        delay,
                        hasRetryAfter: !!retryAfterHeader,
                    }, 'Retryable HTTP error, backing off');
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
                catch (error) {
                    if (attempt >= maxRetries) {
                        throw error;
                    }
                    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
                    const jitter = Math.floor(Math.random() * 200);
                    this.logger.warn({ attempt: attempt + 1, delay: delay + jitter, error }, 'Network error, retrying with backoff');
                    await new Promise((resolve) => setTimeout(resolve, delay + jitter));
                }
            }
            throw new Error('Unexpected end of retry loop');
        });
    }
    async fetchLogs(chainId, contractAddress, options = {}) {
        log.methodEntry(this.logger, 'fetchLogs', { chainId, contractAddress, options });
        this.validateChainId(chainId);
        const { fromBlock = 'earliest', toBlock = 'latest', topic0, topic1, topic2, topic3, } = options;
        const params = new URLSearchParams({
            chainid: chainId.toString(),
            module: 'logs',
            action: 'getLogs',
            address: contractAddress,
            fromBlock: fromBlock.toString(),
            toBlock: toBlock.toString(),
            apikey: this.apiKey,
        });
        if (topic0)
            params.append('topic0', topic0);
        if (topic1)
            params.append('topic1', topic1);
        if (topic2)
            params.append('topic2', topic2);
        if (topic3)
            params.append('topic3', topic3);
        const url = `${API_BASE_URL}?${params.toString()}`;
        try {
            log.externalApiCall(this.logger, 'Etherscan', '/logs/getLogs', {
                chainId,
                fromBlock,
                toBlock,
            });
            const response = await this.scheduledFetch(url);
            if (!response.ok) {
                const error = new EtherscanApiError(`Etherscan API error: ${response.status} ${response.statusText}`, response.status);
                log.methodError(this.logger, 'fetchLogs', error, { statusCode: response.status });
                throw error;
            }
            const data = (await response.json());
            if (data.status !== '1') {
                if (data.message === 'No records found') {
                    log.methodExit(this.logger, 'fetchLogs', { count: 0 });
                    return [];
                }
                const error = new EtherscanApiError(`Etherscan API error: ${data.message} ${typeof data.result === 'string' ? data.result : ''}`);
                log.methodError(this.logger, 'fetchLogs', error);
                throw error;
            }
            const logs = Array.isArray(data.result) ? data.result : [];
            log.methodExit(this.logger, 'fetchLogs', { count: logs.length });
            return logs;
        }
        catch (error) {
            if (error instanceof EtherscanApiError) {
                throw error;
            }
            const wrappedError = new EtherscanApiError(`Failed to fetch logs from Etherscan: ${error instanceof Error ? error.message : 'Unknown error'}`);
            log.methodError(this.logger, 'fetchLogs', wrappedError);
            throw wrappedError;
        }
    }
    async getContractCreationBlock(chainId, contractAddress) {
        log.methodEntry(this.logger, 'getContractCreationBlock', { chainId, contractAddress });
        this.validateChainId(chainId);
        const cacheKey = `etherscan:contract-creation:${chainId}:${contractAddress.toLowerCase()}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            log.cacheHit(this.logger, 'getContractCreationBlock', cacheKey);
            log.methodExit(this.logger, 'getContractCreationBlock', {
                blockNumber: cached.blockNumber,
                fromCache: true,
            });
            return cached.blockNumber;
        }
        log.cacheMiss(this.logger, 'getContractCreationBlock', cacheKey);
        const params = new URLSearchParams({
            chainid: chainId.toString(),
            module: 'contract',
            action: 'getcontractcreation',
            contractaddresses: contractAddress,
            apikey: this.apiKey,
        });
        const url = `${API_BASE_URL}?${params.toString()}`;
        try {
            log.externalApiCall(this.logger, 'Etherscan', '/contract/getcontractcreation', {
                chainId,
                contractAddress,
            });
            const response = await this.scheduledFetch(url);
            if (!response.ok) {
                const error = new EtherscanApiError(`Etherscan API error: ${response.status} ${response.statusText}`, response.status);
                log.methodError(this.logger, 'getContractCreationBlock', error, {
                    statusCode: response.status,
                });
                throw error;
            }
            const data = (await response.json());
            if (data.status !== '1') {
                const error = new EtherscanApiError(`Etherscan API error: ${data.message} ${typeof data.result === 'string' ? data.result : ''}`);
                log.methodError(this.logger, 'getContractCreationBlock', error);
                throw error;
            }
            if (!Array.isArray(data.result) || data.result.length === 0) {
                const error = new EtherscanApiError(`Contract creation not found for ${contractAddress} on chain ${chainId}`);
                log.methodError(this.logger, 'getContractCreationBlock', error);
                throw error;
            }
            const info = data.result[0];
            if (!info) {
                const error = new EtherscanApiError(`Contract creation not found for ${contractAddress} on chain ${chainId}`);
                log.methodError(this.logger, 'getContractCreationBlock', error);
                throw error;
            }
            await this.cacheService.set(cacheKey, info, this.contractCreationCacheTtl);
            log.methodExit(this.logger, 'getContractCreationBlock', {
                blockNumber: info.blockNumber,
                fromCache: false,
            });
            return info.blockNumber;
        }
        catch (error) {
            if (error instanceof EtherscanApiError) {
                throw error;
            }
            const wrappedError = new EtherscanApiError(`Failed to fetch contract creation info: ${error instanceof Error ? error.message : 'Unknown error'}`);
            log.methodError(this.logger, 'getContractCreationBlock', wrappedError);
            throw wrappedError;
        }
    }
    async getBlockNumberForTimestamp(chainId, timestamp, closest = 'before') {
        log.methodEntry(this.logger, 'getBlockNumberForTimestamp', {
            chainId,
            timestamp,
            closest,
        });
        this.validateChainId(chainId);
        const params = new URLSearchParams({
            chainid: chainId.toString(),
            module: 'block',
            action: 'getblocknobytime',
            timestamp: timestamp.toString(),
            closest,
            apikey: this.apiKey,
        });
        const url = `${API_BASE_URL}?${params.toString()}`;
        try {
            log.externalApiCall(this.logger, 'Etherscan', '/block/getblocknobytime', {
                chainId,
                timestamp,
                closest,
            });
            const response = await this.scheduledFetch(url);
            if (!response.ok) {
                const error = new EtherscanApiError(`Etherscan API error: ${response.status} ${response.statusText}`, response.status);
                log.methodError(this.logger, 'getBlockNumberForTimestamp', error, {
                    statusCode: response.status,
                });
                throw error;
            }
            const data = (await response.json());
            if (data.status !== '1') {
                if (data.message?.includes('Invalid timestamp')) {
                    const error = new EtherscanApiError(`Timestamp too old or too new: ${new Date(timestamp * 1000).toISOString()}`);
                    log.methodError(this.logger, 'getBlockNumberForTimestamp', error);
                    throw error;
                }
                const error = new EtherscanApiError(`Etherscan API error: ${data.message} ${data.result}`);
                log.methodError(this.logger, 'getBlockNumberForTimestamp', error);
                throw error;
            }
            log.methodExit(this.logger, 'getBlockNumberForTimestamp', {
                blockNumber: data.result,
            });
            return data.result;
        }
        catch (error) {
            if (error instanceof EtherscanApiError) {
                throw error;
            }
            const wrappedError = new EtherscanApiError(`Failed to fetch block number for timestamp: ${error instanceof Error ? error.message : 'Unknown error'}`);
            log.methodError(this.logger, 'getBlockNumberForTimestamp', wrappedError);
            throw wrappedError;
        }
    }
    async fetchPositionEvents(chainId, nftId, options = {}) {
        log.methodEntry(this.logger, 'fetchPositionEvents', { chainId, nftId, options });
        this.validateChainId(chainId);
        const nftManagerAddress = NFT_POSITION_MANAGER_ADDRESSES[chainId];
        if (!nftManagerAddress) {
            const error = new EtherscanApiError(`No NFT Position Manager address for chain ${chainId}`);
            log.methodError(this.logger, 'fetchPositionEvents', error);
            throw error;
        }
        let fromBlock = options.fromBlock;
        if (fromBlock === undefined) {
            fromBlock = await this.getContractCreationBlock(chainId, nftManagerAddress);
        }
        const toBlock = options.toBlock ?? 'latest';
        const eventTypes = options.eventTypes ?? [
            'INCREASE_LIQUIDITY',
            'DECREASE_LIQUIDITY',
            'COLLECT',
        ];
        const tokenIdHex = '0x' + BigInt(nftId).toString(16).padStart(64, '0');
        this.logger.debug({ nftId, tokenIdHex, fromBlock, toBlock, eventTypes }, 'Fetching position events');
        const allEvents = [];
        for (const eventType of eventTypes) {
            try {
                this.logger.debug({ eventType }, `Fetching ${eventType} events`);
                const logs = await this.fetchLogs(chainId, nftManagerAddress, {
                    fromBlock,
                    toBlock,
                    topic0: EVENT_SIGNATURES[eventType],
                    topic1: tokenIdHex,
                });
                this.logger.debug({ eventType, logCount: logs.length }, 'Retrieved raw logs');
                for (const log of logs) {
                    try {
                        const parsed = this.parseEventLog(log, eventType, chainId);
                        if (parsed) {
                            allEvents.push(parsed);
                        }
                    }
                    catch (error) {
                        const errorMsg = `Failed to parse ${eventType} log ${log.transactionHash}:${log.logIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                        this.logger.error({ error, log }, errorMsg);
                        throw new EtherscanApiError(errorMsg);
                    }
                }
            }
            catch (error) {
                if (error instanceof EtherscanApiError) {
                    throw error;
                }
                const errorMsg = `Failed to fetch ${eventType} events: ${error instanceof Error ? error.message : 'Unknown error'}`;
                this.logger.error({ error, eventType }, errorMsg);
                throw new EtherscanApiError(errorMsg);
            }
        }
        this.logger.debug({ totalEventCount: allEvents.length }, 'Total events before deduplication');
        const finalEvents = this.deduplicateAndSort(allEvents);
        this.logger.debug({ finalEventCount: finalEvents.length }, 'Final events after deduplication');
        log.methodExit(this.logger, 'fetchPositionEvents', { count: finalEvents.length });
        return finalEvents;
    }
    parseEventLog(log, eventType, chainId) {
        const blockNumber = BigInt(log.blockNumber);
        const blockTimestamp = new Date(parseInt(log.timeStamp) * 1000);
        const transactionIndex = parseInt(log.transactionIndex);
        const logIndex = parseInt(log.logIndex);
        const tokenIdTopic = log.topics[1];
        if (!tokenIdTopic) {
            throw new Error('Missing tokenId in event topics');
        }
        const tokenId = BigInt(tokenIdTopic).toString();
        const baseEvent = {
            eventType,
            tokenId,
            transactionHash: log.transactionHash,
            blockNumber,
            transactionIndex,
            logIndex,
            blockTimestamp,
            chainId,
        };
        switch (eventType) {
            case 'INCREASE_LIQUIDITY': {
                const { liquidity, amount0, amount1 } = this.decodeIncreaseLiquidityData(log.data);
                return {
                    ...baseEvent,
                    liquidity: liquidity.toString(),
                    amount0: amount0.toString(),
                    amount1: amount1.toString(),
                };
            }
            case 'DECREASE_LIQUIDITY': {
                const { liquidity, amount0, amount1 } = this.decodeDecreaseLiquidityData(log.data);
                return {
                    ...baseEvent,
                    liquidity: liquidity.toString(),
                    amount0: amount0.toString(),
                    amount1: amount1.toString(),
                };
            }
            case 'COLLECT': {
                const { recipient, amount0, amount1 } = this.decodeCollectData(log.data);
                return {
                    ...baseEvent,
                    amount0: amount0.toString(),
                    amount1: amount1.toString(),
                    recipient,
                };
            }
            default:
                return null;
        }
    }
    decodeIncreaseLiquidityData(data) {
        const hex = data.slice(2);
        const chunks = hex.match(/.{64}/g) || [];
        if (chunks.length < 3) {
            throw new Error(`Invalid IncreaseLiquidity data: expected 3 chunks, got ${chunks.length}`);
        }
        return {
            liquidity: BigInt('0x' + chunks[0]),
            amount0: BigInt('0x' + chunks[1]),
            amount1: BigInt('0x' + chunks[2]),
        };
    }
    decodeDecreaseLiquidityData(data) {
        return this.decodeIncreaseLiquidityData(data);
    }
    decodeCollectData(data) {
        const hex = data.slice(2);
        const chunks = hex.match(/.{64}/g) || [];
        if (chunks.length < 3) {
            throw new Error(`Invalid Collect data: expected 3 chunks, got ${chunks.length}`);
        }
        const recipientHex = chunks[0].slice(24);
        const recipient = '0x' + recipientHex;
        return {
            recipient,
            amount0: BigInt('0x' + chunks[1]),
            amount1: BigInt('0x' + chunks[2]),
        };
    }
    deduplicateAndSort(events) {
        const uniqueEvents = new Map();
        for (const event of events) {
            const key = `${event.transactionHash}-${event.logIndex}`;
            if (!uniqueEvents.has(key)) {
                uniqueEvents.set(key, event);
            }
        }
        return Array.from(uniqueEvents.values()).sort((a, b) => {
            if (a.blockNumber !== b.blockNumber) {
                return Number(a.blockNumber - b.blockNumber);
            }
            if (a.transactionIndex !== b.transactionIndex) {
                return a.transactionIndex - b.transactionIndex;
            }
            return a.logIndex - b.logIndex;
        });
    }
    validateChainId(chainId) {
        if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
            throw new EtherscanApiError(`Unsupported chain ID: ${chainId}. Supported chains: ${SUPPORTED_CHAIN_IDS.join(', ')}`);
        }
    }
    getSupportedChainIds() {
        return SUPPORTED_CHAIN_IDS;
    }
    isChainSupported(chainId) {
        return SUPPORTED_CHAIN_IDS.includes(chainId);
    }
}
//# sourceMappingURL=etherscan-client.js.map