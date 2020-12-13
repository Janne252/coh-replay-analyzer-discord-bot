import Discord, { EmbedField } from 'discord.js';
import * as Replay from '../../contrib/coh2/replay';
import i18n from '../../contrib/i18n';
import ReplaysConfig, { CommanderDatabaseEntry } from './config';
import fs from 'fs-extra';
import path from 'path';
import { InputData } from '../../types';
import { ReplayPlayer } from '../../contrib/coh2/replay';
import { autoDeleteRelatedMessages } from '../../contrib/discord';
import { coh2Locale } from '../..';
import { Char } from '../../contrib/misc';

export type InputPlayer = InputData<ReplayPlayer, 'commander' | 'name' | 'steam_id_str' | 'faction' | 'team'>;
export type InputReplay = {map: {name: string, file: string, players: number}, players: InputPlayer[]} & InputData<Replay.Data, 'duration' | 'version' | 'chat'>;

enum PlayerAppendType {
    PlayerAndCommanderInSeparateColumns,
    PlayerAndCommanderInline,
}

export abstract class ReplayBaseEmbed extends Discord.MessageEmbed {
    protected loadAllChatTip: string = '';
    protected chatPreviewIndex: number = 0;
    protected chatPreview: ChatPreview | null = null;
    //@ts-expect-error 2564
    protected sent: Discord.Message;
    protected sentChatLog: Discord.Message[] = [];

    constructor(
        protected readonly client: Discord.Client, 
        protected readonly userMessage: Discord.Message, 
        protected readonly replay: InputReplay, 
        private readonly config: ReplaysConfig
    ) {
        super();
    }

    protected buildScenarioPreviewImageFilename({prefix, suffix}: {prefix?: string, suffix?: string} = {}) {
        return `${prefix ?? ''}${Replay.resolveScenarioId(this.replay)}${suffix ?? ''}.jpg`;
    }

    protected buildScenarioPreviewFilepath(filename: string) {
       return path.join(this.config.scenarioPreviewImageRootPath, filename);
    }

    protected appendTitle() {
        this.setTitle(`${Replay.resolveScenarioDisplayName(this.replay)}`);
    }

    protected appendPlayers(type: PlayerAppendType) {
        for (let team = 0; team <= 1; team++) {
            const players = this.replay.players.filter(p => p.team == team);
            if (type == PlayerAppendType.PlayerAndCommanderInSeparateColumns) {
                this.addFields([{
                        name: i18n.get('replay.player.team', {format: {teamNumber: team + 1}}), 
                        value: players.map(p => `${this.formatPlayer(p)}`).join('\n'), 
                        inline: true,
                    }, {
                        name: i18n.get('replay.player.commander'), 
                        value: players.map(p => `||${this.formatPlayerCommander(p)}||`).join('\n'), 
                        inline: true,
                    }
                ]);
                if (team == 0) {
                    this.addField(Char.ZeroWidthSpace, Char.ZeroWidthSpace);
                }
            } else if (type == PlayerAppendType.PlayerAndCommanderInline) {
                const spacing = `${Char.NoBreakSpace} ${Char.NoBreakSpace} `;
                this.addFields([{
                        name: i18n.get('replay.player.team', {format: {teamNumber: team + 1}}), 
                        value: players.map(p => `${this.formatPlayer(p)}${spacing}||${this.formatPlayerCommander(p)}||`).join('\n'), 
                        inline: false,
                    }
                ]);
            }
        }
    }

    protected appendChat() {
        this.loadAllChatTip = i18n.get(
            'replay.chat.loadAllByReacting', {format: {
                '@user': this.userMessage.author.toString(),
                'emoji': `${Char.NoBreakSpace} ${this.config.expandChatPreview.reaction} ${Char.NoBreakSpace}`
            }}
        );
        this.chatPreview = this.getChatPreviewEmbed({charsPerChunk: 1024 - this.loadAllChatTip.length});
        if (!this.chatPreview.complete) {
            this.chatPreview.field.value += this.loadAllChatTip;
        }
        this.addFields(this.chatPreview.field);
        this.chatPreviewIndex = this.fields.length - 1;
    }

    protected appendScenarioPreviewImage() {
        this.tryAttachScenarioPreviewImage({
            filepath: this.buildScenarioPreviewFilepath(this.buildScenarioPreviewImageFilename()), 
            type: 'image'
        });
    }

    protected appendNoScenarioPreviewImageAvailable() {
        this.addField('\u200b', `_${i18n.get('replay.noMapPreviewImageAvailable')}_`);
    }

    protected appendMetadata({duration, gameVersion}: {duration?: boolean, gameVersion?: boolean} = {}) {
        if (duration ?? true) {
            this.addFields(
                { name: i18n.get('replay.matchDuration'), value: `||${this.getDurationDisplay()}||`, inline: true},
            );
        }
        if (gameVersion ?? true) {
            this.addFields(
                { name: i18n.get('replay.gameVersion'), value: `4.0.0.${this.replay.version}`, inline: true},
            );
        }
    }

    protected appendFooter() {
        this.setFooter(this.client.user?.username, this.client.user?.avatarURL() as string);
    }
       
    public async submit() {
        await this.build();
        this.sent = await this.userMessage.channel.send(this);
        await this.expandChatPreview();    
        autoDeleteRelatedMessages({
            client: this.client,
            timeoutSeconds: this.config.waitForDeletionTimeoutSeconds,
            triggers: [this.userMessage.id, this.sent.id],
            targets: [this.sent.id, ...this.sentChatLog.map(o => o.id)],
        });
    }

    protected tryAttachScenarioPreviewImage({filepath, type}: {filepath: string, type: 'image' | 'thumbnail'}) {
            // Attach the scenario preview image to the message if there's one available.
        // TODO: Use a CDN to host these images (see readme.md in the project root)
        // TODO: use an async operation for checking if the file exists
        
        const name = 'preview.png';
        if (fs.existsSync(filepath)) {
            this.attachFiles([new Discord.MessageAttachment(filepath, name)]);
            const url = `attachment://${name}`;
            switch (type) {
                case 'image':
                    this.setImage(url);
                    break;
                case 'thumbnail':
                    this.setThumbnail(url);
                    break;
                default:
                    throw new Error(`Unsupported scenario preview image type "${type}"`);
            }
        } else {
            this.appendNoScenarioPreviewImageAvailable();
        }
    }
    protected getDurationDisplay({units}: {units?: boolean} = {units: true}) {
        return Replay.getReplayDurationDisplay(this.replay.duration, {units});
    }
   
    protected async expandChatPreview() {
        if (this.chatPreview == null || this.chatPreview.complete) {
            return;
        }
        // Placeholder reaction for the user
        const selfReaction = await this.sent.react(this.config.expandChatPreview.reaction);
        const reactions = await this.sent.awaitReactions(
            (reaction, user) => user.id == this.userMessage.author.id && reaction.emoji.name == this.config.expandChatPreview.reaction, 
            {time: this.config.expandChatPreview.timeoutSeconds * 1000, max: 1}
        );
        if (reactions.array().some(reaction => reaction.emoji.name == this.config.expandChatPreview.reaction)) {
            await selfReaction.remove();
            // Send replay chat as block quote messages
            // Utilize Discord's automatic splitting functionality when passing message data as an array
            const result = await this.userMessage.channel.send(
                this.replay.chat.map(message => `> ${Replay.formatChatMessage(message, {noNewline: true})}`), 
                {split: true}
            );
            this.sentChatLog.push(...(!Array.isArray(result) ? [result] : result));
            this.fields[this.chatPreviewIndex].name = i18n.get('replay.chat.title');
            this.fields[this.chatPreviewIndex].value = `[${i18n.get('replay.chat.jumpToFullChatLinkText')}](${this.sentChatLog[0].url})`;
        } else {
            // Re-render chat without expansion tip
            this.fields[this.chatPreviewIndex] = this.getChatPreviewEmbed().field;
        }
        await this.sent.edit(this);
        await selfReaction.remove();
    }

    protected getPlayerTeamCommanderListEmbed(
        replay: {players: InputPlayer[]}, 
        team: 0 | 1, 
    ) {
        return { 
            inline: true, 
            name: i18n.get('replay.player.commander'), 
            value: replay.players
                .filter(player => player.team == team)
                .map(player => this.formatPlayerCommander(player))
                .join('\n') || `_${i18n.get('replay.player.noCommandersAvailable')}_`
        };
    }

    protected getPlayerTeamListEmbed(
        replay: {players: InputPlayer[]}, 
        team: 0 | 1, 
    ) {
        return { 
            inline: true, 
            name: i18n.get('replay.player.team', {format: {teamNumber: team + 1}}), 
            value: replay.players
                .filter(player => player.team == team)
                .map(player => this.formatPlayer(player))
                .join('\n') || `_${i18n.get('replay.player.noPlayersAvailable')}_`
        };
    }

    /**
     * Prefixes player name with the faction emoji.
     * Adds a link to the official leaderboards if the player has a valid Steam ID available.
     * @param player 
     */
    protected formatPlayer(player: InputPlayer) {
        let playerNameDisplay = player.name;
        if (player.steam_id_str && player.steam_id_str != '0') {
            const url = (
                this.config.leaderboardUrl ?? 
                `http://www.companyofheroes.com/leaderboards#profile/steam/{steamId}/standings`
            )
                .replace(/\{steamId\}/g, player.steam_id_str)
            ;
            playerNameDisplay = `[${player.name}](${url})`;
        }

        return `${player.faction in this.config.factionEmojis ? (this.config.factionEmojis[player.faction]) + ' ' : ''}${playerNameDisplay}`;
    }

    protected formatPlayerCommander(player: InputPlayer) {
        let commander: CommanderDatabaseEntry | null = null;

        for (const availableCommander of this.config.commanderDatabase) {
            if (availableCommander.server_id == player.commander) {
                commander = availableCommander;
                break;
            }
        }

        return (coh2Locale.get(commander?.locstring.name as any) || i18n.get('notAvailable')).replace(/ /g, Char.NoBreakSpace);
    }

    protected getChatPreviewEmbed({charsPerChunk}: {charsPerChunk?: number} = {}): ChatPreview {
        if (!this.replay.chat || this.replay.chat.length == 0) {
            return {
                complete: true,
                field: {name: i18n.get('replay.chat.title'), value: `_${i18n.get('replay.chat.noChatAvailable')}_`, inline: false},
            };
        }
    
        const chunks = Replay.splitChat(this.replay, {charsPerChunk: charsPerChunk ?? 1024});
        const complete = chunks.length == 1;
        let title = i18n.get('replay.chat.title');
        if (!complete) {
            title = i18n.get('replay.chat.partial', {format: {count: chunks[0].count, total: this.replay.chat.length}});
        }
    
        return {
            complete,
            field: {name: title, value: chunks[0].content, inline: false},
        };
    }

    public build() {
        this.appendTitle();
        // Embeds with image are limited to width of ~ 300px. Having
        // players and commanders split into separate columns leads to wrapped text; 300px is not enough to
        // display both player name and the commander name on the same line.
        // If player name and commander name were  in different columns, the wrapping of text
        // would only appear in the commander column, e.g.

        // player01     some long commander name
        // player02     that overflows a bit
        //              player02 commander starts here

        // ^ Not exactly pretty. Inline it is!
        // Technically we could have a line per player but Discord adds a lot of empty space between
        // embed lines.
        this.appendPlayers(PlayerAppendType.PlayerAndCommanderInline);
        this.appendChat();
        this.appendMetadata();
        this.appendScenarioPreviewImage();
        this.appendFooter();
    }
}

export class ReplayEmbed extends ReplayBaseEmbed {

}

export class CompactReplayEmbed extends ReplayBaseEmbed {
    protected appendTitle() {
        this.setTitle(`${Replay.resolveScenarioDisplayName(this.replay)} \xa0 ⏱ \xa0||\`${this.getDurationDisplay({units: false})}\`||`);
    }
    protected appendScenarioPreviewImage() {
        this.tryAttachScenarioPreviewImage({
            filepath: this.buildScenarioPreviewFilepath(this.buildScenarioPreviewImageFilename({suffix: '-x64'})), 
            type: 'thumbnail'
        });
    }   

    protected appendNoScenarioPreviewImageAvailable() {
        // noop
    }
    
    public build() {
        this.appendTitle();
        this.appendPlayers(PlayerAppendType.PlayerAndCommanderInSeparateColumns);
        this.appendScenarioPreviewImage();
    }
}

export interface ChatPreview {
    readonly complete: boolean;
    field: EmbedField;
}
