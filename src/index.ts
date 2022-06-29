import * as Discord from 'discord.js';

import fs from 'fs-extra';
import path from 'path';
import { Locale } from './contrib/coh2';
import ReplaysConfig from './commands/parse-replay/config';
import tryParseCoH2Replay from './commands/parse-replay';

import tryExecuteAdminCommand from './commands/admin';

import { getGuildEmbedInfoFields, ShutdownManager } from './contrib/discord';
import { DiagnosticsConfig } from './contrib/discord/config';
import { ChannelLogger, Color, LogLevel } from './contrib/discord/logging';
import i18n from './contrib/i18n';
import { PackageJsonConfig } from './contrib/config';

const intents = new Discord.Intents();
intents.add(
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
 );

// Instances
export const client = new Discord.Client({
    intents
});

export const coh2Locale = new Locale();
export const diagnosticsConfig = new DiagnosticsConfig();
export const replaysConfig = new ReplaysConfig();
export const logger = new ChannelLogger(client, diagnosticsConfig);
const shutdownManager = new ShutdownManager(client, logger);

client.on('ready', async () => {
    // Replay deletion listers can exceed 10 if both test:replays and test:replays-compact are executed
    client.setMaxListeners(32);
    await PackageJsonConfig.assign(replaysConfig, 'replays');
    await PackageJsonConfig.assign(diagnosticsConfig, 'diagnostics');
    await replaysConfig.init();

    // Prepare .replays folder
    await fs.ensureDir(replaysConfig.replaysTempPath);
    await fs.emptyDir(replaysConfig.replaysTempPath);
    
    await Promise.all([
        coh2Locale.init(replaysConfig.localeFilePaths),
        logger.init(),
        i18n.loadJsonCatalogs(path.join(process.cwd(), 'locale')),
    ]);
   
    console.log('Ready!');

    const updateStatus = async () => {
        try {
            await client.user?.setActivity({
                name: i18n.get('watchingActivity'),
                type: 'WATCHING'
            });
        } finally {
            setTimeout(updateStatus, 30 * 60 * 1000);
        }
    }

    updateStatus();

    logger.log({
        title: 'Startup',
        description: `Process started.`
    }, {
        level: LogLevel.Log,
        environmentInfo: true,
    });
});

client.on('messageCreate', async message => {
    // Filter out non-text channel message
    if (!(message.channel instanceof Discord.TextChannel)) {
        return;
    }

    const textMessage = message as Discord.Message & {channel: Discord.TextChannel};
    const restoreLocale = i18n.activate((textMessage.guild?.preferredLocale as string || 'en'));
    try {
        if (await tryParseCoH2Replay(textMessage))
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

client.on('guildCreate', async enteredGuild => {
    logger.log({title: 'Joined a server', fields: await getGuildEmbedInfoFields(enteredGuild, {user: client.user})}, {
        tagAdmin: true,
        color: Color.Green,
    });
});

client.on('guildDelete', async exitedGuild => {
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
