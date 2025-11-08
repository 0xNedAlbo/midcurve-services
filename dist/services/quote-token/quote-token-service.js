import { PrismaClient } from '@prisma/client';
import { createServiceLogger, log } from '../../logging/index.js';
export class QuoteTokenService {
    _prisma;
    logger;
    constructor(dependencies = {}) {
        this._prisma = dependencies.prisma ?? new PrismaClient();
        this.logger = createServiceLogger(this.constructor.name);
        this.logger.info('QuoteTokenService initialized');
    }
    get prisma() {
        return this._prisma;
    }
    async setUserPreferences(userId, preferredQuoteTokens) {
        log.methodEntry(this.logger, 'setUserPreferences', {
            userId,
            count: preferredQuoteTokens.length,
        });
        try {
            const normalized = preferredQuoteTokens.map((token) => this.normalizeTokenId(token));
            await this.prisma.userQuoteTokenPreference.upsert({
                where: {
                    userId_protocol: {
                        userId,
                        protocol: this.getProtocol(),
                    },
                },
                update: {
                    preferredQuoteTokens: normalized,
                },
                create: {
                    userId,
                    protocol: this.getProtocol(),
                    preferredQuoteTokens: normalized,
                },
            });
            log.methodExit(this.logger, 'setUserPreferences', { userId });
        }
        catch (error) {
            log.methodError(this.logger, 'setUserPreferences', error, {
                userId,
            });
            throw error;
        }
    }
    async getUserPreferences(userId) {
        const prefs = await this.prisma.userQuoteTokenPreference.findUnique({
            where: {
                userId_protocol: {
                    userId,
                    protocol: this.getProtocol(),
                },
            },
        });
        return prefs ? prefs.preferredQuoteTokens : null;
    }
    async resetToDefaults(userId) {
        log.methodEntry(this.logger, 'resetToDefaults', { userId });
        try {
            await this.prisma.userQuoteTokenPreference.delete({
                where: {
                    userId_protocol: {
                        userId,
                        protocol: this.getProtocol(),
                    },
                },
            });
            log.methodExit(this.logger, 'resetToDefaults', { userId });
        }
        catch (error) {
            if (error &&
                typeof error === 'object' &&
                'code' in error &&
                error.code === 'P2025') {
                this.logger.debug({ userId }, 'No preferences to reset');
                return;
            }
            log.methodError(this.logger, 'resetToDefaults', error, {
                userId,
            });
            throw error;
        }
    }
}
//# sourceMappingURL=quote-token-service.js.map