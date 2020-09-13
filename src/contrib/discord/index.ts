import Discord from 'discord.js';

/**
 * Truncates a value to the maximum length and wraps it in code markdown tags (```).
 */
export function truncatedEmbedCodeField(
    {name, value, inline}: {name: string, value: string, inline?: boolean}, 
    {maxLength}: {maxLength: number} = {maxLength: 1024}
): Discord.EmbedFieldData {
    const prefix = '```\n';
    const suffix = '\n```';
    const max = maxLength - (prefix.length + suffix.length);
    return {
        name,
        inline,
        value: prefix + (value.length > max ? value.substring(0, max) : value) + suffix,
    };
}

/* istanbul ignore next */
/**
 * Uniform exit handing (logout from discord & safely exit)
 */
export class ShutdownManager {
    constructor(private readonly client: Discord.Client) {
    }

    async exit(code = 0) {
        try {
            this.client.destroy();
        }
        finally {
            process.exit(code);
        }
    }

    addGlobalListeners() {
        process.on('SIGINT', () => this.exit());
        process.on('SIGABRT', () => this.exit());
        process.on('SIGTERM', () => this.exit());
    }
}

export class MessageHelpers {
    public static withoutMentions(message: {content: string}) {
        return message.content.replace(/<@!\d+>/g, '').trim();
    }
}
