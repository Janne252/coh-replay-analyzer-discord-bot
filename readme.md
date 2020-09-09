# Intro
This Discord bot is currently under development.
The bot is being tested on https://discord.com/invite/coh2org.

# Manual setup
- Bot authentication link: https://discord.com/api/oauth2/authorize?client_id=753206700655378523&permissions=280640&scope=bot
    - Scopes: `Send Messages`, `Embed Links`, `Use External Emojis`, `Add Reactions`
    Currently set to "private" - sorry! Only the author can add it to a server. And even then the author has to be the owner of the server.
    The bot will be made public later on. Assuming all goes well.

# TODO
- [ ] Use the "home" discord server as a CDN For map images?
    - [ ] Increase image quality to 85% (JPG)
    - [ ] Increase resolution to 512x512
- [ ] Show player loadouts?
    - [ ] Commanders
    - [ ] Intel bulletins (likely not relevant)
    - [ ] Skins (likely not relevant)
- [ ] Show match length
    - Really not a spoiler as it's both displayed in the list of replays and in-game.
- [ ] Show chat?
    - How do we limit the number of lines; The embed likely cannot scroll overflowing content.
    - Perhaps there is a markdown notation for code / quote blocks with scrolling?
    - Considered a spoiler; Chat often reveals the winning player.
    - Maybe a bot command to include chat?
- [ ] render map images with resource & strategic point icons overlay
    - This algorithm can be copied from https://github.com/Janne252/coh2-tactical-map-icons-renderer

# License
[Zlib License](./LICENSE)