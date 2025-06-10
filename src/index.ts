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
import i18n, { I18n } from './contrib/i18n';
import { PackageJsonConfig } from './contrib/config';
import { ApplicationCommandScope } from './types';
import stringify from 'safe-stable-stringify';

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
        const commandDefinitions: {command: (i18n: I18n, scope: ApplicationCommandScope) => Discord.ContextMenuCommandBuilder, deployed: Record<string, boolean | undefined>, commandName: string}[] = [
            { command: tryParseReplayViaInteraction.getOptions, deployed: {}, commandName: tryParseReplayViaInteraction.commandName }
        ];

        const guild = await client.guilds.fetch(diagnosticsConfig.support.guild as string);
        const globalCommands = await client.application!.commands.fetch();
        const guildCommands = await guild.commands.fetch();
        for (const { scope, scopeId, commands, manager } of [
            { scope: ApplicationCommandScope.Global, scopeId: '', commands: globalCommands, manager: client.application!.commands }, 
            { scope: ApplicationCommandScope.Guild, scopeId: guild.id, commands: guildCommands, manager: guild.commands }
        ]) {
            const scopeKey = `${scope}<${scopeId}>`;

            for (const [id, command] of commands) {
                let isDefined = false;
                for (const definition of commandDefinitions) {
                    if (definition.commandName === command.name) {
                        const defined = definition.command(i18n, scope);
                        isDefined = true;
                        if (defined.type !== command.type) {
                            await command.delete();
                            console.log(`[${scopeKey}] Deleted command "${definition.commandName}" (incompatible with existing)`);
                            definition.deployed[scopeKey] = false
                        } else {
                            definition.deployed[scopeKey] = true
                        }

                        if (definition.deployed[scopeKey]) {
                            await command.edit(defined);
                            console.log(`[${scopeKey}] Updated command "${definition.commandName}"`);
                        }
                    }
                }
                if (!isDefined) {
                    await command.delete();
                    console.log(`[${scopeKey}] Deleted command "${command.name}" (non-defined)`);
                }   
            }
            
            for (const definition of commandDefinitions) {
                if (!definition.deployed[scopeKey]) {
                    const defined = definition.command(i18n, scope);
                    await manager.create(defined);
                    console.log(`[${scopeKey}] Created command "${definition.commandName}"`);
                    definition.deployed[scopeKey] = true;
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
    // Filter out channels that don't support sending messages
    if (!(message.channel.isSendable())) {
        return;
    }
    const restoreLocale = i18n.activate((message.guild?.preferredLocale as string || 'en'));
    try {
        if (await tryParseReplay(message))
            return;
        
        if (await tryExecuteAdminCommand(message, client, logger, diagnosticsConfig))
            return;
    } catch (error) {
        // Catch errors with context
        await logger.error(error as Error, message);
        // Try reporting to the end user 
        await logger.tryNotifyEndUser(error as Discord.DiscordAPIError, message);
    } finally {
        restoreLocale();
    }
});

client.on(Discord.Events.InteractionCreate, async (interaction) => {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === tryParseReplayViaInteraction.commandName) {
        const message = interaction.targetMessage;
        // Filter out channels that don't support sending messages
        if (!message.channel.isSendable()) {
            return
        }
        await tryParseReplayViaInteraction.handler(interaction as Discord.MessageContextMenuCommandInteraction);
    } else {
        console.warn(`Unknown interaction`, stringify(interaction.toJSON(), null, 4))
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
