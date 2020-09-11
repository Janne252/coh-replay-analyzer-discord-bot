# Intro
This Discord bot is currently under development.
The bot is being tested on https://discord.com/invite/coh2org.

Replay parsing is based on Ryan Tailor's excellent libraries: [ryantaylor/vault](https://github.com/ryantaylor/vault) and [ryantaylor/flank](https://github.com/ryantaylor/flank).

# Manual setup
- Bot authentication link: https://discord.com/api/oauth2/authorize?client_id=753206700655378523&permissions=280640&scope=bot
    - Scopes: `Send Messages`, `Embed Links`, `Use External Emojis`, `Add Reactions`
    - Currently set to "private" - sorry! Only the author can add it to a server. And even then the author has to be the owner of the server.
    - The bot will be made public later on. Assuming all goes well.

# TODO
- [ ] Use the "home" discord server as a CDN For map images?
    - [ ] Increase image quality to 85% (JPG)
    - [ ] Increase resolution to 512x512
- [ ] See if `"{0}_mm_preview_high.tga"` should have a higher priority than `"{0}_mm_preview.tga"` (Higher resolution, still the same artistic render of the tactical map)
- [x] Use full scenario paths for identifying preview images. Replace path separators with underscores.
- [x] Preview image generation step should empty the destination directory before outputting any files.
- [ ] Show player loadouts?
    - [ ] Commanders
    - [ ] Intel bulletins (likely not relevant)
    - [ ] Skins (likely not relevant)
- [x] Show match length
    - Really not a spoiler as it's both displayed in the list of replays and in-game.
    - Implemented using Discord's spoiler tag
- [x] Show chat?
    - How do we limit the number of lines; The embed likely cannot scroll overflowing content.
    - Perhaps there is a markdown notation for code / quote blocks with scrolling?
    - Considered a spoiler; Chat often reveals the winning player.
    - Maybe a bot command to include chat?
    - Can probably be rendered with a spoiler tag, has to be limited to 1024 characters similar to other embed fields.
- [x] render map images with resource & strategic point icons overlay
    - This algorithm can be copied from https://github.com/Janne252/coh2-tactical-map-icons-renderer
- [x] Test with custom maps. If the Steam Workshop item id is present in the replay data somehow, we might be able to fetch the image from Steam (Open Graph meta tags).
    - Owner of the map who uses a local copy likely won't have this data present, but it's a minor inconvenience. And it's known!
    - Nope, cannot be done. The replay file contains the asset path of the map.
- [x] Add a status message to the bot
    - Done, does not seem to work though.
# License
[MIT License](./LICENSE.txt)
