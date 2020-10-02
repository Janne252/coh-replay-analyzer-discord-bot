import assert from 'assert';
import {describe, it} from 'mocha';
import { ReplayParser } from '.';
import fs from 'fs-extra';
import path from 'path';

describe('coh2.replay-parser', () => {
    it('header', () => {
        const replay = new ReplayParser(fs.readFileSync(path.join(__dirname, 'tests/kimbo_vs_hans_g4.rec')));
        assert.strictEqual(replay.version, 23468);
        assert.strictEqual(replay.magic, 'COH2_REC');
        assert.strictEqual(replay.timestamp, '29/08/2020 20:33');
    });
});
