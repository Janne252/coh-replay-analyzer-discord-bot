import path from 'path';
import { ensureAbsolutePath } from '../../contrib/misc';

/* istanbul ignore next */
export default class ReplaysConfig {
    factionEmojis: Record<string, string> = {};
    leaderboardUrl?: string | undefined;
    waitForDeletionTimeoutSeconds: number = 0;

    private _flankExecutablePath: string = '';
    get flankExecutablePath() { return this._flankExecutablePath; }
    set flankExecutablePath(value: string) { this._flankExecutablePath = ensureAbsolutePath(value)};

    _localeFilePath: string = '';
    get localeFilePath() { return this._localeFilePath; }
    set localeFilePath(value: string) { this._localeFilePath = ensureAbsolutePath(value)};

    _replaysTempPath: string = '';
    get replaysTempPath() { return this._replaysTempPath; }
    set replaysTempPath(value: string) { this._replaysTempPath = ensureAbsolutePath(value)};

    _scenarioPreviewImageRootPath: string = '';
    get scenarioPreviewImageRootPath() { return this._scenarioPreviewImageRootPath; }
    set scenarioPreviewImageRootPath(value: string) { this._scenarioPreviewImageRootPath = ensureAbsolutePath(value)};

    minDataLength: number = 0;
    magic: string = '';
    minVersion: number = 0;
    expandChatPreview: { reaction: string; timeoutSeconds: number; } = {reaction: '', timeoutSeconds: 0};
}
