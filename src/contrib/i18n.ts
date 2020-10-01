import path from 'path';
import fs from 'fs-extra';
import { formatString, StringFormatArgs } from './misc';

export default class I18n {
    public readonly catalog: Record<string, string> = {};
    public activeLocale: string = 'en';

    constructor(private readonly path: string, public readonly defaultLocale = 'en') {

    }

    activate(locale: string) {
        const previousLocale = this.activeLocale;
        this.activeLocale = locale;

        return () => this.activate(previousLocale);
    }

    async init() {
        for (const file of await fs.readdir(this.path)) {
            if (file.endsWith('.json')) {
                this.read(file);
            }
        }
    }

    private async read(filename: string) {
        const localeName = path.basename(filename, '.json');
        const translations = JSON.parse(await fs.readFile(path.join(this.path, filename), {encoding: 'utf8'}));
        this.append(translations, localeName);
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

    private normalizeLocale(locale: string) {
        return locale.toLowerCase().split('-')[0];
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
}

export interface TranslationDeclaration {
    [key: string]: string | TranslationDeclaration;
}