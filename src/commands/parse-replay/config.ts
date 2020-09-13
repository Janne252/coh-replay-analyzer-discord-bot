import path from 'path';
import { PackageConfig, PackageJsonConfig } from "../../contrib/config";

/* istanbul ignore next */
export default class ReplaysConfig extends PackageJsonConfig {
    //@ts-expect-error 2564
    factionEmojis: Record<string, string>;

    leaderboardUrl?: string;

    //@ts-expect-error 2564
    flankExecutablePath: string;

    //@ts-expect-error 2564
    localeFilePath: string;

    //@ts-expect-error 2564
    replaysTempPath: string;

    //@ts-expect-error 2564
    scenarioPreviewImageRootPath: string;

    //@ts-expect-error 2564
    minDataLength: number;
    //@ts-expect-error 2564
    magic: string;
    //@ts-expect-error 2564
    minVersion: number;

    constructor(private readonly root: string = process.cwd()) {
        super();
    }
    
    configure(config: PackageConfig<{replays: ReplaysConfig}>) {
        this.magic = config.replays.magic;
        this.minVersion = config.replays.minVersion;
        this.minDataLength = config.replays.minDataLength;

        this.flankExecutablePath = path.join(this.root, config.replays.flankExecutablePath);
        this.localeFilePath = path.join(this.root, config.replays.localeFilePath);
        this.replaysTempPath = path.join(this.root, config.replays.replaysTempPath);
        this.scenarioPreviewImageRootPath = path.join(this.root, config.replays.scenarioPreviewImageRootPath);

        this.factionEmojis = config.replays.factionEmojis;
        this.leaderboardUrl = config.replays.leaderboardUrl;
    }
}