import { getAddress } from 'viem';
export function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/i.test(address);
}
export function normalizeAddress(address) {
    if (!isValidAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
    }
    return getAddress(address);
}
export function compareAddresses(addressA, addressB) {
    const normalizedA = normalizeAddress(addressA);
    const normalizedB = normalizeAddress(addressB);
    const bigintA = BigInt(normalizedA);
    const bigintB = BigInt(normalizedB);
    if (bigintA < bigintB)
        return -1;
    if (bigintA > bigintB)
        return 1;
    return 0;
}
//# sourceMappingURL=address.js.map