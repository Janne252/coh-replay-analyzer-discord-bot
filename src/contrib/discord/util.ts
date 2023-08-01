// Ported from https://github.com/discordjs/discord.js/blob/v12/src/util/Util.js

/**
 * Contains various general-purpose utility methods. These functions are also available on the base `Discord` object.
 */
export default class Util {
  constructor() {
    throw new Error(`The ${this.constructor.name} class may not be instantiated.`);
  }

  /**
   * Splits a string into multiple chunks at a designated character that do not exceed a specific length.
   * @param {StringResolvable} text Content to split
   * @param {SplitOptions} [options] Options controlling the behavior of the split
   * @returns {string[]}
   */
  static splitMessage(text: string, { maxLength = 2000, char = '\n', prepend = '', append = '' } = {}) {
    text = Util.resolveString(text);
    if (text.length <= maxLength) return [text];
    const splitText = text.split(char);
    if (splitText.some(chunk => chunk.length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');
    const messages: string[] = [];
    let msg = '';
    for (const chunk of splitText) {
      if (msg && (msg + char + chunk + append).length > maxLength) {
        messages.push(msg + append);
        msg = prepend;
      }
      msg += (msg && msg !== prepend ? char : '') + chunk;
    }
    return messages.concat(msg).filter(m => m);
  }

  /**
   * Resolves a StringResolvable to a string.
   * @param {StringResolvable} data The string resolvable to resolve
   * @returns {string}
   */
  static resolveString(data: any) {
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data.join('\n');
    return String(data);
  }
}
