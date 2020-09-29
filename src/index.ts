import * as Discord from 'discord.js';
import path from 'path';
import fs from 'fs-extra';
import { Locale } from './contrib/coh2';

import ReplaysConfig from './commands/parse-replay/config';
import tryParseCoH2Replay from './commands/parse-replay';

import tryExecuteAdminCommand from './commands/admin';

import { ShutdownManager } from './contrib/discord';
import { AdminConfig } from './contrib/discord/config';
import { ChannelLogger } from './contrib/discord/logging';

// Instances
const client = new Discord.Client({

});

const locale = new Locale();
const adminConfig = new AdminConfig();
const replaysConfig = new ReplaysConfig();
const logger = new ChannelLogger(client, adminConfig);
const shutdownManager = new ShutdownManager(client);

client.on('ready', async () => {
    await replaysConfig.init();
    await adminConfig.init();

    // Prepare .replays folder
    await fs.ensureDir(replaysConfig.replaysTempPath);
    await fs.emptyDir(replaysConfig.replaysTempPath);

    await Promise.all([
        locale.init(replaysConfig.localeFilePath),
        logger.init(),
    ]);
   
    console.log('Ready!');

    const updateStatus = async () => {
        try {
            await client.user?.setActivity({
                name: 'Replays',
                type: 'WATCHING'
            });
        } finally {
            setTimeout(updateStatus, 30 * 60 * 1000);
        }
    }

    updateStatus();
});

client.on('message', async message => {
    try {
        if (await tryParseCoH2Replay(message, client, replaysConfig))
            return;
        
        if (await tryExecuteAdminCommand(message, client, adminConfig))
            return;
    } catch (error) {
        // Catch errors with context
        await logger.error(error, message);
    }
});

// Login with a locally stored utf8 encoded text file.
// This file is ignored in .gitignore
client.login(fs.readFileSync('.discord.token', {encoding: 'utf8'}).trim());
// Add global event listeners
logger.addGlobalErrorListeners();
// Add global signal listeners such as SIGTERM
shutdownManager.addGlobalSignalListeners();
