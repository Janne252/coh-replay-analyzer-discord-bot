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

    // Prepare .replays folder
    await fs.ensureDir(replaysConfig.replaysTempPath);

    await Promise.all([
        fs.emptyDir(replaysConfig.replaysTempPath),
        locale.init(replaysConfig.localeFilePath),
        adminConfig.init(),
        logger.init(),
        client.user?.setActivity({
            name: 'Replays',
            type: 'WATCHING'
        }),
    ]);
   
    console.log('Ready!');
});

client.on('message', async message => {
    if (await tryParseCoH2Replay(message, client, replaysConfig))
        return;
    
    if (await tryExecuteAdminCommand(message, client, adminConfig))
        return;
});

// Login with a locally stored utf8 encoded text file.
// This file is ignored in .gitignore
client.login(fs.readFileSync('.discord.token', {encoding: 'utf8'}).trim());
// Add global event listeners
logger.addGlobalListeners();
shutdownManager.addGlobalListeners();
