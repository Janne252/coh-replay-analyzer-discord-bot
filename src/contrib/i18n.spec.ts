import assert from 'assert';
import {describe, it} from 'mocha';
import I18n from './i18n';

function makeTranslations(...locales: [ string, any][]) {
    const i18n = new I18n('');
    for (const [locale, definition] of locales) {
        i18n.append(definition, locale);
    }
    return i18n;
}

describe('contrib.i18n', () => {
    it('translations', () => {
        const i18n = makeTranslations(['en', {word: {'yes': 'yes', 'no': 'no'}}], ['fr', {word: {'yes': 'oui'}}]);
        assert.deepStrictEqual(i18n.catalog, {'en.word.yes': 'yes', 'en.word.no': 'no', 'fr.word.yes': 'oui'});
        assert.strictEqual(i18n.get('word.yes'), 'yes');
        assert.strictEqual(i18n.get('word.yes', 'fr'), 'oui');
        assert.strictEqual(i18n.get('word.no', 'en'), 'no');
        // Fallback to english
        assert.strictEqual(i18n.get('word.no', 'fr'), 'no');
        // Use key as the return value for non-existent translations
        assert.strictEqual(i18n.get('word.foo', 'fr'), 'word.foo');
    });
    it('formatted translations', () => {
        const i18n = makeTranslations(['en', {display: {value: 'value is {value}'}}]);
        assert.strictEqual(i18n.get('display.value', 'en', {value: 1}), 'value is 1');
    });
});
