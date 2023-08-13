import * as Discord from 'discord.js';
import tryParseReplay from '../../commands/parse-replay';

export const commandName = 'replay';

export const handler = async (interaction: Discord.MessageContextMenuCommandInteraction) => {
    const message = interaction.targetMessage;
    await interaction.deferReply();
    try {
        await tryParseReplay(message);
    } finally {
        await interaction.deleteReply();
    }
}

