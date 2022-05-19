export default class Tags {
    private _tags;
    get tags(): {
        name: string;
        value: string;
    }[];
    addTag(key: string, value: string): void;
    addTags(tags: {
        name: string;
        value: string;
    }[]): void;
    addTagsToTransaction(tx: any): void;
}