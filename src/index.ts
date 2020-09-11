import * as Discord from 'discord.js';
import path from 'path';
import fs from 'fs-extra';
import download from 'download';
import { v4 as uuidv4 } from 'uuid';
import { exec, capitalize } from './helpers/misc';
import { FACTION_EMOJIS } from './config';
import { Locale, getReplayDurationDisplay } from './helpers/coh2';
import { ChannelLogger, getDiscordConfig, ShutdownManager } from './helpers/discord';

// Paths
const root = process.cwd();
const replayTempRoot = path.join(root, '.replays');
const flankPath = path.join(root, '.flank.bin/release/flank');

// Instances
const locale = new Locale(path.join(root, 'data', 'coh2', 'RelicCoH2.English.ucs'));
const client = new Discord.Client({

});
const logger = new ChannelLogger(client);
const shutdownManager = new ShutdownManager(client);

client.on('ready', async () => {
    // Prepare .replays folder
    await fs.ensureDir(replayTempRoot);
    await fs.emptyDir(replayTempRoot);

    await locale.init();
    await logger.init();
    console.log('Ready!');
});

client.on('message', async message => {
    for (const attachment of message.attachments.array()) {
        if (attachment.name && attachment.name.endsWith('.rec')) {
            // Download replay file contents to a temporary file
            const replayFilename = path.join(replayTempRoot, `${uuidv4()}.rec`);
            const data = await download(attachment.url);
            await fs.writeFile(replayFilename, data);
            
            /**
                FLAGS:
                    -l, --log        Enables debug logging to stdout
                    -n, --nocmd      Skips command parsing
                    -s, --strict     Rejects files without the .rec extension
                    -w, --wipecmd    Parses command info but wipes them before output
                    -h, --help       Prints help information
                    -V, --version    Prints version information
            */
            const {stdout} = await exec(`${flankPath} --wipecmd ${replayFilename}`);
            const replay: Replay = JSON.parse(stdout);
            // Delete temporarily stored replay file
            await fs.unlink(replayFilename);

            const mapSgbFileNameWithoutExtension = replay.map.file.split('\\').reverse()[0];
            const mapDisplayLabel = locale.get(replay.map.name) || `(${replay.map.players}) ${capitalize(mapSgbFileNameWithoutExtension)}`;
            const mapPreviewImageFilename = `${mapSgbFileNameWithoutExtension}.jpg`;
            const mapPreviewImageFilepath = path.join(root, 'data', 'map-preview-images', mapPreviewImageFilename);
   
            const reply = new Discord.MessageEmbed();
            // Attach the map preview image to the message if there's one available.
            // TODO: Use a CDN to host these images (see readme.md in the project root)
            // TODO: use an async operation for checking if the file exists
            if (fs.existsSync(mapPreviewImageFilepath)) {
                reply.attachFiles([mapPreviewImageFilepath]);
                reply.setImage(`attachment://${mapPreviewImageFilename}`)
            }
            reply.setTitle(mapDisplayLabel);
            reply.addFields(
                { inline: true, name: 'Team 1', value: replay.players.filter(p => p.team == 0).map(p => formatPlayer(p)).join('\n') || '_No players available._'},
                { inline: true, name: 'Team 2', value: replay.players.filter(p => p.team == 1).map(p => formatPlayer(p)).join('\n') || '_No players available._'},
            );
            // Blank row according to https://discordjs.guide/popular-topics/embeds.html#embeds
            reply.addField('\u200b', '\u200b');
            reply.addFields(
                // { name: 'Uploader', value: message.author.toString(), inline: true},
                // { name: 'Replay file', value: `[${attachment.name}](${attachment.url})`, inline: true},
                { name: 'Match duration', value: `||${getReplayDurationDisplay(replay.duration)}||`, inline: true},
                { name: 'Game version', value: replay.version, inline: true},
            );
            reply.setFooter(client.user?.username, client.user?.avatarURL() as string);
            message.channel.send(reply);
        }
    }
});

/**
 * Prefixes player name with the faction emoji.
 * Adds a link to the official leaderboards if the player has a valid Steam ID available.
 * @param player 
 */
function formatPlayer(player: Replay['players'][0]) {
    let playerNameDisplay = player.name;
    if (player.steam_id && player.steam_id != 0) {
        const url = `http://www.companyofheroes.com/leaderboards#profile/steam/${player.steam_id_str}/standings`;
        playerNameDisplay = `[${player.name}](${url})`;
    }

    return `${FACTION_EMOJIS[player.faction]} ${playerNameDisplay}`;
}

// Login with a locally stored utf8 encoded text file.
// This file is ignored in .gitignore
client.login(fs.readFileSync('.discord.token', {encoding: 'utf8'}).trim());
// Add global event listeners
logger.addGlobalListeners();
shutdownManager.addGlobalListeners();
