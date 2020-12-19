import assert from 'assert';
import {describe, it} from 'mocha';
import { CompactReplayEmbed, ReplayEmbed, InputReplay, InputPlayer } from './embed';
import Discord, { DiscordAPIError } from 'discord.js';
import ReplaysConfig from './config';
import i18n from '../../contrib/i18n';
import { InputMessage } from '.';

function mockEmbed(type: typeof ReplayEmbed | typeof CompactReplayEmbed, {configOverrides, players}: {configOverrides?: Partial<ReplaysConfig>, players?: InputPlayer[]} = {}) {
    const client = new Discord.Client({});
    const guild = new Discord.Guild(client, {});
    const channel = new Discord.TextChannel(guild, {});
    const author = new Discord.User(client, {});
    const message = new Discord.Message(client, {id: '0', author: author}, channel);
    const attachment = new Discord.MessageAttachment('');
    message.attachments = new Discord.Collection([['', attachment]]);
    const config = new ReplaysConfig();
    Object.assign(config, configOverrides ?? {});
    const replay: InputReplay = {
        map: {
            name: '',
            file: '2p_test_map',
            players: 2,
        },
        duration: 0,
        version: '',
        chat: [],
        players: players ?? [
            {name: 'Player 1', steam_id: 0, steam_id_str: '', faction: '', team: 0, commander: 0},
            {name: 'Player 2', steam_id: 0, steam_id_str: '', faction: 'test', team: 1, commander: 0},
        ],
        error: null,
    }
    const result = new type(client, message as InputMessage, attachment, replay, config);
    result.build();
    return result;
}
describe('commands.parse-replay', () => {
    it('embedPlayers single', () => {
        // No emoji found
        assert.strictEqual(mockEmbed(ReplayEmbed).title, '(2) Test map');
        assert.deepStrictEqual(
            mockEmbed(ReplayEmbed).fields[0], {
                name: 'replay.player.team',
                value: 'Player\xa01',
                inline: true,
            }
        );
        // Emoji found
        assert.deepStrictEqual(
            mockEmbed(ReplayEmbed, {configOverrides: {factionEmojis: {'test': '<test>'}}}).fields[1], {
                name: 'replay.player.team',
                value: '<test>Player\xa02',
                inline: true,
            }
        );
        // Link to leaderboards
        assert.deepStrictEqual(
            mockEmbed(ReplayEmbed, {
                players: [
                    {name: 'Player\xa01', steam_id_str: '123', faction: 'foo', team: 0, commander: 0}
                ],
                configOverrides: {
                    leaderboardUrl: 'http://example.com/{steamId}',
                }
            }).fields[0], {
                name: 'replay.player.team',
                value: '[Player\xa01](http://example.com/123)',
                inline: true,
            }
        );
        // Steam Id present multiple times in the url template
        assert.deepStrictEqual(
            mockEmbed(ReplayEmbed, {
                players: [
                    {name: 'Player\xa01', steam_id_str: '123', faction: 'foo', team: 0, commander: 0}
                ],
                configOverrides: {
                    leaderboardUrl: 'http://example.com/{steamId}/{steamId}',
                }
            }).fields[0], {
                name: 'replay.player.team',
                value: '[Player\xa01](http://example.com/123/123)',
                inline: true,
            }
        );
        assert.deepStrictEqual(
            new RegExp(`\\<emoji\\>\\[Player\\]\\(.*?123.*?\\)`).test(
                mockEmbed(ReplayEmbed, {
                    players: [
                        {name: 'Player', steam_id_str: '123', faction: 'foo', team: 0, commander: 0}
                    ],
                    configOverrides: {
                        factionEmojis: {'foo': '<emoji>'},
                    }
                }).fields[0].value
            ), 
            true
        );
    });

    it('embedPlayers multiple', () => {
        const restoreTranslations = i18n.override(['en', {
            replay: {
                player: {
                    team: 'Team {teamNumber}',
                    noPlayersAvailable: 'No players available.',
                }
            }
        }]);
        // No players
        assert.deepStrictEqual(
            mockEmbed(ReplayEmbed, {players: []}).fields[0], {
                name: 'Team 1',
                inline: true,
                value: '_No players available._'
            }
        );
        
        // With player
        assert.deepStrictEqual(mockEmbed(ReplayEmbed, {
            players: [{name: 'Player', faction: 'faction', team: 0, steam_id_str: '0', commander: 0}],
            configOverrides: {factionEmojis: {'faction': '<emoji>'}},
        }).fields[0], {
                name: 'Team 1',
                inline: true,
                value: '<emoji>Player'
            }
        );
        // With multiple players
        assert.deepStrictEqual(mockEmbed(ReplayEmbed, {
            players: [
                {name: 'P1', faction: 'faction', team: 0, steam_id_str: '0', commander: 0},
                {name: 'P2', faction: 'faction', team: 0, steam_id_str: '0', commander: 0},
            ],
            configOverrides: {factionEmojis: {'faction': '<emoji>'}},
        }).fields[0], {
                name: 'Team 1',
                inline: true,
                value: '<emoji>P1\n<emoji>P2'
            }
        );
        restoreTranslations();
    });

    it('embedPlayers commanders', () => {
        const restoreTranslations = i18n.override(['en', {
            replay: {
                player: {
                    team: 'Team {teamNumber}',
                    commander: 'Commander',
                }
            }
        }]);
        const embed = mockEmbed(CompactReplayEmbed, {
            players: [
                {name: 'P1', faction: 'faction', team: 0, steam_id_str: '0', commander: 186413},
                {name: 'P2', faction: 'faction', team: 0, steam_id_str: '0', commander: 5568},
            ],
            configOverrides: {factionEmojis: {'faction': '<emoji>'}},
        });

        assert.deepStrictEqual(embed.fields[0], {
            name: 'Team 1',
            inline: true,
            value: '<emoji>P1\n<emoji>P2\n'
        });
        assert.deepStrictEqual(embed.fields[1], {
            name: 'Commander',
            inline: true,
            value: '||`notAvailable\xa0\xa0\xa0\xa0`||\n||`notAvailable\xa0\xa0\xa0\xa0`||\n'
        });
        restoreTranslations();
    });
});
