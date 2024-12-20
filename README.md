[![](https://img.shields.io/discord/753277157027086427?color=%2336393f&label=Support%20Discord&logo=discord&logoColor=white)](https://discord.gg/RwCZTUwMd3)

# Intro
This Discord bot processes Company of Heroes 2 and 3 replay files (`.rec`) that users have attached to their messages.
The bot provides a summary of the replay's details:
- Map name
- Map tactical map image
- Players (names, factions, links to their leaderboard profiles)
- Chat
- Match duration
- Game version
- Chosen commanders

![](./media/examples/full-embed.png)

The bot also has a mode for creating compact, less verbose embeds, where the summary details are:
- Map name
- Map tactical map image (as a small thumbnail image)
- Players (names, factions, links to their leaderboard profiles,)
- Match duration

![](./media/examples/compact-embed.png)

This mode is controlled by the `Manage Messages` permission or by the message content (set the "add a comment" field to `compact`). To enable the compact mode, disable `Manage Messages` permission in the bot role permissions (global) or in the channel bot role permissions (per channel). 

Replay parsing is based on Ryan Tailor's excellent libraries: [ryantaylor/vault](https://github.com/ryantaylor/vault) and [ryantaylor/flank](https://github.com/ryantaylor/flank).

# Installation
- Bot authentication link: https://discord.com/oauth2/authorize?client_id=753206700655378523&permissions=2147870720&scope=bot
    | Required bot permission | Purpose |
    |-------|---------|
    |`Send Messages`| Send replay info embeds. |
    |`Read Message History`| Reply to the original messag containing the replay attachment(s). |
    |`Manage Messages`| Manage interactions (e.g. buttons) added to replay embeds. |
    |`Embed Links`| Embed markdown links (chat expansion link). |
    |`Attach Files`| Attach map preview images to embeds. |
    |`Use External Emojis`| Use standalone CoH2 and CoH3 faction emojis from the bot's [Support Discord server](https://discord.gg/nBQQ4Xh5RR): <br /><img title=":coh3_german:" src="./media/discord/emoji/coh3/german_small.png" width="24" height="24"> <img title=":coh3_american:" src="./media/discord/emoji/coh3/american_small.png" width="24" height="24"> <img title=":coh3_afrika_korps:" src="./media/discord/emoji/coh3/afrika_korps_small.png" width="24" height="24"> <img title=":coh3_british:" src="./media/discord/emoji/coh3/british_small.png" width="24" height="24"> <img title=":german:" src="./media/discord/emoji/coh2/german.png" width="24" height="24"> <img title=":soviet:" src="./media/discord/emoji/coh2/soviet.png" width="24" height="24"> <img title=":west_german:" src="./media/discord/emoji/coh2/west_german.png" width="24" height="24"> <img title=":aef:" src="./media/discord/emoji/coh2/aef.png" width="24" height="24"> <img title=":british:" src="./media/discord/emoji/coh2/british.png" width="24" height="24"> |
    |`Use Slash Commands`| Add interactions to replay embeds, e.g. "Expand chat". |
    
- ❤️ Please consider inviting `Janne252#7736` to the server(s) the bot has been added to ❤️

# Custom maps
Custom map support is based on a curated list of maps in [`data-generator/assets/custom-scenarios/coh2.json`](data-generator/assets/custom-scenarios/coh2.json). 
To add a new custom map to the list, open a pull request that targets `data-generator/assets/custom-scenarios/coh2.json` (preferred).
Alternatively you can request support fora custom map on the [support Discord server](https://discord.gg/nBQQ4Xh5RR) or by opening an issue on the GitHub repository.

# Game updates
CoH3 is likely to receive updates that add new maps or battlegroups. The author of the repository usually adds support for new content after a patch but _you_ may also contribute these updates via pull requests. Rough instructions for this are available in the `data-generator` [app readme](./data-generator/readme.md).

# Support
[Support server (Discord)](https://discord.gg/nBQQ4Xh5RR)

# License
[MIT License](./LICENSE.txt)
