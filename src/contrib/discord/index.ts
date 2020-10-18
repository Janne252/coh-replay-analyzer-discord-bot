import Discord, { DiscordAPIError, Guild, TextChannel } from 'discord.js';
import { ChannelLogger, LogLevel } from './logging';
import moment from 'moment';

/**
 * Truncates a value to the maximum length and wraps it in code markdown tags (```).
 */
export function truncatedEmbedCodeField(
    {name, value, inline}: {name: string, value: string, inline?: boolean}, 
    {maxLength}: {maxLength: number} = {maxLength: 1024}
): Discord.EmbedFieldData {
    const prefix = '```\n';
    const suffix = '\n```';
    const max = maxLength - (prefix.length + suffix.length);
    return {
        name,
        inline,
        value: prefix + (value.length > max ? value.substring(0, max) : value) + suffix,
    };
}

/* istanbul ignore next */
/**
 * Uniform exit handing (logout from discord & safely exit)
 */
export class ShutdownManager {
    private hasExited = false;
    constructor(private readonly client: Discord.Client, private readonly logger: ChannelLogger) {
    }

    async exit(params?: {code?: number, signal?: NodeJS.Signals}) {
        if (this.hasExited) {
            return;
        }

        this.hasExited = true;
        try {
            try {
                await this.logger.log({
                    title: 'Shutdown',
                    fields: [
                        { name: 'Exit code', value: `${params?.code ?? '_Unknown_'}`},
                        { name: 'Signal', value: `${params?.signal ?? '_Unknown_'}`},
                    ]
                }, {level: LogLevel.Error, environmentInfo: true});
            } catch (_) {}
            this.client.destroy();
        }
        finally {
            process.exit(params?.code ?? 0);
        }
    }

    addGlobalSignalListeners() {
        process.once('SIGINT', (e) => this.exit({signal: e}));
        process.once('SIGABRT', (e) => this.exit({signal: e}));
        process.once('SIGTERM', (e) => this.exit({signal: e}));
    }
}

export class MessageHelpers {
    public static strip(message: {content: string}, {keepMentions}: {keepMentions?: boolean} = {}) {
        let result = message.content.trim();
        if (!keepMentions) {
            result = result.replace(/<@!?\d+>/g, '').trim()
        }
        return result;
    }
}

export function getGuildUrl(guild: Guild | string, channel?: Discord.Channel | string) {
    const guildId = typeof guild === 'string' ? guild : guild.id;
    const channelId = channel ? (typeof channel === 'string' ? channel : channel.id) : null;
    return `https://discord.com/channels/${guildId}${channelId ? '/' + channelId : ''}`;
}

export async function getAllChannelMessages(channel: TextChannel, sort = true) {
    let before = undefined;
    const count = 100;
    const result: Discord.Message[] = [];
    while (true) {
        const batch: Discord.Message[] = (await channel.messages.fetch({ limit: count, before })).array();
        if (batch.length == 0) {
            break;
        }
        result.push(...batch);
        before = batch[batch.length - 1].id;
    }

    if (sort) {
        result.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    }

    return result;
}

export async function deleteMessageById(channel: Discord.TextChannel, ...ids: string[]) {
    for (const id of ids) {
        try {
            const message = await channel.messages.fetch(id);
            await message.delete();
        } catch (error) {
            if (error instanceof DiscordAPIError && error.httpStatus === 404 && error.message === 'Unknown Message') {
                // Already deleted
            } else {
                // Some other failure, propagate
                throw error;
            }
        }
    }
}

export async function autoDeleteRelatedMessages({client, timeoutSeconds, triggers, targets}: {client: Discord.Client, timeoutSeconds: number, triggers: string[], targets: string[]}) {
    const listener = async (deletedMessage: Discord.Message | Discord.PartialMessage) => {
        // Delete message if it's one of the triggers
        if (triggers.some(i => i === deletedMessage.id)) {
            removeListener();
            await deleteMessageById(deletedMessage.channel as Discord.TextChannel, ...targets);
        }
    };
    const removeListener = () => client.off('messageDelete', listener);

    client.on('messageDelete', listener);
    // Stop listening eventually
    setTimeout(removeListener, timeoutSeconds * 1000);
}

export function getUserReferenceEmbedField(user?: Discord.User): string {

    if (!user) {
        return `_N/A_`;
    }

    return `${user} (${user.username}#${user.discriminator})`;
}

export function getGuildEmbedInfoFields(guild: Discord.Guild, {user, excludeName}: {user?: Discord.User | null, excludeName?: boolean} = {}): Discord.EmbedFieldData[] {
    const result: Discord.EmbedFieldData[] = [];
    if (!excludeName) {
        result.push({
            name: 'Name', value: guild.name,
        });
    }
    result.push(
        { name: 'Owner', value: getUserReferenceEmbedField(guild.owner?.user), inline: true },
        { name: 'Members', value: guild.memberCount, inline: true },
        { name: 'Created at', value: `${guild.createdAt.toDateString()} (_${moment(guild.createdAt).from(moment.utc())}_)`, inline: true },
        { name: 'Locale', value: `\`${guild.preferredLocale}\``, inline: true, },
        { name: 'Region', value: `\`${guild.region}\``, inline: true, },
    );

    if (user) {                    
        const guildMember = guild.member(user?.id as string) as Discord.GuildMember;
        result.push({ 
            name: `Member since`, 
            value: (guildMember ? 
                `${guildMember.joinedAt?.toDateString()} (_${moment(guildMember.joinedAt).from(moment.utc())}_)`
                :  '_Not a member._'
            ), 
            inline: true 
        });
    }
    return result;
}
