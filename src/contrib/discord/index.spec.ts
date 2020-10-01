import assert from 'assert';
import {describe, it} from 'mocha';
import { MessageHelpers, truncatedEmbedCodeField } from '.';

describe('contrib.discord', () => {
    it('truncatedEmbedCodeField', () => {
        assert.strictEqual(truncatedEmbedCodeField({name: '', value: 'foo bar'}, {maxLength: 1024}).value, '```\nfoo bar\n```');
        assert.strictEqual(truncatedEmbedCodeField({name: '', value: 'foo bar'}, {maxLength: 11}).value, '```\nfoo\n```');
    });
    describe('MessageHelpers', () => {
        it('withoutMentions', () => {
            assert.strictEqual(MessageHelpers.strip({content: 'hello'}), 'hello');
            assert.strictEqual(MessageHelpers.strip({content: ' hello'}), 'hello');
            assert.strictEqual(MessageHelpers.strip({content: '<@!3456787654456> hello'}), 'hello');
            assert.strictEqual(MessageHelpers.strip({content: '<@!3456787654456> hello <@!9434930434>'}), 'hello');
            // Mobile client does not include the !
            assert.strictEqual(MessageHelpers.strip({content: '<@3456787654456> hello <@9434930434>'}), 'hello');
        });
    });
});
