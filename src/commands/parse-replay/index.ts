import path from 'path';
import fs from 'fs-extra';
import * as Discord from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import download from 'download';
import { exec } from '../../contrib/misc';
import * as Replay from '../../contrib/coh2/replay';
import Config from './config';
import { ChannelLogger } from '../../contrib/discord/logging';
import i18n from '../../contrib/i18n';
import { ReplayEmbed, CompactReplayEmbed, ReplayBaseEmbed } from './embed';
import { MessageHelpers } from '../../contrib/discord';

export default async (message: Discord.Message, client: Discord.Client, logger: ChannelLogger, config: Config): Promise<boolean> => {
    const attachments = message.attachments.array();
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
        const data = await download(attachment.url);
        if (data.length < config.minDataLength) {
            throw new Error(`Invalid replay file data length ${data.length}, expected at least ${config.minDataLength}`);
        }
        const [, , version, magic] = [data[0], data[1], data.readInt16LE(2), String.fromCharCode.apply(null, [...data.slice(4, 12)])];
        
        // Not a CoH2 replay or too early version for https://github.com/ryantaylor/vault
        if (magic != config.magic) {
            throw new Error(`Unexpected replay header magic "${magic}", expected "${config.magic}"`);
        }
        if (version < config.minVersion) {
            throw new Error(`Unexpected replay header version ${version}, expected at least ${config.minVersion}`);
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
            const {stdout} = await exec(`${config.flankExecutablePath} --wipecmd ${replayFilename}`);
            const replay: Replay.Data = JSON.parse(stdout);
            
            let EmbedType: typeof ReplayEmbed | typeof CompactReplayEmbed;
            const permissions = (message.channel as Discord.TextChannel).permissionsFor(client.user as Discord.User);
            if (permissions?.has('MANAGE_MESSAGES') && command != 'compact') {
                EmbedType = ReplayEmbed;
            } else {
                EmbedType = CompactReplayEmbed;
            }
            const embed = new EmbedType(client, message, replay, config);
            await embed.submit();
        } catch (error) {
            // Raise to an outer scope handler
            throw error;
        } finally {
            // Always (try) delete temporarily stored replay file
            await fs.unlink(replayFilename);
        }
    }
    // at least one attachment was successfully processed
    return isHandled;
};
