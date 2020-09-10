import * as child_process from 'child_process';
import fs from 'fs-extra';
import path from 'path';

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
 * Returns a copy of the input string with the first letter set to upper case.
 * @param str 
 */
export function capitalize(str: string) { 
    return str.charAt(0).toUpperCase() + str.slice(1);
}

