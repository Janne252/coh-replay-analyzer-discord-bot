import assert from 'assert';
import {describe, it} from 'mocha';
import { capitalize } from '../src/helpers/misc';

describe('helpers.misc', () => {
    it('capitalize', () => {
        assert.strictEqual(capitalize('foo'), 'Foo');
        assert.strictEqual(capitalize('_foo'), '_foo');
        assert.strictEqual(capitalize(''), '');
        assert.strictEqual(capitalize('f'), 'F');
        assert.strictEqual(capitalize('0'), '0');
    });
});
