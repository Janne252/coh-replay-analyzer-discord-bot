import * as Discord from 'discord.js';
import path from 'path';
import fs from 'fs-extra';
import download from 'download';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
const root = process.cwd();

function run(command: string,): Promise<{stdout: string, stderr: string}> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            resolve({stdout, stderr});
        });
    });
}

const replayTempRoot = path.join(root, '.replays');
const flankPath = path.join(root, '.flank.bin/release/flank');

const client = new Discord.Client({

});

const FACTION_NAMES: Record<string, string> = {
    german: 'Ostheer',
    soviet: 'Soviets',
    west_german: 'Oberkommando West',
    aef: 'US. Forces',
    british: 'British',
};

const FACTION_EMOJIS: Record<string, string> = {
    german: '<:german:753277450171056208>',
    soviet: '<:soviet:753277450489954375>',
    west_german: '<:west_german:753277450217062411>',
    aef: '<:aef:753277449944432830>',
    british: '<:british:753277449957277867>',
};

class Locale {
    private readonly messages: Record<string, string> = {};
    constructor(readonly filepath: string) {

    }

    async init() {
        const localeStrings = (await fs.readFile(this.filepath, {encoding: 'utf-8'})).split('\n');
        for (const row of localeStrings) {
            const [id, message] = row.split('\t').map(part => part.trim());
            this.messages[`$${id}`] = message;
        }
    }

    get(id: string) {
        return this.messages[id];
    }
}

const locale = new Locale(path.join(root, 'data', 'coh2', 'RelicCoH2.English.ucs'));

client.on('ready', async () => {
    await fs.ensureDir(replayTempRoot);
    await fs.emptyDir(replayTempRoot);

    await locale.init();
    console.log('Ready!');
});

interface Replay {
    version: string;
    chat: ReadonlyArray<any>;
    date_time: string;
    duration: number;
    game_type: string;
    map: {
        file: string;
        name: string;
        description: string;
        description_long: string;
        width: number;
        height: number;
        players: number;
    };

    players: ReadonlyArray<{
        id: number;
        name: string;
        steam_id: number;
        steam_id_str: string;
        team: 0 | 1;
        faction: string;
        commander: number;
        items: {
            selection_id: number;
            server_id: number;
            item_type: string;
        }[];
    }>;
}

function capitalize(str: string) { 
    return str.charAt(0).toUpperCase() + str.slice(1);
}

client.on('message', async message => {
    for (const attachment of message.attachments.array()) {
        if (attachment.name && attachment.name.endsWith('.rec')) {
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
            const {stdout} = await run(`${flankPath} --wipecmd ${replayFilename}`);
            const replay: Replay = JSON.parse(stdout);
            await fs.unlink(replayFilename);
            const mapSgbFileNameWithoutExtension = replay.map.file.split('\\').reverse()[0];
            const mapDisplayLabel = locale.get(replay.map.name) || `(${replay.map.players}) ${capitalize(mapSgbFileNameWithoutExtension)}`;
            const mapPreviewImageFilename = `${mapSgbFileNameWithoutExtension}.jpg`;
            const mapPreviewImageFilepath = path.join(root, 'data', 'map-preview-images', mapPreviewImageFilename);
            const reply = new Discord.MessageEmbed();
            if (fs.existsSync(mapPreviewImageFilepath)) {
                reply.attachFiles([mapPreviewImageFilepath]);
                reply.setImage(`attachment://${mapPreviewImageFilename}`)
            }
            reply.setTitle(mapDisplayLabel);
            reply.addFields(
                { inline: true, name: 'Team 1', value: replay.players.filter(p => p.team == 0).map(p => formatPlayer(p)).join('\n')},
                { inline: true, name: 'Team 2', value: replay.players.filter(p => p.team == 1).map(p => formatPlayer(p)).join('\n')},
            );
            reply.addField('\u200b', '\u200b');
            reply.addFields(
                { name: 'Uploader', value: message.author.toString(), inline: true},
                { name: 'Replay file', value: `[${attachment.name}](${attachment.url})`, inline: true},
                { name: 'Game version', value: replay.version, inline: true},
            );
            reply.setFooter(client.user?.username, client.user?.avatarURL() as string);
            message.channel.send(reply);
        }
    }
});

function formatPlayer(player: Replay['players'][0]) {
    let playerNameDisplay = player.name;
    if (player.steam_id && player.steam_id != 0) {
        const url = `http://www.companyofheroes.com/leaderboards#profile/steam/${player.steam_id_str}/standings`;
        playerNameDisplay = `[${player.name}](${url})`;
    }

    return `${FACTION_EMOJIS[player.faction]} ${playerNameDisplay}`
}

client.login(fs.readFileSync('.discord.token', {encoding: 'utf8'}));

async function shutdown(code = 0) {
    try {
        client.destroy();
    }
    finally {
        process.exit(code);
    }
}

process.on('SIGINT', () => shutdown());
process.on('SIGABRT', () => shutdown());
process.on('SIGTERM', () => shutdown());
