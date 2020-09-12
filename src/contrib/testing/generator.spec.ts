import assert from 'assert';
import {describe, it} from 'mocha';
import { makeLength } from './generator';
import { capitalize } from '../misc';

describe('contrib.testing.generator', () => {
    it('makeLength', () => {
        assert.strictEqual(makeLength('a', 100).length, 100);
        assert.strictEqual(makeLength('foo bar', 100).length, 100);
        assert.strictEqual(makeLength('Lorem ipsum dolor sit amet, consectetur adipisci elit, sed eiusmod tempor incidunt ut labore et dolore magna aliqua.', 8943).length, 8943);
    });
});
