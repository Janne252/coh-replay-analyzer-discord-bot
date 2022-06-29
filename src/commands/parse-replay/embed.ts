import Discord, { EmbedField, MessageButton, Util } from 'discord.js';
import * as Replay from '../../contrib/coh2/replay';
import i18n from '../../contrib/i18n';
import ReplaysConfig, { CommanderDatabaseEntry } from './config';
import fs from 'fs-extra';
import path from 'path';
import { InputData } from '../../types';
import { ReplayPlayer } from '../../contrib/coh2/replay';
import { autoDeleteRelatedMessages, truncatedEmbedCodeField } from '../../contrib/discord';
import { coh2Locale, logger, replaysConfig } from '../..';
import { Char } from '../../contrib/misc';
import { InputMessage } from '.';
import { LogLevel } from '../../contrib/discord/logging';

export type InputPlayer = InputData<ReplayPlayer, 'commander' | 'name' | 'steam_id_str' | 'faction' | 'team'>;
export type InputReplay = {map: {name: string, file: string, players: number}, players: InputPlayer[]} & InputData<Replay.Data, 'duration' | 'version' | 'chat' | 'error'>;

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
    protected attachments: Discord.MessageAttachment[] = [];
    constructor(
        protected readonly client: Discord.Client, 
        protected readonly userMessage: InputMessage, 
        protected readonly sourceAttachment: Discord.MessageAttachment,
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

    protected disguiseCommanderName(name: string) {
        // ||<text|| makes it a spoiler
        // `<text>` makes it an inline code snippet; a monospace font to ensure uniform width
       return `||\`${name.padEnd(32, Char.NoBreakSpace)}\`||`;
    }

    protected appendPlayers(type: PlayerAppendType, {excludeCommanders}: {excludeCommanders?: boolean} = {}) {
        const longestPlayerName = Math.max(...this.replay.players.map(p => p.name.length));
        const longestCommanderName = Math.max(16, ...this.replay.players.map(p => this.formatPlayerCommander(p, {fixedWidth: false, disguise: false}).length));
        const maxTeam = Math.max(
            0, // In case there are no players. Otherwise maxTeam is negative infinity.
            ...this.replay.players.map(p => p.team)
        );
        // Technically this could be rendered by having 2 embed rows separated by
        // {name: Char.ZeroWidthSpace, value: Char.ZeroWidthSpace}
        // but it leads to a lot of empty space. Faking headers with bolded text
        // and using line breaks leads to a more compact result.
        if (type == PlayerAppendType.PlayerAndCommanderInSeparateColumns) {
            for (let team = 0; team <= maxTeam; team++) {
                let playerList = '';
                let commanderList = '';
                for (const player of this.replay.players.filter(p => p.team == team)) {
                    playerList += (
                        this.formatPlayer(player) +
                        '\n'
                    );
                    commanderList += (
                        this.formatPlayerCommander(player, {fixedWidth: longestCommanderName, disguise: true, noWrap: true}) +
                        '\n'
                    );
                }
                this.addFields([
                    {name: i18n.get('replay.player.team', { format: { teamNumber: team + 1 } }), value: playerList, inline: !excludeCommanders},
                ]);
                if (!excludeCommanders) {
                    this.addFields([
                        {name: i18n.get('replay.player.commander'), value: commanderList, inline: true},
                        // Additional column to make the "row" 3 fields.
                        // This works wonderfully on the desktop version of Discord, but not so well on mobile,
                        // where the embed fields appear to be forced to a single column (one per line)
                        {name: Char.ZeroWidthSpace, value: Char.ZeroWidthSpace, inline: true},
                    ]);
                }
            }
        } else if (type == PlayerAppendType.PlayerAndCommanderInline) {

            for (let team = 0; team <= maxTeam; team++) {
                const players = this.replay.players.filter(p => p.team == team);
                const spacing = Char.NoBreakSpace.repeat(4);
                let content = '';
                for (const player of players) {
                    content += this.formatPlayer(player);
                    if (!excludeCommanders) {
                        content += `${spacing}${this.formatPlayerCommander(player, {fixedWidth: false, disguise: true, monospace: true})}`;
                    }
                    content += '\n';
                }
                this.addFields([{
                    name: i18n.get('replay.player.team', { format: { teamNumber: team + 1 } }),
                    value: content.trim() || `_${i18n.get('replay.player.noPlayersAvailable')}_`,
                    inline: excludeCommanders,
                }]);
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
        this.addFields(this.chatPreview.field);
        this.chatPreviewIndex = this.fields.length - 1;
    }

    protected appendNoScenarioPreviewImageAvailable() {
        this.addField('\u200b', `_${i18n.get('replay.noMapPreviewImageAvailable')}_\n${`[${i18n.get('replay.requestCustomMapSupportLinkTitle')}](${replaysConfig.customMapSupportRequestInviteUrl})`}`);
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
        this.setFooter({text: `${this.client.user?.username}`, iconURL: this.client.user?.avatarURL() as string});
    }
       
    public async submit() {
        await this.build();
        this.sent = await (this.userMessage.reply ?? this.userMessage.channel.send).apply(this.userMessage, [{
            embeds: [this], 
            files: this.attachments,
            components: [
                new Discord.MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('expand-chat').setLabel(i18n.get('replay.chat.expand')).setStyle('PRIMARY')
                )
            ],
        });
        await this.expandChatPreview();    
        autoDeleteRelatedMessages({
            client: this.client,
            timeoutSeconds: this.config.waitForDeletionTimeoutSeconds,
            triggers: [this.userMessage.id, this.sent.id],
            targets: [this.sent.id, ...this.sentChatLog.map(o => o.id)],
        });
        if (this.replay.error != null) {
            await logger.log({
                title: 'Replay parse error', 
                fields: [
                    truncatedEmbedCodeField({name: 'Error', value: this.replay.error}),
                    {name: 'Replay file', value: `[${this.sourceAttachment.name}](${this.sourceAttachment.url})`}
                ]
            }, {
                context: this.sent,
                level: LogLevel.Log,
                tagAdmin: false,
            });
        }
    }

    protected tryAppendScenarioPreviewImage(type: ScenarioPreviewDisplay) {
            // Attach the scenario preview image to the message if there's one available.
        // TODO: Use a CDN to host these images (see readme.md in the project root)
        // TODO: use an async operation for checking if the file exists
        
        let suffix = '';
        switch (type) {
            case ScenarioPreviewDisplay.Image:
                suffix = '';
                break;
            case ScenarioPreviewDisplay.Thumbnail:
                suffix = '-x80';
                break;
            default:
                throw new Error(`Unsupported preview type "${type}"`);
        }

        const filepath = this.buildScenarioPreviewFilepath(this.buildScenarioPreviewImageFilename({suffix}));
        const name = 'preview.png';
        if (fs.existsSync(filepath)) {
            this.attachments.push(new Discord.MessageAttachment(filepath, name));
            const url = `attachment://${name}`;
            switch (type) {
                case ScenarioPreviewDisplay.Image:
                    this.setImage(url);
                    break;
                case ScenarioPreviewDisplay.Thumbnail:
                    this.setThumbnail(url);
                    break;
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
        this.sent.awaitMessageComponent({componentType: 'BUTTON', time: this.config.expandChatPreview.timeoutSeconds * 1000}).then(async () => {
            for (const chunk of Util.splitMessage(this.replay.chat.map(message => `> ${Replay.formatChatMessage(message, {noNewline: true})}`).join('\n'))) {
                const result = await this.userMessage.channel.send(chunk);
            }
        }).catch(() => {});
        // Remove button
        this.sent.edit({components: []});
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
                .map(player => this.formatPlayerCommander(player, {fixedWidth: true, disguise: true}))
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
    protected formatPlayer(player: InputPlayer, {fixedWidth}: {fixedWidth?: boolean | number} = {}) {
        let playerName = player.name.replace(/ /g, Char.NoBreakSpace);
        let playerNameDisplay = playerName;
        if (player.steam_id_str && player.steam_id_str != '0') {
            const url = (
                this.config.leaderboardUrl ?? 
                `http://www.companyofheroes.com/leaderboards#profile/steam/{steamId}/standings`
            )
                .replace(/\{steamId\}/g, player.steam_id_str)
            ;
            if (fixedWidth) {
                // Maximum length of Steam display name is 32
                playerNameDisplay = `[\`${playerName.padEnd(Number(fixedWidth) || 32, Char.NoBreakSpace)}\`](${url})`;
            } else {
                playerNameDisplay = `[${playerName}](${url})`;
            }
        }

        return `${player.faction in this.config.factionEmojis ? (this.config.factionEmojis[player.faction]) : ''}${playerNameDisplay}`;
    }

    protected formatPlayerCommander(player: InputPlayer, {fixedWidth, disguise, noWrap, monospace}: {fixedWidth: boolean | number, disguise: boolean, noWrap?: boolean, monospace?: boolean}) {
        let commander: CommanderDatabaseEntry | null = null;

        for (const availableCommander of this.config.commanderDatabase) {
            if (availableCommander.server_id == player.commander) {
                commander = availableCommander;
                break;
            }
        }

        let result = (coh2Locale.get(commander?.locstring.name as any) || i18n.get('notAvailable'));
        if (noWrap) {
            result = result.replace(/ /g, Char.NoBreakSpace);
        }
        if (fixedWidth || monospace) {
            if (fixedWidth) {
                result = result.padEnd(Number(fixedWidth) || 32, Char.NoBreakSpace);
            }
            result = `\`${result}\``;
        }
        if (disguise) {
            result = `||${result}||`;
        }
        return result;
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
    protected appendErrors() {
       if (this.replay.error != null) {
            this.addFields(
                {name: `⚠️ ${i18n.get('error')}`, value: `_${i18n.get('replay.parseError')}_`},
            );
       }
    }

    public abstract build(): void;
}

export class ReplayEmbed extends ReplayBaseEmbed {
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
        this.appendPlayers(PlayerAppendType.PlayerAndCommanderInline, {excludeCommanders: true});
        this.appendChat();
        this.appendMetadata();
        this.tryAppendScenarioPreviewImage(ScenarioPreviewDisplay.Image);
        this.appendFooter();
        this.appendErrors();
    }
}

export class CompactReplayEmbed extends ReplayBaseEmbed {
    protected appendTitle() {
        this.setTitle(`${Replay.resolveScenarioDisplayName(this.replay)} \xa0 ⏱ \xa0||\`${this.getDurationDisplay({units: false})}\`||`);
    }

    protected appendNoScenarioPreviewImageAvailable() {
        // noop
    }
    
    public build() {
        this.appendTitle();
        this.appendPlayers(PlayerAppendType.PlayerAndCommanderInSeparateColumns);
        this.tryAppendScenarioPreviewImage(ScenarioPreviewDisplay.Thumbnail);
        this.appendErrors();
    }
}

export interface ChatPreview {
    readonly complete: boolean;
    field: EmbedField;
}

export enum ScenarioPreviewDisplay {
    Image = 'image',
    Thumbnail = 'thumbnail'
}