import assert from 'assert';
import {describe, it} from 'mocha';
import { capitalize, formatString } from './misc';

describe('contrib.misc', () => {
    it('capitalize', () => {
        assert.strictEqual(capitalize('foo'), 'Foo');
        assert.strictEqual(capitalize('_foo'), '_foo');
        assert.strictEqual(capitalize(''), '');
        assert.strictEqual(capitalize('f'), 'F');
        assert.strictEqual(capitalize('0'), '0');
    });

    it('formatString', () => {
        assert.strictEqual(formatString('foo'), 'foo');
        // Simple
        assert.strictEqual(formatString('foo {param}', {param: 'bar'}), 'foo bar');
        // repeated
        assert.strictEqual(formatString('foo {param} {param}', {param: 'bar'}), 'foo bar bar');
        // Leave non-existent parameters as-is
        assert.strictEqual(formatString('foo {param} {param2}', {param: 'bar'}), 'foo bar {param2}');
        // null & undefined will not appear as strings
        assert.strictEqual(formatString('foo {param}', {param: null}), 'foo ');
        assert.strictEqual(formatString('foo {param}', {param: undefined}), 'foo ');
    });
});
