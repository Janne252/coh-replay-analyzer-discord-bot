import assert from 'assert';
import {describe, it} from 'mocha';
import { formatChatMessage, getReplayDurationDisplay, getReplayTimestamp, ReplayChatMessage, resolveScenarioDisplayName, resolveScenarioId, splitChat } from './replay';
import { makeLength } from '../testing/generator';
import { Locale } from '.';

import {Data} from './replay';
import i18n from '../i18n';

export function mockReplay(options: Partial<Data['map']>) {
    return {
        map: {
            name: options.name,
            description: options.description,
            players: options.players,
            file: options.file,
            width: options.width,
            height: options.height,
        }
    };
}

describe('contrib.coh2.replay', () => {
    it('resolveScenarioDisplayName: From replay.map.name', () => {
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: 'Foo bar'}), Locale.Empty), 
            'Foo bar'
        );
    });
    
    it('resolveScenarioDisplayName: From replay.map.file', () => {
        // numeric player count
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: '$124', players: 4, file: 'Data:/scenarios/mp/4p_some_map/4p_some_map'}), Locale.Empty), 
            '(4) Some map'
        );
        // numeric player count
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: '$124', players: 4, file: 'Data:/scenarios/mp/4p_some_map/4P_some_map'}), Locale.Empty), 
            '(4) Some map'
        );
        // No player count 
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: '$124', players: 4, file: 'Data:/scenarios/mp/some_map/some_map'}), Locale.Empty), 
            '(4) Some map'
        );
        // short player count
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: '$124', players: 2, file: 'Data:/scenarios/mp/some map/(2)_some map'}), Locale.Empty), 
            '(2) Some map'
        );
        // verbose player count
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: '$124', players: 6, file: 'Data:/scenarios/mp/some map/(4 - 6)_some-map'}), Locale.Empty), 
            '(6) Some map'
        );
        // no whitespace in player count
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: '$124', players: 6, file: 'Data:/scenarios/mp/some map/(4-6)_some-map'}), Locale.Empty), 
            '(6) Some map'
        );
        // partial player count
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: '$124', players: 6, file: 'Data:/scenarios/mp/some map/(4-)_some-map'}), Locale.Empty), 
            '(6) Some map'
        );
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: '', file: ''}), Locale.Empty), 
            ''
        );
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: '', file: ''})), 
            ''
        );
    });

    it('resolveScenarioDisplayName: From locale', () => {
        assert.strictEqual(
            resolveScenarioDisplayName(mockReplay({name: '$1'}), new Locale({'en': {1: '(2) Map'}})), 
            '(2) Map'
        );
    });

    it('resolveScenarioId', () => {
        // Previously this test made sure that various inputs for map's filepath resulted in the same "normalized" file name
        assert.strictEqual(resolveScenarioId(mockReplay({file: 'Data://scenarios\\mp\\2p_map//2p_map'})), '2p_map.490f78084d5ce70671de48d49accde39');
        assert.strictEqual(resolveScenarioId(mockReplay({file: 'Data:\\scenarios\\mp\\3p_map\\3p_map'})), '3p_map.5f3ea74518d662d9c564f26c60af0f76');
        assert.strictEqual(resolveScenarioId(mockReplay({file: 'Data:\\scenarios\\mp\\4p map\\4p map'})), '4p map.8f372802d6cd7c19ff5e73735834db36');
        assert.strictEqual(resolveScenarioId(mockReplay({file: 'Data:\\scenarios\\mp\\5p _map\\5p map'})), '5p map.2e0ca52cae5962e89eefda3e3aa00077');
        assert.strictEqual(resolveScenarioId(mockReplay({file: 'Data:\\scenarios\\mp\\6p--map\\6p map'})), '6p map.4f13373f5917e3d1e7b8c0d7d77c79be');
        assert.strictEqual(resolveScenarioId(mockReplay({file: 'Data:\\scenarios\\mp\\ _ 7p--map\\7p map'})), '7p map.cfd054d04de4009e0355ef2ccce0de8e');
    });

    it('getReplayTimestamp', () => {
        assert.strictEqual(getReplayTimestamp(0), '00:00:00');
        assert.strictEqual(getReplayTimestamp(34000), '01:10:50');
    });

    it('getReplayDurationDisplay', () => {
        const restoreTranslations = i18n.override(['en', {
            "time": {
                "hour": "hour",
                "hours": "hours",
                "minute": "minute",
                "minutes": "minutes",
                "second": "second",
                "seconds": "seconds"
            }
        }]);
        assert.strictEqual(getReplayDurationDisplay(0), '0 seconds');
        assert.strictEqual(getReplayDurationDisplay(34000), '1 hour 10 minutes 50 seconds');
        assert.strictEqual(getReplayDurationDisplay(34000, {units: true}), '1 hour 10 minutes 50 seconds');
        assert.strictEqual(getReplayDurationDisplay(34000, {units: false}), '01:10:50');

        assert.strictEqual(getReplayDurationDisplay(12000, {units: true}), '25 minutes');
        assert.strictEqual(getReplayDurationDisplay(8, {units: true}), '1 second');
        assert.strictEqual(getReplayDurationDisplay(16, {units: true}), '2 seconds');
        assert.strictEqual(getReplayDurationDisplay(8 * 60, {units: true}), '1 minute');

        assert.strictEqual(getReplayDurationDisplay(8 * 3600, {units: true}), '1 hour');
        assert.strictEqual(getReplayDurationDisplay(8 * 3600, {units: false}), '01:00:00');

        assert.strictEqual(getReplayDurationDisplay(8 * 3600 * 2, {units: true}), '2 hours');
        assert.strictEqual(getReplayDurationDisplay(8 * 3600 * 2, {units: false}), '02:00:00');
        restoreTranslations();
    });

    it ('splitChat', () => {
        let chat: ReplayChatMessage[];
        assert.deepStrictEqual(
            splitChat({chat: [
                {name: 'player', tick: 0, message: 'Hi'},
            ]}),
            [{
                content: `||${formatChatMessage({name: 'player', tick: 0, message: 'Hi'})}||`,
                count: 1
            }]
        );
            
        // Last long chat message causes a split
        chat = [
            {name: 'player', tick: 0, message: 'Hi'},
            {name: 'player', tick: 0, message: 'Hey'},
            {name: 'player', tick: 0, message: 'Yo yo what is going on'},
            {name: 'player', tick: 0, message: makeLength('foo bar', 1024)},
        ];
        assert.deepStrictEqual(
            splitChat({chat}),
            [
                { content: `||${[chat[0], chat[1], chat[2]].map(o => formatChatMessage(o)).join('')}||`, count: 3},
                { content: `||${formatChatMessage(chat[3])}||`, count: 1},
            ]
        );
        
        // Long chat message in the middle causes a split 
        chat = [
            {name: 'player', tick: 0, message: 'Hi'},
            {name: 'player', tick: 0, message: 'Hey'},
            {name: 'player', tick: 0, message: makeLength('foo bar', 1024)},
            {name: 'player', tick: 0, message: 'Yo yo what is going on'},
        ];
        assert.deepStrictEqual(
            splitChat({chat}),
            [
                { content: `||${[chat[0], chat[1]].map(o => formatChatMessage(o)).join('')}||`, count: 2},
                { content: `||${formatChatMessage(chat[2])}||`, count: 1},
                { content: `||${[chat[3]].map(o => formatChatMessage(o)).join('')}||`, count: 1},
            ]
        );
        // Custom chunk size
        let extraLength = formatChatMessage({name: '2', tick: 0, message: ''}).length;
        chat = [
            {name: '2', tick: 0, message: makeLength('foo bar', 100 - extraLength)},
            {name: '2', tick: 0, message: makeLength('zoo bar', 100 - extraLength)},
            {name: '2', tick: 0, message: makeLength('bar bar', 100 - extraLength)},
        ];
        assert.deepStrictEqual(
            splitChat({chat}, {charsPerChunk: 100}),
            [
                { content: `||${[chat[0]].map(o => formatChatMessage(o)).join('')}||`, count: 1},
                { content: `||${[chat[1]].map(o => formatChatMessage(o)).join('')}||`, count: 1},
                { content: `||${[chat[2]].map(o => formatChatMessage(o)).join('')}||`, count: 1},
            ]
        );
        
        // test with noNewline
        extraLength = formatChatMessage({name: '2', tick: 0, message: ''}, {noNewline: true}).length;
        chat = [
            {name: '2', tick: 0, message: makeLength('foo bar', 100 - extraLength)},
            {name: '2', tick: 0, message: makeLength('zoo bar', 100 - extraLength)},
            {name: '2', tick: 0, message: makeLength('bar bar', 100 - extraLength)},
        ];
        assert.deepStrictEqual(
            splitChat({chat}, {charsPerChunk: 100}),
            [
                { content: `||${[chat[0]].map(o => formatChatMessage(o), {noNewline: true}).join('')}||`, count: 1},
                { content: `||${[chat[1]].map(o => formatChatMessage(o), {noNewline: true}).join('')}||`, count: 1},
                { content: `||${[chat[2]].map(o => formatChatMessage(o), {noNewline: true}).join('')}||`, count: 1},
            ]
        );
    });
});
