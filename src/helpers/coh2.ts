import fs from 'fs-extra';
import { capitalize } from './misc';

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

export interface LocaleLike {
    get(id: string): string;
}

export function getReplayTimestamp(ticks: number) {
    return new Date(ticks / 8 * 1000).toISOString().substring(11, 19);
}

export function getReplayDurationDisplay(ticks: number, {verbose}: {verbose?: boolean} = {}) {
    let [hh, mm, ss] = getReplayTimestamp(ticks).split(':');
    hh = (hh != '00') ? `${Number(hh)}${(verbose ? (Number(hh) == 1 ? ' hour' : ' hours') : 'h')}` : '';
    mm = (mm != '00') ? `${Number(mm)}${(verbose ? (Number(mm) == 1 ? ' minute' : ' minutes') : 'm')}` : '';
    ss = (ss != '00' || (hh == '' && mm == '')) ? `${Number(ss)}${(verbose ? (Number(ss) == 1 ? ' second' : ' seconds') : 's')}` : '';
    return [hh, mm, ss].filter(o => !!o).join(' ');
}

export function resolveMapDisplayName(replay: Replay, locale?: LocaleLike) {
    let result = (locale ? locale.get(replay.map.name) : '') || '';
    // Fallback to provided name if it is not a LocString reference
    if (!result && !/\$[abcdef\d]+(:[abcdef\d]+)?/.test(replay.map.name)) {
        result = replay.map.name;
    }

    // Final option: Re-construct the map's name from its filename and player count
    if (!result && replay.map.file) {
        const mapFilename = replay.map.file
            // Normalize path separator
            .replace(/\//g, '\\')
            // Split by path separator
            .split('\\')
            // Take last part (filename)
            .reverse()[0]
        
            // Replace all numeric player count indicators, e.g. 2p, 8P
            .replace(/(\dp)/gi, '')
            // Remove all player count indicators, e.g. (2), (2-4), ( 2 ), ( 2 - 4 )
            .replace(/(\(\s*\d\s*-?\s*?\d?\s*\))/g, '')
            // Replace all underscores with spaces
            .replace(/_/g, ' ')
            // Replace all dashes with spaces
            .replace(/-/g, ' ')
            // Trim whitespace around
            .trim()
        ;
        result = `(${replay.map.players}) ${capitalize(mapFilename)}`;
    }
    return result;
}