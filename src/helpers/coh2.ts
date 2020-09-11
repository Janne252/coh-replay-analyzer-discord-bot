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

export function getReplayTimestamp(ticks: number) {
    return new Date(ticks / 8 * 1000).toISOString().substring(11, 19);
}

export function getReplayDurationDisplay(ticks: number, {verbose}: {verbose?: boolean} = {}) {
    let [hh, mm, ss] = getReplayTimestamp(ticks).split(':');
    hh = (hh != '00') ? `${Number(hh)}${' '}${(verbose ? (Number(hh) == 1 ? 'hour' : 'hours') : 'h')} ` : '';
    mm = (mm != '00') ? `${Number(mm)}${' '}${(verbose ? (Number(mm) == 1 ? 'minute' : 'minutes') : 'm')} ` : '';
    ss = `${Number(ss)}${' '}${(verbose ? (Number(ss) == 1 ? 'second' : 'seconds') : 's')}`;
    return `${hh}${mm}${ss}`;
}