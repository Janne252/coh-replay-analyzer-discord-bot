import assert from 'assert';
import {describe, it} from 'mocha';
import { Locale } from '.';
import i18n from '../i18n';

describe('contrib.coh2.index', () => {
    it('Locale', () => {
        const locale = new Locale({'en': {1: 'foo', 1234: 'bar'}, 'fr': {1: 'toto', 1234: 'rade'}});

        const restoreLocale = i18n.activate('en');
        // Uses i18n.activeLocale
        assert.strictEqual(locale.get(1), 'foo');
        assert.strictEqual(locale.get(1234), 'bar');

        // User-defined locale
        assert.strictEqual(locale.get(1, 'en'), 'foo');
        assert.strictEqual(locale.get(1234, 'en'), 'bar');
        assert.strictEqual(locale.get(2, 'en'), undefined);

        assert.strictEqual(locale.get(1, 'fr'), 'toto');
        assert.strictEqual(locale.get(1234, 'fr'), 'rade');
        assert.strictEqual(locale.get(2, 'fr'), undefined);

        // non-existent locale
        assert.strictEqual(locale.get(1, 'not-existent locale'), undefined);

        restoreLocale();
    });
});

