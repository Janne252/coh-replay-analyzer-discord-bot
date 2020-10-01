import * as Discord from 'discord.js';
import { getGuildUrl, truncatedEmbedCodeField } from './index';
import { DiagnosticsConfig } from './config';
import os from 'os';

/* istanbul ignore next */
/**
 * Helper for writing log messages to a discord channel.
 */
export class ChannelLogger {
    
    //@ts-expect-error 2564
    private admin: Discord.GuildMember;
    public readonly destination: Record<string, {guild: Discord.Guild, channel: Discord.TextChannel}> = {};

    constructor(private readonly client: Discord.Client, private readonly config: DiagnosticsConfig) {

    }

    private getChannel(level: LogLevelOption) {
        return this.destination[level.name].channel;
    }

    /**
     * Appends a reference of the guild to the embed.
     */
    private appendGuild(embed: Discord.MessageEmbed, guild: Discord.Guild) {
        embed.fields.push({ name: 'Server', value: `[${guild}](${getGuildUrl(guild)})`, inline: false });
    }

    /**
     * Appends a reference of the channel to the embed.
     */
    private appendChannel(embed: Discord.MessageEmbed, channel: Discord.Channel | null) {
        if (channel instanceof Discord.GuildChannel) {
            this.appendGuild(embed, channel.guild);
        }
        embed.fields.push({ name: 'Channel', value: `${channel}`, inline: false });
    }

    /**
     * Appends a reference of the message to the embed.
     */
    private appendMessage(embed: Discord.MessageEmbed, message: Discord.Message) {
        if (message.channel) {
            this.appendChannel(embed, message.channel);
        }
        embed.fields.push({ name: 'Message', value: `[${message.id}](${message.url})`, inline: false });
    }

    /**
     * Initializes the logger by fetching guild, channel, and admin user.
     */
    async init() {
        for (const logLevel of LogLevels) {
            const loggerConfig = this.config[logLevel.name as keyof DiagnosticsConfig] as {guild: string, channel: string};
            const guild = await this.client.guilds.fetch(loggerConfig.guild);
            this.destination[logLevel.name] = {
                guild,
                channel: guild.channels.resolve(loggerConfig.channel) as Discord.TextChannel,
            }
        }
        this.admin = await (await this.client.guilds.fetch(this.config.admin.guild as string)).members.fetch(this.config.admin.user as string);
    }
    
    async log(content: Discord.MessageEmbedOptions = {}, options?: {context?: LoggerContext, level?: LogLevelOption, environmentInfo?: boolean}) {
        const timestamp = new Date();
        const level = options?.level ?? LogLevel.Log;
        const context = options?.context;
        const environmentInfo = options?.environmentInfo ?? false;
        const tagAdmin = level.tagAdmin ?? false;

        content = {
            // defaults
            title:  `ℹ️ ${timestamp.toLocaleString('en-US')}`,
            footer: {text: this.client.user?.username as string, iconURL: this.client.user?.avatarURL() ?? undefined},
            color: level.color,
            // Overrides
            ...content,
        }
        const embed = new Discord.MessageEmbed(content);
        if (context) {
            if (context instanceof Discord.Guild) {
                this.appendGuild(embed, context);

            } else if (context instanceof Discord.Channel) {
                this.appendChannel(embed, context);

            } else if (context instanceof Discord.Message) {
                this.appendMessage(embed, context);
            }
        }
        if (environmentInfo) {
            embed.addFields({name: 'Hostname', value: os.hostname()})
        }
        embed.addFields(
            { name: 'Timestamp', value: timestamp.toISOString(), inline: true },
        );
        
        const channel = this.getChannel(level);
        // Tag admin first
        // If we tag them in the embed, they will not get a notification
        // https://discordjs.guide/popular-topics/embeds.html#notes
        if (tagAdmin) {
            await channel.send(`${this.admin}`);
        }
        const result = await channel.send(embed);
        return {embed, result};
    }

    /**
     * Writes an error message.
     */
    async error(error: Error, context?: LoggerContext) {
        const fields: Discord.EmbedFieldData[] = [
            truncatedEmbedCodeField({name: 'Name', value: error.name || '_No error available._'}),
            truncatedEmbedCodeField({name: 'Message', value: error.message || '_No message available._'}),
            truncatedEmbedCodeField({name: 'Stacktrace', value: error.stack ? 'Loading...' : '_No stacktrace available._'}),
        ];
      
        const {embed, result} = await this.log({
            title: `❗ ${error}`,
            fields,
        }, {
            context, 
            level: LogLevel.Error
        });

        if (error.stack) {
            const stacktraceMessages = await this.destination[LogLevel.Error.name].channel.send(
                error.stack
                    .split('\n')
                    .map(line => `> ${line}`), 
                { split: true }
            );
            
            const url = Array.isArray(stacktraceMessages) ? (stacktraceMessages as Discord.Message[])[0].url : stacktraceMessages.url;
            embed.fields[2].value = `[Show](${url})`;
            await result.edit(embed);
        }
    }

    /**
     * Attempts to send an error message when process receives an error event.
     * Supported error events: uncaughtException, unhandledRejection.
     */
    addGlobalErrorListeners() {
        const callback = async (error: Error) => {
            try {
                await this.error(error);
            }
            catch (e) {
                console.error(error);
                console.error(e);
            }
        }
        
        process.on('uncaughtException', callback);
        process.on('unhandledRejection', callback);
    }
}

export type LoggerContext = Discord.Guild | Discord.Channel | Discord.Message;
export interface LogLevelOption {
    readonly name: string;
    readonly color: number;
    readonly tagAdmin: boolean;
}

export class LogLevel {
    // Value should match the name of LogColor value
    public static readonly Log: LogLevelOption = {
        name: 'log', 
        color: 0x2196f3, // Blue
        tagAdmin: false,
    };
    public static readonly Warning: LogLevelOption = {
        name: 'warning', 
        color: 0xffc107, // Orange
        tagAdmin: false,
    };
    public static readonly Error: LogLevelOption = {
        name: 'error', 
        color: 0xf44336, // Red
        tagAdmin: true,
    };
    public static readonly Test: LogLevelOption = {
        name: 'test', 
        color: 0x9c27b0, // Purple
        tagAdmin: false,
    };
}

export const LogLevels = Object.keys(LogLevel).map(key => LogLevel[key as keyof LogLevel] as LogLevelOption);
