import type { PublicClient } from "viem";
import { type TokenMetadata } from "./erc20-abi.js";
export declare class TokenMetadataError extends Error {
    readonly address: string;
    readonly cause?: unknown | undefined;
    constructor(message: string, address: string, cause?: unknown | undefined);
}
export declare function readTokenMetadata(client: PublicClient, address: string): Promise<TokenMetadata>;
//# sourceMappingURL=erc20-reader.d.ts.map