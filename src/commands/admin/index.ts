import path from 'path';
import fs from 'fs-extra';
import * as Discord from "discord.js";
import { getGuildUrl, MessageHelpers } from '../../contrib/discord';
import { makeLength } from '../../contrib/testing/generator';
import { DiagnosticsConfig } from '../../contrib/discord/config';
import moment from 'moment';
import { ChannelLogger, LogLevels } from '../../contrib/discord/logging';

const root = process.cwd();

export default async (message: Discord.Message, client: Discord.Client, logger: ChannelLogger, config: DiagnosticsConfig) => {
    const isAdmin = isAdminCommand(message, client, config);
    const command = MessageHelpers.strip(message);

    if (isAdmin) {
        const guild = await client.guilds.fetch(config.test.guild as string);
        const channel = guild?.channels.resolve(config.test.channel as string) as Discord.TextChannel;

        switch (command) {
            case 'ping':
                await message.reply('pong');
                return true;
            // Used to get a quick overview of the servers the bot is currently in
            case 'telemetry:servers': {
                const guilds = client.guilds.cache.array();
                await message.reply(`${client.user} is currently active on ${guilds.length} server${guilds.length == 1 ? '' : 's'}.`);
                for (const guild of guilds) {
                    const iconUrl = guild.iconURL();
                    const guildMember = guild.member(client.user?.id as string) as Discord.GuildMember;
                    await message.reply(new Discord.MessageEmbed({
                        title: guild.name,
                        thumbnail: iconUrl ? {url: iconUrl } : undefined,
                        description: `[View in browser](${getGuildUrl(guild)})`,
                        fields: [
                            { name: 'Owner', value: `${guild.owner}`, inline: true },
                            { name: 'Members', value: guild.memberCount, inline: true },
                            { name: 'Created', value: `${moment(guild.createdAt).from(moment.utc())}\n_${guild.createdAt.toDateString()}_`, inline: true },
                            { name: 'Added', value: `${moment(guildMember.joinedAt).from(moment.utc())}\n_${guildMember.joinedAt?.toDateString()}_`, inline: true },
                            { name: 'Locale', value: `\`${guild.preferredLocale}\``, inline: true, },
                            { name: 'Region', value: `\`${guild.region}\``, inline: true, },
                        ],
                        footer: guild.description ? {text: guild.description} : undefined,
                    }));
                }
                return true;
            }
            case 'test:logs': {
                for (const logLevel of LogLevels) {
                    await message.reply(new Discord.MessageEmbed({description: `Beginning to write "${logLevel.name}" to ${logger.destination[logLevel.name].channel}...`}));
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
                return await testReplays(message, channel);
            }
            case 'test:replays-compact': {
                return await testReplays(message, channel, 'compact');
            }
            // Used to test embed character count limitations
            case 'test:embed': {
                const embed = new Discord.MessageEmbed();
                const url = client.user?.avatarURL() as string;

                embed.author = {
                    name: makeLength('author name', 256),
                    url: url,
                    iconURL: url,
                    proxyIconURL: url,
                };
                embed.title = makeLength('title', 256);
                embed.description = makeLength('description', 2048);
                embed.footer = {
                    text: makeLength('footer', 2048),
                    iconURL: url,
                    proxyIconURL: url,
                };
                const usedSofar = embed.length;
                const available = 6000 - usedSofar;
                const embedTitles = 25 * 10;
                const embedValues = available - embedTitles;
                const perEmbedValue = Math.floor(embedValues / 25);
                const plusLastEmbedValue = embedValues % 25;
                // Max number of embed fields
                for (let i = 0; i < 25; i++) {
                    embed.addFields({
                        name: makeLength('embed name', 10),
                        value: makeLength('embed value', perEmbedValue + (i == 24 ? plusLastEmbedValue : 0)),
                    })
                }
                const totalEmbedCharacters = embed.length;
                await channel.send(embed);
                return true;
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

async function testReplays(userMessage: Discord.Message, channel: Discord.TextChannel, messageContent = '') {
    await userMessage.reply(new Discord.MessageEmbed({description: `Beginning to upload replays to ${channel}...`}));
    for (const file of await fs.readdir(path.join(root, 'tests/replays'))) {
        const attachment = new Discord.MessageAttachment(path.join(root, 'tests/replays', file));
        await channel.send(messageContent, attachment);
        await new Promise((resolve, reject) => {
            setTimeout(resolve, 2000);
        });
    }
    return true;
}