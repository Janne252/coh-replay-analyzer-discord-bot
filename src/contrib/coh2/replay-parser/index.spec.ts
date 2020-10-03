import assert from 'assert';
import {describe, it} from 'mocha';
import { ReplayParser } from '.';
import fs from 'fs-extra';
import path from 'path';

describe('contrib.coh2.replay-parser', () => {
    it('header', () => {
        const replay = new ReplayParser(fs.readFileSync(path.join(__dirname, 'tests/kimbo_vs_hans_g4.rec')));
        assert.strictEqual(replay.version, 23468);
        assert.strictEqual(replay.magic, 'COH2_REC');
        assert.strictEqual(replay.timestamp, '29/08/2020 20:33');
    });
    it('no_mod_fixed_high_annih', () => {
        const replay = new ReplayParser(fs.readFileSync(path.join(__dirname, 'tests/no_mod_fixed_high_annih.rec')));
        assert.strictEqual(replay.version, 23468);
    });
    it('no_mod_fixed_standard_annih', () => {
        const replay = new ReplayParser(fs.readFileSync(path.join(__dirname, 'tests/no_mod_fixed_standard_annih.rec')));
        assert.strictEqual(replay.version, 23468);
    });
    it('no_mod_fixed_standard_annih_custom', () => {
        const replay = new ReplayParser(fs.readFileSync(path.join(__dirname, 'tests/no_mod_fixed_standard_annih_custom.rec')));
        assert.strictEqual(replay.version, 23468);
    });
});
