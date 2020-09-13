import * as Discord from 'discord.js';
import { truncatedEmbedCodeField } from '../../contrib/discord';
import { PackageJsonConfig, PackageConfig } from '../config';
import { AdminConfig } from './config';

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
    
    constructor(private readonly client: Discord.Client, private readonly config: AdminConfig) {

    }

    async init() {
        
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