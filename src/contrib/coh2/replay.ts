import path from 'path';
import { capitalize } from '../misc';
import { LocaleLike } from '.';
import { InputData } from '../../types';
import ReplaysConfig from '../../commands/parse-replay/config';

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

export function getReplayDurationDisplay(ticks: number, {verbose}: {verbose?: boolean} = {}) {
    let [hh, mm, ss] = getReplayTimestamp(ticks).split(':');
    hh = (hh != '00') ? `${Number(hh)}${(verbose ? (Number(hh) == 1 ? ' hour' : ' hours') : 'h')}` : '';
    mm = (mm != '00') ? `${Number(mm)}${(verbose ? (Number(mm) == 1 ? ' minute' : ' minutes') : 'm')}` : '';
    ss = (ss != '00' || (hh == '' && mm == '')) ? `${Number(ss)}${(verbose ? (Number(ss) == 1 ? ' second' : ' seconds') : 's')}` : '';
    return [hh, mm, ss].filter(o => !!o).join(' ');
}

export function resolveScenarioId(replay: Data) {
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

export function resolveScenarioDisplayName(replay: InputData<ReplayData, 'map'>, locale?: LocaleLike) {
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
 * Prefixes player name with the faction emoji.
 * Adds a link to the official leaderboards if the player has a valid Steam ID available.
 * @param player 
 */
export function formatPlayer(
    player: InputData<ReplayPlayer, 'name' | 'steam_id_str' | 'faction'>, 
    config: InputData<ReplaysConfig, 'factionEmojis' | 'leaderboardUrl'>
) {
    let playerNameDisplay = player.name;
    if (player.steam_id_str && player.steam_id_str != '0') {
        const url = (
            config.leaderboardUrl ?? 
            `http://www.companyofheroes.com/leaderboards#profile/steam/{steamId}/standings`
        )
            .replace(/\{steamId\}/g, player.steam_id_str)
        ;
        playerNameDisplay = `[${player.name}](${url})`;
    }

    return `${player.faction in config.factionEmojis ? (config.factionEmojis[player.faction]) + ' ' : ''}${playerNameDisplay}`;
}

export function getPlayerListEmbed(
    replay: {players: InputData<ReplayPlayer, 'name' | 'faction' | 'team' | 'steam_id_str'>[]}, 
    team: 0 | 1, 
    config: InputData<ReplaysConfig, 'factionEmojis' | 'leaderboardUrl'>
) {
    return { 
        inline: true, 
        name: `Team ${team + 1}`, 
        value: replay.players
            .filter(p => p.team == team)
            .map(p => formatPlayer(p, config))
            .join('\n') || '_No players available._'
    };
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