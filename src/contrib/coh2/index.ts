import fs from 'fs-extra';

/**
 * Represents a a wrapper class that provides localized strings from a RelicCOH2.<language>.ucs file.
 */
export class Locale {
    public static readonly Empty = new Locale();
    
    /**
     * @param idPrefix Prefixed added to each message ID. Defaults to '$'.
     */
    constructor(private readonly messages: Record<string, string> = {}) {

    }

    async init(filepath: string) {
        const localeStrings = (await fs.readFile(filepath, {encoding: 'utf-8'})).split('\n');
        for (const row of localeStrings) {
            const [id, message] = row.split('\t').map(part => part.trim());
            this.messages[Number(id)] = message;
        }
    }

    get(id: number | string) {
        if (typeof id === 'string') {
            if (id.startsWith('$')) {
                id = id.substring(1);
            }

            id = Number(id);
        }
        return this.messages[id];
    }
}

export interface LocaleLike {
    get(id: number | string): number;
}
