import { PackageJsonConfig, PackageConfig } from '../config';

/* istanbul ignore next */
/**
 * Helper for writing log messages to a discord channel.
 */
export class AdminConfig extends PackageJsonConfig {

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
    user: string;
   

    configure(config: PackageConfig<{admin: AdminConfig}>) {
        this.log = config.admin.log;
        this.test = config.admin.test;
        this.user = config.admin.user;
    }
}