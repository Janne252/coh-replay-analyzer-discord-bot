import assert from 'assert';
import {describe, it} from 'mocha';
import { truncatedEmbedCodeField } from '../src/helpers/discord';

describe('helpers.discord', () => {
    it('truncatedEmbedCodeField', () => {
        assert.strictEqual(truncatedEmbedCodeField({name: '', value: 'foo bar'}, {maxLength: 1024}).value, '```\nfoo bar\n```');
        assert.strictEqual(truncatedEmbedCodeField({name: '', value: 'foo bar'}, {maxLength: 11}).value, '```\nfoo\n```');
    });
});
