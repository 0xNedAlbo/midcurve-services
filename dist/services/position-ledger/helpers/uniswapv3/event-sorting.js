export function sortRawEventsByBlockchain(events) {
    return [...events].sort((a, b) => {
        if (a.blockNumber < b.blockNumber)
            return -1;
        if (a.blockNumber > b.blockNumber)
            return 1;
        if (a.transactionIndex < b.transactionIndex)
            return -1;
        if (a.transactionIndex > b.transactionIndex)
            return 1;
        if (a.logIndex < b.logIndex)
            return -1;
        if (a.logIndex > b.logIndex)
            return 1;
        return 0;
    });
}
//# sourceMappingURL=event-sorting.js.map