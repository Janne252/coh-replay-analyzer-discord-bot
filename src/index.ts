import * as Discord from 'discord.js';
import path from 'path';
import fs from 'fs-extra';
import download from 'download';
import { v4 as uuidv4 } from 'uuid';
import { exec } from './contrib/misc';
import { FACTION_EMOJIS } from './config';
import { Locale } from './contrib/coh2';
import { Replay, getReplayDurationDisplay, getReplayTimestamp, resolveMapDisplayName, resolveScenarioId, splitChat, formatChatMessage } from './contrib/coh2/replay';
import { ChannelLogger, isAdminCommand, MessageHelpers, PackageDiscordConfig, ShutdownManager } from './contrib/discord';
import { makeLength } from './contrib/testing/generator';
// Paths
const root = process.cwd();
const replayTempRoot = path.join(root, '.replays');
const flankPath = path.join(root, '.flank.bin/release/flank');

// Instances
const locale = new Locale(path.join(root, 'data', 'coh2', 'RelicCoH2.English.ucs'));
const config = new PackageDiscordConfig();
const client = new Discord.Client({

});
const logger = new ChannelLogger(client, config);
const shutdownManager = new ShutdownManager(client);

client.on('ready', async () => {
    // Prepare .replays folder
    await fs.ensureDir(replayTempRoot);
    await fs.emptyDir(replayTempRoot);

    await locale.init();
    await config.init();
    await logger.init();
   
    console.log('Ready!');

    await client.user?.setActivity({
        name: 'Replays',
        type: 'WATCHING'
    });
});

client.on('message', async message => {
    const isAdmin = isAdminCommand(message, client, config);
    const command = MessageHelpers.withoutMentions(message) ;
    if (isAdmin) {
        const guild = await client.guilds.fetch(config.test.guild);
        const channel = guild?.channels.resolve(config.test.channel) as Discord.TextChannel;

        switch (command) {
            case 'test:replays': {
                for (const file of await fs.readdir(path.join(root, 'tests/replays'))) {
                    const attachment = new Discord.MessageAttachment(path.join(root, 'tests/replays', file));
                    await channel.send(attachment);
                    await new Promise((resolve, reject) => {
                        setTimeout(resolve, 2000);
                    });
                }
                return;
            }
            case 'test:embed': {
                const embed = new Discord.MessageEmbed();
                const url = client.user?.avatarURL() as string;

                embed.author = {
                    name: makeLength('author name', 256),
                    url: url,
                    iconURL: url,
                    proxyIconURL: url,
                };
                embed.title = makeLength('title', 256);
                embed.description = makeLength('description', 2048);
                embed.footer = {
                    text: makeLength('footer', 2048),
                    iconURL: url,
                    proxyIconURL: url,
                };
                const usedSofar = embed.length;
                const available = 6000 - usedSofar;
                const embedTitles = 25 * 10;
                const embedValues = available - embedTitles;
                const perEmbedValue = Math.floor(embedValues / 25);
                const plusLastEmbedValue = embedValues % 25;
                // Max number of embed fields
                for (let i = 0; i < 25; i++) {
                    embed.addFields({
                        name: makeLength('embed name', 10),
                        value: makeLength('embed value', perEmbedValue + (i == 24 ? plusLastEmbedValue : 0)),
                    })
                }
                const totalEmbedCharacters = embed.length;
                await channel.send(embed);
                return;
            }
        }
    }

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

            const mapPreviewImageFilename = `${resolveScenarioId(replay)}.jpg`;
            const mapPreviewImageFilepath = path.join(root, 'data', 'map-preview-images', mapPreviewImageFilename);
   
            const embed = new Discord.MessageEmbed();
            embed.setTitle(resolveMapDisplayName(replay));
            embed.addFields(
                { inline: true, name: 'Team 1', value: replay.players.filter(p => p.team == 0).map(p => formatPlayer(p)).join('\n') || '_No players available._'},
                { inline: true, name: 'Team 2', value: replay.players.filter(p => p.team == 1).map(p => formatPlayer(p)).join('\n') || '_No players available._'},
            );

            const loadAllChatTip = `\n${message.author}: React with \xa0 💬 \xa0 to load all chat messages.`;
            const chatPreview = getChatPreviewEmbed(replay, {charsPerChunk: 1024 - loadAllChatTip.length});
            if (!chatPreview.complete) {
                chatPreview.field.value += loadAllChatTip;
            }
            embed.addFields(chatPreview.field);
            const chatPreviewIndex = embed.fields.length - 1;

            embed.addFields(
                { name: 'Match duration', value: `||${getReplayDurationDisplay(replay.duration, {verbose: true})}||`, inline: true},
                { name: 'Game version', value: `4.0.0.${replay.version}`, inline: true},
            );
            // Attach the map preview image to the message if there's one available.
            // TODO: Use a CDN to host these images (see readme.md in the project root)
            // TODO: use an async operation for checking if the file exists
            if (fs.existsSync(mapPreviewImageFilepath)) {
                embed.attachFiles([mapPreviewImageFilepath]);
                embed.setImage(`attachment://${mapPreviewImageFilename}`);
            } else {
                embed.addField('\u200b', '_No map preview image available. If this is an official map, please contact an admin on the server._');
            }
            embed.setFooter(client.user?.username, client.user?.avatarURL() as string);
            
            const result = await message.channel.send(embed);
            if (!chatPreview.complete) {
                // Placeholder reaction for the user
                const selfReaction = await result.react('💬');
                const chatOutputMessages: Discord.Message[] = [];
                try {
                    const reactions = await result.awaitReactions((reaction, user) => user.id == message.author.id && reaction.emoji.name == '💬', {time: 30000, max: 1});
                    if (reactions.array().some(reaction => reaction.emoji.name == '💬')) {
                        await selfReaction.remove();
                        // Send replay chat as block quote messages
                        // Utilize Discord's automatic splitting functionality when passing message data as an array
                        const result = await message.channel.send(
                            replay.chat.map(message => `> ${formatChatMessage(message, {noNewline: true})}`), 
                            {split: true}
                        );
                        chatOutputMessages.push(...(!Array.isArray(result) ? [result] : result));
                    }
                } catch {

                } finally {
                    if (chatOutputMessages.length > 0) {
                        embed.fields[chatPreviewIndex].name = 'Chat';
                        embed.fields[chatPreviewIndex].value = `[Show](${chatOutputMessages[0].url})`;
                    } else {
                        embed.fields[chatPreviewIndex] = getChatPreviewEmbed(replay).field;
                    }
                    await result.edit(embed);
                    await selfReaction.remove();
                }
            }
        }
    }
});

function getChatPreviewEmbed(replay: Replay, {charsPerChunk}: {charsPerChunk?: number} = {}) {
    if (!replay.chat || replay.chat.length == 0) {
        return {
            complete: true,
            field: {name: 'Chat', value: '_No chat._', inline: false},
        };
    }

    const chunks = splitChat(replay, {charsPerChunk: charsPerChunk ?? 1024});
    const complete = chunks.length == 1;
    let title = 'Chat';
    if (!complete) {
        title = `Chat (${chunks[0].count}/${replay.chat.length})`;
    }

    return {
        complete,
        field: {name: title, value: chunks[0].content, inline: false},
    };
}

function embedChat(chunks: ReturnType<typeof splitChat>, embed: Discord.MessageEmbed) {
    const totalCount = chunks.reduce((total, chunk) => total + chunk.count, 0);

    for (let i = 0; i < chunks.length; i++) {
        const field = {
            name: i == 0 ? `Chat (${totalCount} messages)` : '\u200b',
            value: chunks[i].content,
        };

        const remainingChatMessageCount = chunks.slice(i).reduce((total, remainingChunk) => total + remainingChunk.count, 0);
        const chatLengthWarning = {
            name: '\u200b',
            value: `||_Too much chat to display - ${remainingChatMessageCount} ${remainingChatMessageCount == 1 ? 'message' : 'messages'} skipped._||`,
        };
        if ((embed.length + field.name.length + field.value.length) > (6000 - (chatLengthWarning.name.length + chatLengthWarning.value.length))) {
            embed.addFields(chatLengthWarning);
            break;
        } else {
            embed.addFields(field);
        }
    }
}



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
