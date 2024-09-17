# Usage
- All paths in these instructions are relative to the root directory of this repository. For example if you've cloned this repository to `C:/dev/coh-replay-analyzer-discord-bot`, all relative paths in these instructions point to `C:/dev/coh-replay-analyzer-discord-bot`.

## General Requirements
- `Company of Heroes 3` installed locally
- `.NET Framework 4.7.2` SDK (optional for running the actual preview image generator program)

## Updating or adding a new map preview image

### CoH3
> Exporting `_handmade.rrtex` as `.tga` is currently a manual process due to not having access to general purpose RRTEX decoder. If there is, open an issue!

1. Export all  `_handmade.rrtex` to `data-generator/assets/scenario-preview-images/coh3` with Essence Editor
    1. Launch `SteamLibrary/steamapps/common/Company of Heroes 3/EssenceEditor.exe` 
    1. Choose "Continue without a mod"
    1. Drag and drop `SteamLibrary/steamapps/common/Company of Heroes 3/anvil/archives/ScenariosMP.sga` into the Essence Editor
    1. Expand the folder path `data/scenarios/multiplayer/benghazi_6p/`
    1. Double-click the `benghazi_6p_mm_handmade.rrtex` file
    1. Click the 💾 save button in the image preview tool
    1. Save it as `.tga` to `data-generator/assets/scenario-preview-images/coh3` (default)
    1. Repeat for all maps
    1. You can open a PR at this stage if you want to skip the Visual Studio part since exporting the map preview images is the most labor intensive part.

1. Create `./.env.local` based on [`./env.local.template`](./.env.local.template)
1. Open The solution `CoHReplayAnalyzerDiscordBotDataGenerator.sln` in Visual Studio 2022
1. Start the project (`Program.cs` should be "configured" to only generate CoH3 scenario preview images)

## Updating Commander / Battlegroup databases

### CoH3
> This process is currently manual and the battlegroup display names are not obtained from the game's localization. Instead we're maintaining a JSON file for now.
1. Open `data/game-data/coh3/battlegroups.json` in a code editor, e.g. VS Code or NotePad++
1. Launch `SteamLibrary/steamapps/common/Company of Heroes 3/EssenceEditor.exe` 
1. Choose "Continue without a mod"
1. Select "Attributes" -> "Open Attributes"
1. Copy the IDs of the new battlegroup(s)
    1. Example:
    1. Browse to `army_upgrade/battlegroups/american/infantry` and double click it to view its property tree 
    1. Copy the value of the `pbgid` field to the JSON field `id` (For Advanced Infantry Battlegroup it should be `2044459`)
    1. Copy the localized string value of the `name` entry to the JSON field `display_name` (For Advanced Infantry Battlegroup it should be `Advanced Infantry Battlegroup`)
    1. Right click `tech_tree` and select "Go To Reference" (should be visible in the tree a few lines above the `pbgid` entry)
        1. This should open `tech_tree/battlegroup/races/american/infantry`
    1. Right-click `activation_upgrade` and select "Go To Reference"
        1. This should open `upgrade/american/battlegroups/infantry/infantry`
    1. Copy the value of the `pbgid` field to the JSON field `upgrade_id` (For Advanced Infantry Battlegroup it should be `178732`)
    1. Repeat for all new battlegroups
