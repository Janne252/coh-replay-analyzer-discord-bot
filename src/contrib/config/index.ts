import fs from 'fs-extra';
import path from 'path';
import { PackageJson } from "type-fest";
export type PackageConfig<T> = PackageJson & Pick<T, keyof T>;

/* istanbul ignore next */
export class PackageJsonConfig {
    static async load(callback: (config: any) => void) {
        callback(JSON.parse(await fs.readFile(path.join(process.cwd(), 'package.json'), {encoding: 'utf8'})));
    }

    static async assign(config: any, section: string) {
        return this.load(result => Object.assign(config, result[section]));
    }
}
