import * as child_process from 'child_process';

/* istanbul ignore next */
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

export interface StringFormatArgs {
    [key: string]: number | string;
}

// TODO add unit tests
export function formatString(str: string, args?: StringFormatArgs) {
    if (args != null) {
        return str.replace(/\{(.*?)\}/g, (match, key) => {
            if (args.hasOwnProperty(key)) {
                let value = args[key];
                if (value != null) {
                    let strValue = value.toString();
                    return strValue;
                } else {
                    return '';
                }
            } else {
                return match;
            }
        });
    } else {
        return str;
    }
}
