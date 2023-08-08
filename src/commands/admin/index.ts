import path from 'path';
import fs from 'fs-extra';
import * as Discord from "discord.js";
import { getGuildEmbedInfoFields, getGuildUrl, MessageHelpers } from '../../contrib/discord';
import { DiagnosticsConfig } from '../../contrib/discord/config';
import { ChannelLogger, LogLevels } from '../../contrib/discord/logging';
import { Readable } from 'stream';
import tryParseCoH2Replay from '../../commands/parse-replay';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../..';

const root = process.cwd();

async function sendLocalReplayEmbed(context: Discord.Message, replayFilepath: string, {forceCompact}: {forceCompact?: boolean} = {}) {
    if(!(await fs.pathExists(replayFilepath))) {
        await context.reply(`\`${replayFilepath}\` does not exist.`);
        return;
    }

    const replayId = uuidv4();
    const stream = fs.createReadStream(replayFilepath);
    try {
        await tryParseCoH2Replay({
            client: context.client,
            author: context.author,
            channel: context.channel as Discord.TextChannel,
            content: context.content,
            id: context.id,
            url: context.url,
            attachments: new Discord.Collection([[
                replayId, 
                { name: `${replayId}.rec`, stream }
            ]]),
            reply: context.reply.bind(context),
        }, {forceCompact});
    } finally {
        stream.close();
    }
}

export default async (message: Discord.Message, client: Discord.Client, logger: ChannelLogger, config: DiagnosticsConfig) => {
    const isAdmin = isAdminCommand(message, client, config);
    const command = MessageHelpers.strip(message);

    if (isAdmin) {
        const guild = await client.guilds.fetch(config.test.guild as string);
        const channel = guild?.channels.resolve(config.test.channel as string) as Discord.TextChannel;

        if (command.startsWith('dump:message')) {
            const [guildId, channelId, messageId] = command.substring('dump:message'.length).split('/').map(o => o.trim());
            const targetGuild = await client.guilds.fetch(guildId);
            const targetChannel = targetGuild.channels.cache.get(channelId) as Discord.TextChannel;
            const targetMessage = await targetChannel.messages.fetch(messageId);
            const attachment = new Discord.AttachmentBuilder(Readable.from(JSON.stringify(targetMessage.toJSON(), null, 4))).setName(`${messageId}.json`);
            await message.reply({files: [attachment]});
        } else if (command.startsWith('test:replay ')) {
            const testReplayFilepath = path.join(root, 'tests/replays', command.substring('test:replay'.length).trim());
            await sendLocalReplayEmbed(message, testReplayFilepath);
        } else if (command.startsWith('test:replay-compact ')) {
            const testReplayFilepath = path.join(root, 'tests/replays', command.substring('test:replay-compact'.length).trim());
            await sendLocalReplayEmbed(message, testReplayFilepath, {forceCompact: true});
        }
        switch (command) {
            case 'ping':
                await message.reply('pong');
                return true;
            // Used to get a quick overview of the servers the bot is currently in
            case 'telemetry:servers': {
                const guilds = await client.guilds.fetch();
                await message.reply(`${client.user} is currently active on ${guilds.size} server${guilds.size == 1 ? '' : 's'}.`);
                for (const [id, oAuthGuild] of guilds) {
                    const guild = await oAuthGuild.fetch();
                    const iconUrl = guild.iconURL();
                    await message.reply({embeds: [new Discord.EmbedBuilder({
                        title: guild.name,
                        thumbnail: iconUrl ? {url: iconUrl } : undefined,
                        description: `[View in browser](${getGuildUrl(guild)})`,
                        fields: [
                            ...await getGuildEmbedInfoFields(guild, {user: client.user, excludeName: true}),
                        ],
                        footer: guild.description ? {text: guild.description} : undefined,
                    })]});
                }
                return true;
            }
            case 'test:logs': {
                for (const logLevel of LogLevels) {
                    await message.reply({embeds: [new Discord.EmbedBuilder({description: `Beginning to write "${logLevel.name}" to ${logger.destination[logLevel.name].channel}...`})]});
                    await logger.log({
                        title: `Test: "${logLevel.name}"`,
                        fields: [
                            { name: 'name', value: `\`${logLevel.name}\``, inline: true, },
                            { name: 'color', value: `\`${logLevel.color}\``, inline: true, },
                            { name: 'tagAdmin', value: `\`${logLevel.tagAdmin}\``, inline: true, },
                        ]
                    }, {level: logLevel});
                }
                return true;
            }
            // Used to test replay parsing by posting all the test replays
            case 'test:replays': {
                return await testReplays(message, message.channel as Discord.TextChannel);
            }
            case 'test:replays-compact': {
                return await testReplays(message, message.channel as Discord.TextChannel, {forceCompact: true});
            }
        }
    }

    return false;
}

export function isAdminCommand(message: Discord.Message, client: Discord.Client, config: DiagnosticsConfig) {
    return (
        message.author.id !== client.user?.id && 
        message.mentions.users.has(client.user?.id as string) && 
        message.author.id === config.admin.user
    );
}

async function testReplays(userMessage: Discord.Message, channel: Discord.TextChannel, {forceCompact}: {forceCompact?: boolean} = {}) {
    await userMessage.reply({embeds: [new Discord.EmbedBuilder({description: `Beginning to upload replays to ${channel}...`})]});
    const replaysRootPath = path.join(root, 'tests/replays');
    for (const file of await fs.readdir(replaysRootPath)) {
        await sendLocalReplayEmbed(userMessage, path.join(replaysRootPath, file), {forceCompact});
        await new Promise((resolve, reject) => {
            setTimeout(resolve, 1000);
        });
    }
    return true;
}