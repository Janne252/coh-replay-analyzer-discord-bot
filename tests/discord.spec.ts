import assert from 'assert';
import {describe, it} from 'mocha';
import { MessageHelpers, truncatedEmbedCodeField } from '../src/helpers/discord';

describe('helpers.discord', () => {
    it('truncatedEmbedCodeField', () => {
        assert.strictEqual(truncatedEmbedCodeField({name: '', value: 'foo bar'}, {maxLength: 1024}).value, '```\nfoo bar\n```');
        assert.strictEqual(truncatedEmbedCodeField({name: '', value: 'foo bar'}, {maxLength: 11}).value, '```\nfoo\n```');
    });
    describe('MessageHelpers', () => {
        it('withoutMentions', () => {
            assert.strictEqual(MessageHelpers.withoutMentions({content: 'hello'}), 'hello');
            assert.strictEqual(MessageHelpers.withoutMentions({content: ' hello'}), 'hello');
            assert.strictEqual(MessageHelpers.withoutMentions({content: '<@!3456787654456> hello'}), 'hello');
            assert.strictEqual(MessageHelpers.withoutMentions({content: '<@!3456787654456> hello <@!9434930434>'}), 'hello');
        });
    });
});
