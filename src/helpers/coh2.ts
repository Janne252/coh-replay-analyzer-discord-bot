import fs from 'fs-extra';

/**
 * Represents a a wrapper class that provides localized strings from a RelicCOH2.<language>.ucs file.
 */
export class Locale {
    private readonly messages: Record<string, string> = {};
    /**
     * 
     * @param filepath 
     * @param idPrefix Prefixed added to each message ID. Defaults to '$'.
     */
    constructor(readonly filepath: string, private readonly idPrefix = '$') {

    }

    async init() {
        const localeStrings = (await fs.readFile(this.filepath, {encoding: 'utf-8'})).split('\n');
        for (const row of localeStrings) {
            const [id, message] = row.split('\t').map(part => part.trim());
            this.messages[`${this.idPrefix}${id}`] = message;
        }
    }

    get(id: string) {
        return this.messages[id];
    }
}

export function getReplayDurationDisplay(duration: number) {
    let [hh, mm, ss] = new Date(100 * 24168).toISOString().substring(11, 19).split(':');
    hh = hh != '00' ? `${hh}h ` : '';
    mm = mm != '00' ? `${mm}m ` : '';
    ss = `${ss}s`;
    return `${hh}${mm}${ss}`;
}