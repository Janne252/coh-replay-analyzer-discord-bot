import { PackageJsonConfig, PackageConfig } from '../config';
import { LogLevel, LogLevelOption } from './logging';

/* istanbul ignore next */
/**
 * Helper for writing log messages to a discord channel.
 */
export class DiagnosticsConfig extends PackageJsonConfig {

    //@ts-expect-error 2564
    log: {
        readonly guild: string;
        readonly channel: string;
    }

    //@ts-expect-error 2564
    test: {
        readonly guild: string;
        readonly channel: string;
    }
    //@ts-expect-error 2564
    error: {
        readonly guild: string;
        readonly channel: string;
    }
   
    //@ts-expect-error 2564
    admin: {
        readonly guild: string;
        readonly user: string;
    }

    configure(config: PackageConfig<{diagnostics: DiagnosticsConfig}>) {
        for (const level of Object.keys(LogLevel).map(key => LogLevel[key as keyof LogLevel] as LogLevelOption)) {
            if (!(level.name in config.diagnostics)) {
                throw new Error(`Missing diagnostics configuration "${level.name}"`); 
            }
            this[level.name as keyof DiagnosticsConfig] = config.diagnostics[level.name as keyof DiagnosticsConfig] as any;
        }
        this.admin = config.diagnostics.admin;
    }
}
