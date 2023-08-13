import * as Discord from 'discord.js';

import fs from 'fs-extra';
import path from 'path';
import { Locale } from './contrib/coh2';
import ReplaysConfig from './commands/parse-replay/config';
import tryParseReplay from './commands/parse-replay';
import * as tryParseReplayViaInteraction from './interactions/parse-replay';

import tryExecuteAdminCommand from './commands/admin';

import { getGuildEmbedInfoFields, ShutdownManager } from './contrib/discord';
import { DiagnosticsConfig } from './contrib/discord/config';
import { ChannelLogger, Color, LogLevel } from './contrib/discord/logging';
import i18n from './contrib/i18n';
import { PackageJsonConfig } from './contrib/config';

// Instances
export const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
    ]
});

export const locales: Record<string, Locale> = {
    'COH2_REC': new Locale(),
    'COH3_RE': new Locale(),
}

export const diagnosticsConfig = new DiagnosticsConfig();
export const replaysConfig = new ReplaysConfig();
export const logger = new ChannelLogger(client, diagnosticsConfig);
const shutdownManager = new ShutdownManager(client, logger);

client.on(Discord.Events.ClientReady, async () => {
    // Replay deletion listers can exceed 10 if both test:replays and test:replays-compact are executed
    client.setMaxListeners(32);
    await PackageJsonConfig.assign(replaysConfig, 'replays.common');
    await PackageJsonConfig.assign(diagnosticsConfig, 'diagnostics');

    // Prepare .replays folder
    await fs.ensureDir(replaysConfig.replaysTempPath);
    await fs.emptyDir(replaysConfig.replaysTempPath);
    
    await Promise.all([
        logger.init(),
        i18n.loadJsonCatalogs(path.join(process.cwd(), 'locale')),
    ]);
   
    console.log('Ready!');

    const updateStatus = async () => {
        try {
            await client.user?.setActivity({
                name: i18n.get('watchingActivity'),
                type: Discord.ActivityType.Watching,
            });
        } finally {
            setTimeout(updateStatus, 30 * 60 * 1000);
        }
    }


    const registerCommands = async () => {
        const commandDefinitions: {command: Discord.ContextMenuCommandBuilder, deployed: Record<string, boolean | undefined>}[] = [
            { command: new Discord.ContextMenuCommandBuilder()
                .setName(tryParseReplayViaInteraction.commandName)
                .setNameLocalization('en-US', i18n.get('command.messageContextMenu.createReplayEmbed'))
                .setNameLocalization('en-GB', i18n.get('command.messageContextMenu.createReplayEmbed'))
                .setNameLocalization('fr', i18n.get('command.messageContextMenu.createReplayEmbed', {locale: 'fr'}))
                .setType(Discord.ApplicationCommandType.Message), deployed: {} }
        ];

        const guild = await client.guilds.fetch(diagnosticsConfig.support.guild as string);
        const globalCommands = await client.application!.commands.fetch();
        const guildCommands = await guild.commands.fetch();
        for (const { scope, commands, manager } of [
            { scope: 'global', commands: globalCommands, manager: client.application!.commands }, 
            { scope: `guild<${guild.id}>`, commands: guildCommands, manager: guild.commands }
        ]) {
            for (const [id, command] of commands) {
                let isDefined = false;
                for (const definition of commandDefinitions) {
                    if (definition.command.name === command.name) {
                        isDefined = true;
                        if (definition.command.type !== command.type) {
                            await command.delete();
                            console.log(`[${scope}] Deleted command "${definition.command.name}" (incompatible with existing)`);
                            definition.deployed[scope] = false
                        } else {
                            definition.deployed[scope] = true
                        }

                        if (definition.deployed[scope]) {
                            await command.edit(definition.command);
                            console.log(`[${scope}] Updated command "${definition.command.name}"`);
                        }
                    }
                }
                if (!isDefined) {
                    await command.delete();
                    console.log(`[${scope}] Deleted command "${command.name}" (non-defined)`);
                }   
            }
            
            for (const definition of commandDefinitions) {
                if (!definition.deployed[scope]) {
                    await manager.create(definition.command);
                    console.log(`[${scope}] Created command "${definition.command.name}"`);
                }
            }
        }
    }

    updateStatus();
    registerCommands();

    logger.log({
        title: 'Startup',
        description: `Process started.`
    }, {
        level: LogLevel.Log,
        environmentInfo: true,
    });
});

client.on(Discord.Events.MessageCreate, async message => {
    // Filter out non-text channel message
    if (!(message.channel instanceof Discord.TextChannel)) {
        return;
    }

    const textMessage = message as Discord.Message & {channel: Discord.TextChannel};
    const restoreLocale = i18n.activate((textMessage.guild?.preferredLocale as string || 'en'));
    try {
        if (await tryParseReplay(textMessage))
            return;
        
        if (await tryExecuteAdminCommand(textMessage, client, logger, diagnosticsConfig))
            return;
    } catch (error) {
        // Catch errors with context
        await logger.error(error as Error, textMessage);
        // Try reporting to the end user 
        await logger.tryNotifyEndUser(error as Discord.DiscordAPIError, textMessage);
    } finally {
        restoreLocale();
    }
});

client.on(Discord.Events.InteractionCreate, async (interaction) => {
	if (interaction.isMessageContextMenuCommand() && interaction.commandName === tryParseReplayViaInteraction.commandName) {
        await tryParseReplayViaInteraction.handler(interaction as any as Discord.MessageContextMenuCommandInteraction);
    }
});

client.on(Discord.Events.GuildCreate, async enteredGuild => {
    logger.log({title: 'Joined a server', fields: await getGuildEmbedInfoFields(enteredGuild, {user: client.user})}, {
        tagAdmin: true,
        color: Color.Green,
    });
});

client.on(Discord.Events.GuildDelete, async exitedGuild => {
    logger.log({title: 'Removed from a server', fields: await getGuildEmbedInfoFields(exitedGuild, {user: client.user})}, {
        tagAdmin: true,
        color: Color.Orange,
    });
});

// Login with a locally stored utf8 encoded text file.
// This file is ignored in .gitignore
client.login(fs.readFileSync('.discord.token', {encoding: 'utf8'}).trim());
// Add global event listeners
logger.addGlobalErrorListeners();
// Add global signal listeners such as SIGTERM
shutdownManager.addGlobalSignalListeners();
