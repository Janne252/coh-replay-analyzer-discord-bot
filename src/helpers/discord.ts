import fs from 'fs-extra';
import path from 'path';
import Discord from 'discord.js';
import { v4 as uuidv4 } from 'uuid';

export interface ChannelLoggerConfig {
    log: {
        guild: string;
        channel: string;
        administrators: string[];
    }
}

/* istanbul ignore next */
/**
 * package.json section "discord".
 */
export async function getDiscordConfig() {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), 'package.json'), {encoding: 'utf8'})).discord as ChannelLoggerConfig;
}

/* istanbul ignore next */
/**
 * Helper for writing log messages to a discord channel.
 */
export class ChannelLogger {
    public static readonly Color = {
        Info: 0x2196f3, // Blue
        Warning: 0xffc107, // Orange
        Error: 0xf44336, // Red
    };

    private _config: ChannelLoggerConfig | null;

    get config() {
        return this._config as ChannelLoggerConfig;
    }
    
    constructor(private readonly client: Discord.Client, config: ChannelLoggerConfig | null = null) {
        this._config = config;
    }

    async init() {
        if (this._config == null) {
            this._config = await getDiscordConfig();
        }
    }

    async log(options: Discord.MessageEmbedOptions = {}) {
        const guild = await this.client.guilds.fetch(this.config.log.guild);
        const channel = guild.channels.resolve(this.config.log.channel) as Discord.TextChannel;
        const timestamp = new Date();
        options = {
            // defaults
            title:  `ℹ️ ${timestamp.toLocaleString('en-US')}`,
            footer: {text: this.client.user?.username as string, iconURL: this.client.user?.avatarURL() ?? undefined},
            color: ChannelLogger.Color.Info,
            // Overrides
            ...options,
        }
        const embed = new Discord.MessageEmbed(options);
        embed.addFields(
            { name: 'Timestamp', value: timestamp.toISOString(), inline: true },
        );
    
        await channel.send(embed);
    }

    /**
     * Writes an error message.
     */
    async error(error: Error) {
        await this.log({
            title: `❗ ${error}`,
            fields: [
                truncatedEmbedCodeField({name: 'Name', value: error.name || '_No error available._'}),
                truncatedEmbedCodeField({name: 'Message', value: error.message || '_No message available._'}),
                truncatedEmbedCodeField({name: 'Stacktrace', value: error.stack || '_No stacktrace available._'}),
            ],
            color: ChannelLogger.Color.Error,
        });
    }

    /**
     * Attempts to send an error message when process receives an error event.
     * Supported error events: uncaughtException, unhandledRejection.
     */
    addGlobalListeners() {
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
    constructor(private readonly client: Discord.Client) {
    }

    async exit(code = 0) {
        try {
            this.client.destroy();
        }
        finally {
            process.exit(code);
        }
    }

    addGlobalListeners() {
        process.on('SIGINT', () => this.exit());
        process.on('SIGABRT', () => this.exit());
        process.on('SIGTERM', () => this.exit());
    }
}
