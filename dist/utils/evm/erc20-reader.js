import { erc20Abi } from "./erc20-abi.js";
export class TokenMetadataError extends Error {
    address;
    cause;
    constructor(message, address, cause) {
        super(message);
        this.address = address;
        this.cause = cause;
        this.name = "TokenMetadataError";
    }
}
export async function readTokenMetadata(client, address) {
    try {
        const results = await client.multicall({
            contracts: [
                {
                    address: address,
                    abi: erc20Abi,
                    functionName: "name",
                },
                {
                    address: address,
                    abi: erc20Abi,
                    functionName: "symbol",
                },
                {
                    address: address,
                    abi: erc20Abi,
                    functionName: "decimals",
                },
            ],
            allowFailure: false,
        });
        const [name, symbol, decimals] = results;
        if (typeof name !== "string" || !name) {
            throw new TokenMetadataError("Token contract does not implement name() or returned invalid value", address);
        }
        if (typeof symbol !== "string" || !symbol) {
            throw new TokenMetadataError("Token contract does not implement symbol() or returned invalid value", address);
        }
        if (typeof decimals !== "number" || decimals < 0 || decimals > 255) {
            throw new TokenMetadataError("Token contract does not implement decimals() or returned invalid value", address);
        }
        return {
            name,
            symbol,
            decimals,
        };
    }
    catch (error) {
        if (error instanceof TokenMetadataError) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new TokenMetadataError(`Failed to read token metadata from contract: ${errorMessage}`, address, error);
    }
}
//# sourceMappingURL=erc20-reader.js.map