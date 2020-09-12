import { LocaleLike } from "../coh2";

export class Locale implements LocaleLike {
    public static readonly Empty = new Locale();

    constructor(private readonly messages: Record<string, string> = {}) {

    }

    get(id: string) {
        return this.messages[id];
    }
}