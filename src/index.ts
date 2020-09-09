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
const flankPath = path.join(root, '.flank-bin/release/flank');

const client = new Discord.Client({

});


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

const locale = new Locale(path.join(root, 'data', 'RelicCoH2.English.ucs'));

client.on('ready', async () => {
    await fs.ensureDir(replayTempRoot);
    await fs.emptyDir(replayTempRoot);

    await locale.init();
    console.log('Ready!');
});

interface Replay {
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
            
            const {stdout} = await run(`${flankPath} ${replayFilename}`);
            const replay: Replay = JSON.parse(stdout);
            await fs.unlink(replayFilename);
            const mapName = locale.get(replay.map.name) || `(${replay.map.players}) ${capitalize(replay.map.file.split('\\').reverse()[0])}`;
            message.reply(
`
${mapName}
${replay.players.filter(p => p.team == 0).map(p => p.name).join(', ')} vs. ${replay.players.filter(p => p.team == 1).map(p => p.name).join(', ')}
`
);
        }
    }
});

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
