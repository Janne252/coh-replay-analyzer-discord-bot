import assert from 'assert';
import {describe, it} from 'mocha';
import { getReplayDurationDisplay, getReplayTimestamp, resolveMapDisplayName, resolveScenarioId } from '../src/helpers/coh2';
import * as factory from './factory';
import * as mocking from './mocking';

describe('helpers.coh2', () => {
    it('resolveMapDisplayName: From replay.map.name', () => {
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: 'Foo bar'}), mocking.Locale.Empty), 
            'Foo bar'
        );
    });
    
    it('resolveMapDisplayName: From replay.map.file', () => {
        // numeric player count
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: '$124', players: 4, file: 'Data:/scenarios/mp/4p_some_map/4p_some_map'}), mocking.Locale.Empty), 
            '(4) Some map'
        );
        // numeric player count
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: '$124', players: 4, file: 'Data:/scenarios/mp/4p_some_map/4P_some_map'}), mocking.Locale.Empty), 
            '(4) Some map'
        );
        // No player count 
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: '$124', players: 4, file: 'Data:/scenarios/mp/some_map/some_map'}), mocking.Locale.Empty), 
            '(4) Some map'
        );
        // short player count
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: '$124', players: 2, file: 'Data:/scenarios/mp/some map/(2)_some map'}), mocking.Locale.Empty), 
            '(2) Some map'
        );
        // verbose player count
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: '$124', players: 6, file: 'Data:/scenarios/mp/some map/(4 - 6)_some-map'}), mocking.Locale.Empty), 
            '(6) Some map'
        );
        // no whitespace in player count
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: '$124', players: 6, file: 'Data:/scenarios/mp/some map/(4-6)_some-map'}), mocking.Locale.Empty), 
            '(6) Some map'
        );
        // partial player count
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: '$124', players: 6, file: 'Data:/scenarios/mp/some map/(4-)_some-map'}), mocking.Locale.Empty), 
            '(6) Some map'
        );
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: '', file: ''}), mocking.Locale.Empty), 
            ''
        );
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: '', file: ''})), 
            ''
        );
    });

    it('resolveMapDisplayName: From locale', () => {
        assert.strictEqual(
            resolveMapDisplayName(factory.replay({name: '$1'}), new mocking.Locale({'$1': '(2) Map'})), 
            '(2) Map'
        );
    });

    it('resolveScenarioId', () => {
        assert.strictEqual(resolveScenarioId(factory.replay({file: 'Data://scenarios\\mp\\2p_map//2p_map'})), 'scenarios-mp-2p-map-2p-map');
        assert.strictEqual(resolveScenarioId(factory.replay({file: 'Data:\\scenarios\\mp\\2p_map\\2p_map'})), 'scenarios-mp-2p-map-2p-map');
        assert.strictEqual(resolveScenarioId(factory.replay({file: 'Data:\\scenarios\\mp\\2p map\\2p map'})), 'scenarios-mp-2p-map-2p-map');
        assert.strictEqual(resolveScenarioId(factory.replay({file: 'Data:\\scenarios\\mp\\2p _map\\2p map'})), 'scenarios-mp-2p-map-2p-map');
        assert.strictEqual(resolveScenarioId(factory.replay({file: 'Data:\\scenarios\\mp\\2p--map\\2p map'})), 'scenarios-mp-2p-map-2p-map');
        assert.strictEqual(resolveScenarioId(factory.replay({file: 'Data:\\scenarios\\mp\\ _ 2p--map\\2p map'})), 'scenarios-mp-2p-map-2p-map');
    });

    it('getReplayTimestamp', () => {
        assert.strictEqual(getReplayTimestamp(0), '00:00:00');
        assert.strictEqual(getReplayTimestamp(34000), '01:10:50');
    });

    it('getReplayDurationDisplay', () => {
        assert.strictEqual(getReplayDurationDisplay(0), '0s');
        assert.strictEqual(getReplayDurationDisplay(34000), '1h 10m 50s');
        assert.strictEqual(getReplayDurationDisplay(34000, {verbose: true}), '1 hour 10 minutes 50 seconds');
        assert.strictEqual(getReplayDurationDisplay(12000, {verbose: true}), '25 minutes');
        assert.strictEqual(getReplayDurationDisplay(8, {verbose: true}), '1 second');
        assert.strictEqual(getReplayDurationDisplay(16, {verbose: true}), '2 seconds');
        assert.strictEqual(getReplayDurationDisplay(8 * 60, {verbose: true}), '1 minute');
        assert.strictEqual(getReplayDurationDisplay(8 * 3600, {verbose: true}), '1 hour');
        assert.strictEqual(getReplayDurationDisplay(8 * 3600 * 2, {verbose: true}), '2 hours');
    });
});

