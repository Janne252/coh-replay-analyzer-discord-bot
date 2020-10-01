import path from 'path';
import { capitalize } from '../misc';
import { LocaleLike } from '.';
import { InputData } from '../../types';
import ReplaysConfig from '../../commands/parse-replay/config';
import i18n from '../i18n';

export function formatChatMessage(
    message: InputData<ReplayChatMessage, 'message' | 'name' | 'tick'>, 
    {noNewline}: {noNewline?: boolean} = {}
) {
    
    let timestamp = getReplayTimestamp(message.tick);
    timestamp = '`' + timestamp + '`';
    return `${timestamp} **${message.name}**: ${message.message}${noNewline ? '' : '\n'}`;
}

export function splitChat(replay: InputData<ReplayData, 'chat'>, {charsPerChunk}: {charsPerChunk?: number} = {}) {
    charsPerChunk = charsPerChunk ?? 1024;
    const chunks: ({count: number, content: string})[] = [];
    const prefix = '||';
    const suffix = '||';
    let chunkCharLength = prefix.length + suffix.length;
    let buffer: string[] = [];
    
    const queue = [...replay.chat];
    while (queue.length > 0 || buffer.length > 0) {
        const message = queue.shift();
        const line = message != null ? formatChatMessage(message) : null;
        if (
            line == null ||
            (chunkCharLength + line.length > charsPerChunk)
        ) {
            if (buffer.length > 0) {
                chunks.push({
                    count: buffer.length,
                    content: `${prefix}${buffer.join('')}${suffix}`,
                });
                buffer = [];
            }
            chunkCharLength = 0;
        }

        if (line != null) {
            buffer.push(line);
            chunkCharLength += line.length;
        }
    }

    /* istanbul ignore next */
    // Assert
    if (buffer.length > 0) {
        throw new Error(`Remaining data in buffer`);
    }

    return chunks;
}

export function getReplayTimestamp(ticks: number) {
    return new Date(ticks / 8 * 1000).toISOString().substring(11, 19);
}

export function getReplayDurationDisplay(ticks: number, {units}: {units?: boolean} = {units: true}) {
    let timestamp = getReplayTimestamp(ticks);
    if (!units) {
        return timestamp;
    }
    let [hh, mm, ss] = timestamp.split(':');
    hh = (hh != '00') ? `${Number(hh)}${(Number(hh) == 1 ? ` ${i18n.get('time.hour')}` : ` ${i18n.get('time.hours')}`)}` : '';
    mm = (mm != '00') ? `${Number(mm)}${(Number(mm) == 1 ? ` ${i18n.get('time.minute')}` : ` ${i18n.get('time.minutes')}`)}` : '';
    ss = (ss != '00' || (hh == '' && mm == '')) ? `${Number(ss)}${(Number(ss) == 1 ? ` ${i18n.get('time.second')}` : ` ${i18n.get('time.seconds')}`)}` : '';
    return [hh, mm, ss].filter(o => !!o).join(' ');
}

export function resolveScenarioId(replay: {map: {file: string}}) {
    return replay.map.file
        .replace(/data:/gi, '')
        .replace(/\\/g, '/')
        .replace(/\//g, '-')
        .replace(/ /g, '-')
        .replace(/_/g, '-')
        .replace(/:/g, '')
        .replace(/[\-]+/g, '-')
        .replace(/^\//g, '').replace(/\/$/g, '')  // Same as C# .Trim('\\')
        .replace(/^-/g, '').replace(/-$/g, '')  // Same as C# .Trim('-')
        .toLowerCase()
    ;
}

export function resolveScenarioDisplayName(replay: {map: {name: string, file: string, players: number}}, locale?: LocaleLike) {
    let result = (locale ? locale.get(replay.map.name) : '') || '';
    // Fallback to provided name if it is not a LocString reference
    if (!result && !/\$[abcdef\d]+(:[abcdef\d]+)?/.test(replay.map.name)) {
        result = replay.map.name;
    }

    // Final option: Re-construct the map's name from its filename and player count
    if (!result && replay.map.file) {
        const mapFilename = replay.map.file
            // Normalize path separator
            .replace(/\\/g, '/')
            // Split by path separator
            .split('/')
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


/**
 * Definition for https://github.com/ryantaylor/vault JSON output.
 * Semantic name "ReplayData" in the replay module and Replay.Data in external modules.
 */
interface ReplayData {
    version: string;
    chat: ReplayChatMessage[];
    date_time: string;
    duration: number;
    game_type: string;
    map: {
        file: string;
        name: string;
        description: string;
        description_long: string;
        width: number;
        height: number;
        players: number;
    };

    players: ReplayPlayer[];
}

// Renamed export
export interface Data extends ReplayData {};

export interface ReplayChatMessage {
    tick: number;
    name: string;
    message: string;
}

export interface ReplayPlayer {
    id: number;
    name: string;
    steam_id: number;
    steam_id_str: string;
    team: 0 | 1;
    faction: string;
    commander: number;
    items: {
        selection_id: number;
        server_id: number;
        item_type: string;
    }[];
}