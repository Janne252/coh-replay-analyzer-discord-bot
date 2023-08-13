import path from 'path';
import fs from 'fs-extra';
import { formatString, StringFormatArgs } from './misc';

export class I18n {
    public catalog: Record<string, string> = {};
    public defaultLocale: string = 'en';
    public activeLocale: string = 'en';

    constructor() {

    }

    private normalizeLocale(locale: string) {
        // Split by "-"" to get the language part of locale-country pair, e.g. "en-US" -> "en"
        return locale.toLowerCase().split('-')[0];
    }

    activate(locale: string) {
        const previousLocale = this.activeLocale;
        this.activeLocale = this.normalizeLocale(locale);

        return () => this.activate(previousLocale);
    }

    async loadJsonCatalogs(rootPath: string) {
        for (const filename of await fs.readdir(rootPath)) {
            if (filename.endsWith('.json')) {
                this.read(path.join(rootPath, filename));
            }
        }
    }

    private async read(filename: string) {
        const localeName = path.basename(filename, '.json');
        const translations = JSON.parse(await fs.readFile(filename, {encoding: 'utf8'}));
        this.append(translations, this.normalizeLocale(localeName));
    }

    public append(translations: TranslationDeclaration, prefix = '') {
        for (const key in translations) {
            const value = translations[key];
            const id = `${prefix}.${key}`;
            if (typeof value === 'object') {
                this.append(value, id);
            } else {
                this.catalog[id] = value;
            }
        }
    }

    private getTranslationCatalogKey(id: string, locale: string) {
        return `${this.normalizeLocale(locale)}.${id}`;
    }

    public get(id: string, {format, locale, fallback}: {format?: StringFormatArgs, locale?: string, fallback?: string} = {}): string  {
        let key = this.getTranslationCatalogKey(id, locale ?? this.activeLocale ?? this.defaultLocale);
        if (!(key in this.catalog) && locale != this.defaultLocale) {
            key = this.getTranslationCatalogKey(id, this.defaultLocale);
        }
        let message = this.catalog[key] ?? fallback ?? id;
        if (format) {
            message = formatString(message, format);
        }

        return message;
    }

    public override(...translations: [string, TranslationDeclaration][]) {
        const previous = JSON.parse(JSON.stringify(this.catalog));
        for (const [locale, catalog] of translations) {
            this.append(catalog, locale);
        }
        return () => this.catalog = previous;
    }
}

const i18n = new I18n();
export default i18n;

export interface TranslationDeclaration {
    [key: string]: string | TranslationDeclaration;
}