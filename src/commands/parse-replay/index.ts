import path from 'path';
import fs from 'fs-extra';
import * as Discord from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import download from 'download';
import { exec } from '../../contrib/misc';
import * as Replay from '../../contrib/coh2/replay';
import Config from './config';
import { ChannelLogger } from '../../contrib/discord/logging';
import I18n from '../../contrib/i18n';

export default async (message: Discord.Message, client: Discord.Client, logger: ChannelLogger, i18n: I18n, config: Config): Promise<boolean> => {
    const attachments = message.attachments.array();
    let isHandled = false;

    for (const attachment of attachments) {
        if (!shouldProceedBasedOnFilename(attachment)) {
            continue;
        }
        // Mark message as handled - no other handler should attempt to process it
        isHandled = true;
        // Download replay file contents to a temporary file
        const replayFilename = path.join(config.replaysTempPath, `${uuidv4()}.rec`);
        const data = await download(attachment.url);
        if (data.length < config.minDataLength) {
            throw new Error(`Invalid replay file data length ${data.length}, expected at least ${config.minDataLength}`);
        }
        const [, , version, magic] = [data[0], data[1], data.readInt16LE(2), String.fromCharCode.apply(null, [...data.slice(4, 4 + 8)])];
        
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

            const scenarioPreviewImageFilename = `${Replay.resolveScenarioId(replay)}.jpg`;
            const scenarioPreviewImageFilepath = path.join(config.scenarioPreviewImageRootPath, scenarioPreviewImageFilename);
   
            const embed = new Discord.MessageEmbed();
            embed.setTitle(Replay.resolveScenarioDisplayName(replay));
            embed.addFields(
                Replay.getPlayerListEmbed(replay, 0, config),
                Replay.getPlayerListEmbed(replay, 1, config),
            );
            const loadAllChatTip = i18n.get(
                'replay.chat.loadAllByReacting', message.guild?.preferredLocale, {
                    '@user': message.author.toString(),
                    'emoji': `\xa0 ${config.expandChatPreview.reaction} \xa0`
                }
            );
            const chatPreview = getChatPreviewEmbed(replay, {charsPerChunk: 1024 - loadAllChatTip.length});
            if (!chatPreview.complete) {
                chatPreview.field.value += loadAllChatTip;
            }
            embed.addFields(chatPreview.field);
            const chatPreviewIndex = embed.fields.length - 1;

            embed.addFields(
                { name: 'Match duration', value: `||${Replay.getReplayDurationDisplay(replay.duration, {verbose: true})}||`, inline: true},
                { name: 'Game version', value: `4.0.0.${replay.version}`, inline: true},
            );
            // Attach the scenario preview image to the message if there's one available.
            // TODO: Use a CDN to host these images (see readme.md in the project root)
            // TODO: use an async operation for checking if the file exists
            if (fs.existsSync(scenarioPreviewImageFilepath)) {
                embed.attachFiles([scenarioPreviewImageFilepath]);
                embed.setImage(`attachment://${scenarioPreviewImageFilename}`);
            } else {
                embed.addField('\u200b', '_No map preview image available. If this is an official map, please contact an admin on the server._');
            }
            embed.setFooter(client.user?.username, client.user?.avatarURL() as string);
            
            const result = await message.channel.send(embed);
            if (!chatPreview.complete) {
                await awaitPostExpandedChat(replay, result, message.author, embed, config, { chatPreviewIndex });
            }
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

function getChatPreviewEmbed(replay: Replay.Data, {charsPerChunk}: {charsPerChunk?: number} = {}) {
    if (!replay.chat || replay.chat.length == 0) {
        return {
            complete: true,
            field: {name: 'Chat', value: '_No chat._', inline: false},
        };
    }

    const chunks = Replay.splitChat(replay, {charsPerChunk: charsPerChunk ?? 1024});
    const complete = chunks.length == 1;
    let title = 'Chat';
    if (!complete) {
        title = `Chat (${chunks[0].count}/${replay.chat.length})`;
    }

    return {
        complete,
        field: {name: title, value: chunks[0].content, inline: false},
    };
}

function shouldProceedBasedOnFilename(attachment: Discord.MessageAttachment) {
    return attachment && attachment.name && attachment.name.endsWith('.rec');
}

async function awaitPostExpandedChat(
    replay: Replay.Data, 
    message: Discord.Message, 
    author: Discord.User,
    embed: Discord.MessageEmbed, 
    config: Config, 
    {chatPreviewIndex}: {chatPreviewIndex: number}
) {
    // Placeholder reaction for the user
    const selfReaction = await message.react(config.expandChatPreview.reaction);
    const chatOutputMessages: Discord.Message[] = [];
    const reactions = await message.awaitReactions(
        (reaction, user) => user.id == author.id && reaction.emoji.name == config.expandChatPreview.reaction, 
        {time: config.expandChatPreview.timeoutSeconds * 1000, max: 1}
    );
    if (reactions.array().some(reaction => reaction.emoji.name == config.expandChatPreview.reaction)) {
        await selfReaction.remove();
        // Send replay chat as block quote messages
        // Utilize Discord's automatic splitting functionality when passing message data as an array
        const result = await message.channel.send(
            replay.chat.map(message => `> ${Replay.formatChatMessage(message, {noNewline: true})}`), 
            {split: true}
        );
        chatOutputMessages.push(...(!Array.isArray(result) ? [result] : result));
    }
    if (chatOutputMessages.length > 0) {
        embed.fields[chatPreviewIndex].name = 'Chat';
        embed.fields[chatPreviewIndex].value = `[Show](${chatOutputMessages[0].url})`;
    } else {
        embed.fields[chatPreviewIndex] = getChatPreviewEmbed(replay).field;
    }
    await message.edit(embed);
    await selfReaction.remove();
}