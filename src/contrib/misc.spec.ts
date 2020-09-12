import assert from 'assert';
import {describe, it} from 'mocha';
import { capitalize } from './misc';

describe('contrib.misc', () => {
    it('capitalize', () => {
        assert.strictEqual(capitalize('foo'), 'Foo');
        assert.strictEqual(capitalize('_foo'), '_foo');
        assert.strictEqual(capitalize(''), '');
        assert.strictEqual(capitalize('f'), 'F');
        assert.strictEqual(capitalize('0'), '0');
    });
});
