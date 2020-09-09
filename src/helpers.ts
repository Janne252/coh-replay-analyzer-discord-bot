import * as child_process from 'child_process';
import fs from 'fs-extra';

/**
 * Promise-based wrapper for child_process.exec.
 * @param command 
 */
export function exec(command: string): Promise<{stdout: string, stderr: string}> {
    return new Promise((resolve, reject) => {
        child_process.exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            resolve({stdout, stderr});
        });
    });
}

/**
 * Represents a a wrapper class that provides localized strings from a RelicCOH2.<language>.ucs file.
 */
export class Locale {
    private readonly messages: Record<string, string> = {};
    /**
     * 
     * @param filepath 
     * @param idPrefix Prefixed added to each message ID. Defaults to '$'.
     */
    constructor(readonly filepath: string, private readonly idPrefix = '$') {

    }

    async init() {
        const localeStrings = (await fs.readFile(this.filepath, {encoding: 'utf-8'})).split('\n');
        for (const row of localeStrings) {
            const [id, message] = row.split('\t').map(part => part.trim());
            this.messages[`${this.idPrefix}${id}`] = message;
        }
    }

    get(id: string) {
        return this.messages[id];
    }
}

/**
 * Returns a copy of the input string with the first letter set to upper case.
 * @param str 
 */
export function capitalize(str: string) { 
    return str.charAt(0).toUpperCase() + str.slice(1);
}
