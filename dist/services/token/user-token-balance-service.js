import { erc20Abi } from 'viem';
import { normalizeAddress, isValidAddress } from '@midcurve/shared';
import { EvmConfig } from '../../config/evm.js';
import { CacheService } from '../cache/index.js';
import { createServiceLogger, log } from '../../logging/index.js';
export class UserTokenBalanceService {
    evmConfig;
    cacheService;
    logger = createServiceLogger('UserTokenBalanceService');
    static CACHE_TTL_SECONDS = 20;
    constructor(dependencies = {}) {
        this.evmConfig = dependencies.evmConfig ?? EvmConfig.getInstance();
        this.cacheService =
            dependencies.cacheService ?? CacheService.getInstance();
    }
    async getBalance(walletAddress, tokenAddress, chainId) {
        if (!isValidAddress(walletAddress)) {
            throw new Error(`Invalid wallet address: ${walletAddress}`);
        }
        if (!isValidAddress(tokenAddress)) {
            throw new Error(`Invalid token address: ${tokenAddress}`);
        }
        const normalizedWallet = normalizeAddress(walletAddress);
        const normalizedToken = normalizeAddress(tokenAddress);
        const cacheKey = this.getCacheKey(normalizedWallet, normalizedToken, chainId);
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            log.cacheHit(this.logger, 'token-balance', cacheKey);
            return {
                walletAddress: normalizedWallet,
                tokenAddress: normalizedToken,
                chainId,
                balance: BigInt(cached),
                timestamp: new Date(),
            };
        }
        log.cacheMiss(this.logger, 'token-balance', cacheKey);
        const balance = await this.fetchBalanceFromRPC(normalizedWallet, normalizedToken, chainId);
        await this.cacheService.set(cacheKey, balance.toString(), UserTokenBalanceService.CACHE_TTL_SECONDS);
        return {
            walletAddress: normalizedWallet,
            tokenAddress: normalizedToken,
            chainId,
            balance,
            timestamp: new Date(),
        };
    }
    async fetchBalanceFromRPC(walletAddress, tokenAddress, chainId) {
        log.externalApiCall(this.logger, 'EVM RPC', 'balanceOf', {
            walletAddress,
            tokenAddress,
            chainId,
        });
        try {
            const client = this.evmConfig.getPublicClient(chainId);
            const balance = await client.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [walletAddress],
            });
            this.logger.debug({
                walletAddress,
                tokenAddress,
                chainId,
                balance: balance.toString(),
            }, 'Successfully fetched token balance');
            return balance;
        }
        catch (error) {
            log.methodError(this.logger, 'fetchBalanceFromRPC', error, {
                walletAddress,
                tokenAddress,
                chainId,
            });
            throw new Error(`Failed to fetch token balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getCacheKey(walletAddress, tokenAddress, chainId) {
        return `token-balance:${chainId}:${tokenAddress}:${walletAddress}`;
    }
    async invalidateCache(walletAddress, tokenAddress, chainId) {
        const normalizedWallet = normalizeAddress(walletAddress);
        const normalizedToken = normalizeAddress(tokenAddress);
        const cacheKey = this.getCacheKey(normalizedWallet, normalizedToken, chainId);
        await this.cacheService.delete(cacheKey);
        this.logger.debug({ cacheKey, walletAddress: normalizedWallet, tokenAddress: normalizedToken, chainId }, 'Cache invalidated for token balance');
    }
}
//# sourceMappingURL=user-token-balance-service.js.map