import path from 'path';
import { ensureAbsolutePath } from '../../contrib/misc';
import * as fs from 'fs-extra';

/* istanbul ignore next */
export default class ReplaysConfig {
    factionEmojis: Record<string, string> = {};
    leaderboardUrl?: {template: string, query: Record<string, string>};
    waitForDeletionTimeoutSeconds: number = 0;

    private _flankExecutablePath: string = '';
    get flankExecutablePath() { return this._flankExecutablePath; }
    set flankExecutablePath(value: string) { this._flankExecutablePath = ensureAbsolutePath(value)};

    _localeFilePaths: Record<string, string> = {};
    get localeFilePaths() { return this._localeFilePaths; }
    set localeFilePaths(value: Record<string, string>) { 
        this._localeFilePaths = {};
        for (const localeName in value) {
            this._localeFilePaths[localeName] = ensureAbsolutePath(value[localeName]);
        }
    };

    _replaysTempPath: string = '';
    get replaysTempPath() { return this._replaysTempPath; }
    set replaysTempPath(value: string) { this._replaysTempPath = ensureAbsolutePath(value)};

    _scenarioPreviewImageRootPath: string = '';
    get scenarioPreviewImageRootPath() { return this._scenarioPreviewImageRootPath; }
    set scenarioPreviewImageRootPath(value: string) { this._scenarioPreviewImageRootPath = ensureAbsolutePath(value)};

    _commanderDatabaseFilepath: string = '';
    get commanderDatabaseFilepath() { return this._commanderDatabaseFilepath; }
    set commanderDatabaseFilepath(value: string) { this._commanderDatabaseFilepath = ensureAbsolutePath(value)};

    minDataLength: number = 0;
    magic: string = '';
    minVersion: number = 0;
    expandChatPreview: { reaction: string; timeoutSeconds: number; } = {reaction: '', timeoutSeconds: 0};
    flankArgs: string = '';
    commanderDatabase: (CommanderDatabaseEntry | BattlegroupDatabaseEntry)[] = [];
    customMapSupportRequestInviteUrl: string = '';
    commanderColumnTitle: string = '';

    async init() {
        this.commanderDatabase = JSON.parse(await fs.readFile(this.commanderDatabaseFilepath, {encoding: 'utf-8'}));
    }
}

export interface CommanderDatabaseEntry {
    name: string;
    server_id: number;
    locstring: {
        name: number;
        description: number;
        description_short: number;
    }
    icon: {
        icon: string;
        icon_secondary: string;
    }
}

export interface BattlegroupDatabaseEntry {
    id: number;
    upgrade_id: number;
    display_name: string;
}