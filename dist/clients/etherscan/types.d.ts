export interface EtherscanLog {
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    blockHash: string;
    timeStamp: string;
    gasPrice: string;
    gasUsed: string;
    logIndex: string;
    transactionHash: string;
    transactionIndex: string;
}
export interface EtherscanLogsResponse {
    status: string;
    message: string;
    result: EtherscanLog[] | string;
}
export interface EtherscanBlockNumberResponse {
    status: string;
    message: string;
    result: string;
}
export interface ContractCreationInfo {
    contractAddress: string;
    contractCreator: string;
    txHash: string;
    blockNumber: string;
}
export interface EtherscanContractCreationResponse {
    status: string;
    message: string;
    result: ContractCreationInfo[] | string;
}
export interface FetchLogsOptions {
    fromBlock?: string | number;
    toBlock?: string | number;
    topic0?: string;
    topic1?: string;
    topic2?: string;
    topic3?: string;
}
export type UniswapV3EventType = 'INCREASE_LIQUIDITY' | 'DECREASE_LIQUIDITY' | 'COLLECT';
export interface FetchPositionEventsOptions {
    fromBlock?: string | number;
    toBlock?: string | number;
    eventTypes?: UniswapV3EventType[];
}
export interface RawPositionEvent {
    eventType: UniswapV3EventType;
    tokenId: string;
    transactionHash: string;
    blockNumber: bigint;
    transactionIndex: number;
    logIndex: number;
    blockTimestamp: Date;
    chainId: number;
    liquidity?: string;
    amount0?: string;
    amount1?: string;
    recipient?: string;
}
//# sourceMappingURL=types.d.ts.map