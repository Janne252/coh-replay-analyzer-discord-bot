import assert from 'assert';
import {describe, it} from 'mocha';
import { autoTruncateString, capitalize, formatString } from './misc';

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

    it('autoTruncateString', () => {
        // input string is trimmed from the end
        assert.strictEqual(autoTruncateString('foo', 3), 'foo');
        assert.strictEqual(autoTruncateString('foobar', 3), 'fo…');
        assert.strictEqual(autoTruncateString('Longer text for testing purposes', 14), 'Longer text f…');
        assert.strictEqual(autoTruncateString('long file name.rec', 12, { overflowChars: '….rec', trimEndOnOverflow: '.rec'}), 'long fi….rec');
        assert.strictEqual(autoTruncateString('long file name.rec', 18, { overflowChars: '….rec', trimEndOnOverflow: '.rec'}), 'long file name.rec');

        // overflow string is trimmed from the start
        assert.strictEqual(autoTruncateString('long file name.rec', 5, { overflowChars: '….rec', trimEndOnOverflow: '.rec'}), '….rec');
        assert.strictEqual(autoTruncateString('long file name.rec', 4, { overflowChars: '….rec', trimEndOnOverflow: '.rec'}), '.rec');
        assert.strictEqual(autoTruncateString('long file name.rec', 3, { overflowChars: '….rec', trimEndOnOverflow: '.rec'}), 'rec');
        assert.strictEqual(autoTruncateString('long file name.rec', 2, { overflowChars: '….rec', trimEndOnOverflow: '.rec'}), 'ec');
        assert.strictEqual(autoTruncateString('long file name.rec', 1, { overflowChars: '….rec', trimEndOnOverflow: '.rec'}), 'c');
        assert.strictEqual(autoTruncateString('long file name.rec', 0, { overflowChars: '….rec', trimEndOnOverflow: '.rec'}), '');
        assert.strictEqual(autoTruncateString('long file name.rec', -1, { overflowChars: '….rec', trimEndOnOverflow: '.rec'}), '');
    })
});
