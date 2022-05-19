import Tags from "./Tags";
export default class ArweaveDeployer {
    private wallet;
    private threads;
    private arweave;
    private txs;
    private isFile;
    constructor(wallet: any, host: string, port: number, protocol: string, threads?: number);
    load(location: any, tags?: Tags): Promise<any>;
    deploy(): Promise<{
        id: any;
        transactions: any;
    }>;
    private toHash;
    private buildTransaction;
    private buildManifest;
}
export declare const TxTags: any;