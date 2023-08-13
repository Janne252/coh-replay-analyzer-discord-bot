import * as Discord from 'discord.js';
import tryParseReplay from '../../commands/parse-replay';
import { I18n } from '../../contrib/i18n';
import { ApplicationCommandScope } from '../../types';

export const commandName = 'replay';

export const getOptions = (i18n: I18n, scope: ApplicationCommandScope) => {
    return new Discord.ContextMenuCommandBuilder()
    .setName(commandName)
    .setType(Discord.ApplicationCommandType.Message)
    .setNameLocalization('en-US', i18n.get(`command.messageContextMenu.createReplayEmbed.${scope}`))
    .setNameLocalization('en-GB', i18n.get(`command.messageContextMenu.createReplayEmbed.${scope}`))
    .setNameLocalization('fr', i18n.get(`command.messageContextMenu.createReplayEmbed.${scope}`, {locale: 'fr'}))
}

export const handler = async (interaction: Discord.MessageContextMenuCommandInteraction) => {
    const message = interaction.targetMessage;
    await interaction.deferReply();
    try {
        await tryParseReplay(message);
    } finally {
        await interaction.deleteReply();
    }
}

