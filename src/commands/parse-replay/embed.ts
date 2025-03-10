import Discord, { ActionRow, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedField } from 'discord.js';
import * as Replay from '../../contrib/coh2/replay';
import i18n from '../../contrib/i18n';
import ReplaysConfig, { BattlegroupDatabaseEntry, CommanderDatabaseEntry } from './config';
import fs, { truncate } from 'fs-extra';
import path from 'path';
import { AttachmentStub, InputData } from '../../types';
import { ReplayPlayer } from '../../contrib/coh2/replay';
import { autoDeleteRelatedMessages, truncatedEmbedCodeField, truncatedEmbedMonospaceField } from '../../contrib/discord';
import { logger, replaysConfig } from '../..';
import { Char, autoTruncateString, nonWrappingString } from '../../contrib/misc';
import { InputMessage } from '.';
import { LogLevel } from '../../contrib/discord/logging';
import Util from '../../contrib/discord/util';
import { Locale } from '../../contrib/coh2';

export type InputPlayer = InputData<ReplayPlayer, 'commander' | 'battlegroup' | 'name' | 'steam_id_str' | 'profile_id' | 'faction' | 'team'>;
export type InputReplay = {map: {name: string, file: string, players: number}, players: InputPlayer[]} & InputData<Replay.Data, 'duration' | 'version' | 'chat' | 'error'>;

enum PlayerAppendType {
    PlayerAndCommanderInSeparateColumns,
    PlayerAndCommanderInline,
}

export abstract class ReplayBaseEmbed extends Discord.EmbedBuilder {
    protected loadAllChatTip: string = '';
    protected chatPreview: ChatPreview | null = null;
    //@ts-expect-error 2564
    protected sent: Discord.Message;
    protected sentChatLog: Discord.Message[] = [];
    protected attachments: Discord.AttachmentBuilder[] = [];
    constructor(
        protected readonly client: Discord.Client, 
        protected readonly userMessage: InputMessage, 
        protected readonly sourceAttachment: AttachmentStub,
        protected readonly replay: InputReplay, 
        private readonly config: ReplaysConfig,
        protected readonly locale: Locale,
        protected readonly options?: { includeReplayFilename?: boolean }
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
        let replayTitle = Replay.resolveScenarioDisplayName(this.replay, this.locale);
        if (!replayTitle) {
            replayTitle = this.sourceAttachment.name;
        }
        this.setTitle(`${autoTruncateString(replayTitle, 256)}`)
    }

    protected setUrl() {
        this.setURL(this.userMessage.url);
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
                        {name: i18n.get(this.config.commanderColumnTitle || 'replay.player.commander'), value: commanderList, inline: true},
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
    }

    protected appendNoScenarioPreviewImageAvailable() {
        this.addFields({ name: '\u200b', value: `_${i18n.get('replay.noMapPreviewImageAvailable')}_\n${`[${i18n.get('replay.requestCustomMapSupportLinkTitle')}](${replaysConfig.customMapSupportRequestInviteUrl})`}`});
    }

    protected appendMetadata({duration, gameVersion}: {duration?: boolean, gameVersion?: boolean} = {}) {
        if (duration ?? true) {
            this.addFields(
                { name: i18n.get('replay.matchDuration'), value: `${this.getMaskedReplayDurationDisplay()}`, inline: true},
            );
        }
        if (gameVersion ?? true) {
            this.addFields(
                { name: i18n.get('replay.gameVersion'), value: `4.0.0.${this.replay.version}`, inline: true},
            );
        }
    }

    protected getEmojiPrefixedReplayFileNameDisplay({ attachmentFileNameMaxLength }: { attachmentFileNameMaxLength?: number } = {}) {
        const truncatedFileName = autoTruncateString(nonWrappingString(this.sourceAttachment.name), attachmentFileNameMaxLength ?? Number.MAX_SAFE_INTEGER, { 
            trimEndOnOverflow: '.rec', 
            overflowChars: '….rec'
        });
        // No leading whitespace because Discord seems to trim it at the beginning of an embed field value
        return this.sourceAttachment.url ?
            `🎬${Char.DoubleNoBreakSpace}[\`${truncatedFileName}\`](${this.sourceAttachment.url})` : 
            `🎬${Char.DoubleNoBreakSpace}\`${truncatedFileName}\``
    }

    protected getEmojiPrefixedMaskedReplayDurationDisplay({ units = true } : { units?: boolean} = {}) {
        // No leading whitespace because Discord seems to trim it at the beginning of an embed field value
        // ⏱ emoji itself doesn't seem to convert to Discord's built-in :stopwatch: emoji. We'll have to reference it manually
        return `:stopwatch:${Char.DoubleNoBreakSpace}${this.getMaskedReplayDurationDisplay({units})}`
    }

    protected appendReplayFilename() {
        this.addFields({
            name: Char.ZeroWidthSpace,
            value: this.getEmojiPrefixedReplayFileNameDisplay({ attachmentFileNameMaxLength: 40 }),
        })
    }

    protected appendFooter() {
        this.setFooter({text: `${this.client.user?.username}`, iconURL: this.client.user?.avatarURL() as string});
    }

    public async submit() {
        await this.build();
        const message: Discord.MessageCreateOptions = {
            embeds: [this], 
            files: this.attachments,
            components: this.chatPreview?.complete == false ? [
                new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder().setCustomId('expand-chat').setLabel(i18n.get('replay.chat.expand')).setStyle(ButtonStyle.Primary)
                )
            ] : undefined,
        }
        if (this.userMessage.reply) {
            this.sent = await this.userMessage.reply(message);
        } else {
            this.sent = await this.userMessage.channel.send(message);
        }
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
                suffix = '.x300';
                break;
            case ScenarioPreviewDisplay.Thumbnail:
                suffix = '.x80';
                break;
            default:
                throw new Error(`Unsupported preview type "${type}"`);
        }

        const filepath = this.buildScenarioPreviewFilepath(this.buildScenarioPreviewImageFilename({suffix}));
        const name = 'preview.png';
        if (fs.existsSync(filepath)) {
            this.attachments.push(new Discord.AttachmentBuilder(filepath).setName(name));
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
    protected getMaskedReplayDurationDisplay({units}: {units?: boolean} = {units: true}) {
        return `||\`${Replay.getReplayDurationDisplay(this.replay.duration, {units}).padEnd((units ? '59 minutes 59 seconds' : '00:00:00').length, Char.NoBreakSpace)}\`||`
    }
   
    protected async expandChatPreview() {
        if (this.chatPreview == null || this.chatPreview.complete) {
            return;
        }
        this.sent.awaitMessageComponent({componentType: ComponentType.Button, time: this.config.expandChatPreview.timeoutSeconds * 1000}).then(async () => {
            for (const chunk of Util.splitMessage(this.replay.chat.map(message => `> ${Replay.formatChatMessage(message, {noNewline: true})}`).join('\n'))) {
                const result = await this.sent.reply(chunk);
            }
        }).catch(() => {})
        .finally(async () => {
            // Remove button
            await this.sent.edit({components: []});
        });
    }

    protected getPlayerTeamCommanderListEmbed(
        replay: {players: InputPlayer[]}, 
        team: 0 | 1, 
    ) {
        return { 
            inline: true, 
            name: i18n.get(this.config.commanderColumnTitle || 'replay.player.commander'), 
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
            let urlTemplate = (this.config.leaderboardUrl?.template ?? `https://coh2stats.com/players/{steamId}`)
            if (urlTemplate.includes('{steamId}')) {
                urlTemplate = urlTemplate.replace(/\{steamId\}/g, player.steam_id_str)
            }
            if (urlTemplate.includes('{profileId}') && player.profile_id != null) {
                urlTemplate = urlTemplate.replace(/\{profileId\}/g, String(player.profile_id))
            }
            const url = new URL(urlTemplate);
            Object.entries(this.config.leaderboardUrl?.query ?? {})
                .forEach(([key, value]) => url.searchParams.append(key, value))
            ;
            if (fixedWidth) {
                // Maximum length of Steam display name is 32
                playerNameDisplay = `[\`${playerName.padEnd(Number(fixedWidth) || 32, Char.NoBreakSpace)}\`](${url})`;
            } else {
                playerNameDisplay = `[${playerName}](${url})`;
            }
        }

        return `${player.faction in this.config.factionEmojis ? (`${this.config.factionEmojis[player.faction]}\xa0`) : ''}${playerNameDisplay}`;
    }

    protected formatPlayerCommander(player: InputPlayer, {fixedWidth, disguise, noWrap, monospace}: {fixedWidth: boolean | number, disguise: boolean, noWrap?: boolean, monospace?: boolean}) {
        let commanderDisplayName: string = ''
        for (const availableCommander of this.config.commanderDatabase) {
            if ((availableCommander as CommanderDatabaseEntry).server_id == player.commander) {
                commanderDisplayName = this.locale.get((availableCommander as CommanderDatabaseEntry)?.locstring.name as any)
                break;
            } else if ((availableCommander as BattlegroupDatabaseEntry).upgrade_id == player.battlegroup) {
                commanderDisplayName = (availableCommander as BattlegroupDatabaseEntry).display_name
            }
        }

        let result = commanderDisplayName || i18n.get('notAvailable');
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

    protected appendReplayDurationAndFileName() {
        this.addFields({ 
            name: Char.ZeroWidthSpace,  
            value: `${this.getEmojiPrefixedMaskedReplayDurationDisplay({ units: false })} ${Char.DoubleNoBreakSpace} ${this.getEmojiPrefixedReplayFileNameDisplay({ attachmentFileNameMaxLength: 20 })}`,
        })
    }

    public abstract build(): void;
}

export class ReplayEmbed extends ReplayBaseEmbed {
    public build() {
        this.appendTitle();
        this.setUrl();
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
        this.appendReplayFilename();
        this.appendFooter();
        this.appendErrors();
    }
}

export class CompactReplayEmbed extends ReplayBaseEmbed {
    protected appendNoScenarioPreviewImageAvailable() {
        // NOOP
    }

    protected appendReplayFilename() {
        // NOOP
    }

    public build() {
        this.appendTitle();
        this.setUrl();
        this.appendPlayers(PlayerAppendType.PlayerAndCommanderInSeparateColumns);
        this.tryAppendScenarioPreviewImage(ScenarioPreviewDisplay.Thumbnail);
        this.appendReplayDurationAndFileName();
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