import * as Discord from 'discord.js';
import { truncatedEmbedCodeField } from '../../contrib/discord';

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
    
    //@ts-expect-error 2564
    private guild: Discord.Guild;
    //@ts-expect-error 2564
    private channel: Discord.TextChannel;
    //@ts-expect-error 2564
    private admin: Discord.GuildMember;

    constructor(private readonly client: Discord.Client, private readonly config: {log: {guild: string, channel: string}, user: string}) {

    }

    /**
     * Appends a reference of the guild to the embed.
     */
    private appendGuild(embed: Discord.MessageEmbed, guild: Discord.Guild) {
        embed.fields.push({ name: 'Server', value: `[${guild}](https://discord.com/channels/${guild.id})`, inline: false });
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
        this.guild = await this.client.guilds.fetch(this.config.log.guild);
        this.channel = this.guild.channels.resolve(this.config.log.channel) as Discord.TextChannel;
        this.admin = await this.guild.members.fetch(this.config.user);
    }
    
    async log(options: Discord.MessageEmbedOptions = {}, context?: LoggerContext) {
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
        if (context) {
            if (context instanceof Discord.Guild) {
                this.appendGuild(embed, context);

            } else if (context instanceof Discord.Channel) {
                this.appendChannel(embed, context);

            } else if (context instanceof Discord.Message) {
                this.appendMessage(embed, context);
            }
        }
        embed.addFields(
            { name: 'Timestamp', value: timestamp.toISOString(), inline: true },
        );
        
        // Tag admin first
        // If we tag them in the embed, they will not get a notification
        // https://discordjs.guide/popular-topics/embeds.html#notes
        await this.channel.send(`${this.admin}`);
        const result = await this.channel.send(embed);
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
            color: ChannelLogger.Color.Error,
        }, context);

        if (error.stack) {
            const stacktraceMessages = await this.channel.send(
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
