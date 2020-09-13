import fs from 'fs-extra';
import path from 'path';
import { PackageJson } from "type-fest";
export type PackageConfig<T> = PackageJson & Pick<T, keyof T>;

/* istanbul ignore next */
export abstract class PackageJsonConfig {
    constructor(private readonly rootPath = process.cwd()) {

    }

    async init() {
        this.configure(
            JSON.parse(await fs.readFile(path.join(this.rootPath, 'package.json'), {encoding: 'utf8'}))
        );
    }

    abstract configure(config: any): void;
}
