import path from 'path';
import fs, { WriteStream } from 'fs-extra';
import * as Discord from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import download from 'download';
import { exec } from '../../contrib/misc';
import * as Replay from '../../contrib/coh2/replay';
import { ChannelLogger, LogLevel } from '../../contrib/discord/logging';
import { ReplayEmbed, CompactReplayEmbed } from './embed';
import { MessageHelpers } from '../../contrib/discord';
import { client, locales, logger } from '../..';
import { readToEnd } from '../../contrib/io';
import { AttachmentStub } from '../../types';
import ReplaysConfig from './config';
import { PackageJsonConfig } from '../../contrib/config';

export interface InputMessage {
    client: Discord.Message['client'];
    id: Discord.Snowflake;
    content: string;
    attachments: Discord.Collection<Discord.Snowflake, AttachmentStub>;
    channel: Discord.Message['channel'];
    author: Discord.User;
    url: string;
    reply?: Discord.Message['reply']
}

export default async (message: InputMessage, {forceCompact}: {forceCompact?: boolean} = {}): Promise<boolean> => {
    let config = new ReplaysConfig();
    PackageJsonConfig.assign(config, 'replays.common');
    const attachments = [...message.attachments].map(([id, attachment]) => attachment);
    let isHandled = false;

    for (const attachment of attachments) {
        if (!attachment || !attachment.name || !attachment.name.endsWith('.rec')) {
            continue;
        }

        const command = MessageHelpers.strip(message);
        // Mark message as handled - no other handler should attempt to process it
        isHandled = true;
        // Download replay file contents to a temporary file
        const replayFilename = path.join(config.replaysTempPath, `${uuidv4()}.rec`);
        if (attachment.stream == null && attachment.url == null) {
            throw new Error(`either url or stream of attachment must be set`)
        }
        const data = attachment.stream ? await readToEnd(attachment.stream as fs.ReadStream) : await download(attachment.url as string)
        if (data.length < config.minDataLength) {
            throw new Error(`Invalid replay file data length ${data.length}, expected at least ${config.minDataLength}`);
        }
        const [, , version, magic] = [data[0], data[1], data.readInt16LE(2), String.fromCharCode.apply(null, [...data.slice(4, 12)]).replace(/\0$/, '')];
        
        config = new ReplaysConfig();
        await PackageJsonConfig.assign(config, 'replays.common');
        await PackageJsonConfig.assign(config, `replays.magic.${magic}`);
        await config.init();
        
        // Not a CoH2 replay or too early version for https://github.com/ryantaylor/vault
        if (magic != config.magic) {
            logger.log({title: 'Invalid magic', description: `Unexpected replay header magic "${magic}", expected "${config.magic}"`}, {level: LogLevel.Log});
            continue
        }
        else if (version < config.minVersion) {
            logger.log({title: 'Unsupported version', description: `Unexpected replay header version ${version}, expected at least ${config.minVersion}`}, {level: LogLevel.Warning});
            continue
        }

        if (locales[magic] && !locales[magic].isInitialized) {
            await locales[magic].init(config.localeFilePaths);
        }

        try {
            await fs.writeFile(replayFilename, data);
            
            /**
                FLAGS:
                    -l, --log        Enables debug logging to stdout
                    -n, --nocmd      Skips command parsing
                    -s, --strict     Rejects files without the .rec extension
                    -w, --wipecmd    Parses command info but wipes them before output
                    -h, --help       Prints help information
                    -V, --version    Prints version information
            */
            const {stdout} = await exec(`${config.flankExecutablePath} ${config.flankArgs} ${replayFilename}`);
            let rawData = JSON.parse(stdout);
            let replay: Replay.Data;

            if (magic == 'COH3_RE') {
                let data = rawData as Replay.CoH3ReplayData;
                replay = {
                    map: {
                        file: data.map.filename,
                        name: data.map.localized_name_id,
                        description: data.map.localized_description_id,
                        description_long: '',
                        width: 0,
                        height: 0,
                        players: data.players.length,
                    },
                    chat: [], 
                    date_time: data.timestamp,
                    duration: data.length,
                    error: null,
                    players: data.players.map((player) => ({
                        name: player.name,
                        commander: 0,
                        battlegroup: player.battlegroup,
                        faction: player.faction,
                        id: 0,
                        items: [],
                        team: player.team === 'First' ? 0 : 1,
                        steam_id: Number(player.steam_id),
                        steam_id_str: player.steam_id,
                        profile_id: player.profile_id,
                    })),
                    game_type: '',
                    version: data.version,
                }
                for (const player of data.players) {
                    replay.chat.push(...player.messages.map(({message, tick}) => ({
                        message, 
                        tick,
                        name: player.name
                    })))
                }
            } else {
                replay = rawData 
            }
            
            let EmbedType: typeof ReplayEmbed | typeof CompactReplayEmbed;
            const permissions = (message.channel as Discord.TextChannel).permissionsFor(client.user as Discord.User);
            if (permissions?.has(Discord.PermissionFlagsBits.ManageMessages) && command != 'compact' && !forceCompact) {
                EmbedType = ReplayEmbed;
            } else {
                EmbedType = CompactReplayEmbed;
            }
            const embed = new EmbedType(client, message, attachment, replay, config, locales[magic]);
            await embed.submit();
        } catch (error) {
            // Propagate
            throw error;
        } finally {
            // Always (try) delete temporarily stored replay file
            await fs.unlink(replayFilename);
        }
    }
    // at least one attachment was successfully processed
    return isHandled;
};
