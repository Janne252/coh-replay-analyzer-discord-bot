import fs from 'fs-extra';
import i18n from '../i18n';

/**
 * Represents a a wrapper class that provides localized strings from a RelicCOH2.<language>.ucs file.
 */
export class Locale implements LocaleLike {
    public static readonly Empty = new Locale();
    public isInitialized = false;

    /**
     * @param idPrefix Prefixed added to each message ID. Defaults to '$'.
     */
    constructor(private readonly messages: Record<string, Record<number, string>> = {}) {

    }

    async init(locales: Record<string, string>) {
        for (const localeName in locales) {
            const filepath = locales[localeName];
            const localeStrings = (await fs.readFile(filepath, {encoding: 'ucs-2'})).split('\n');
            this.messages[localeName] = {};

            for (const row of localeStrings) {
                const [id, message] = row.split('\t').map(part => part.trim());
                this.messages[localeName][Number(id)] = message;
            }
        }
        this.isInitialized = true;
    }

    get(id: number | string, locale?: string) {
        if (typeof id === 'string') {
            if (id.startsWith('$')) {
                id = id.substring(1);
            }

            id = Number(id);
        }
        return (this.messages[locale ?? i18n.activeLocale] ?? {})[id];
    }
}

export interface LocaleLike {
    get(id: number | string, locale?: string): string;
}
