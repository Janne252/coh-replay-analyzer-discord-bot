using COH2ReplayDiscordBotDataGenerator.Attributes;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Xml;
using System.Xml.Serialization;

namespace COH2ReplayDiscordBotDataGenerator.Output
{
    public static class CommanderDatabase
    {
        /// <summary>
        /// Iterates over commanders present in the Company of Heroes 2 official modding tool data.
        /// </summary>
        public static void Output(string CoH2ModdingToolDataSourceRootPath, string CommanderIconsSourceRoot, string CommanderIconDestinationRoot, string CommanderDatabaseDestinationFilepath)
        {
            // Technically this step should iterate over data in AttribArchive.sga as the modding tool data is often lagging behind a game update or 2.
            // However deserialization of .rgd files is a bit more complex. Source code references for this are available, for both
            // reading Relic Chunky format and the inner RGD data. 
            // The most important value is the server id of a commander. It's likely safe to assume the server id of an item is never going to change.
            // The second most important value is the locstring ID of a commander's name. Locstring IDs are also assumed never to change.
            // We're loading the localized name of the commander from the live game data (RelicCoH2.English.ucs).
            Console.WriteLine("Beginning to compile Commander database...");
            var result = new List<JObject>();

            foreach (var commanderFilepath in Directory.GetFiles(Path.Join(CoH2ModdingToolDataSourceRootPath, @"attributes\instances\commander"), "*.xml", SearchOption.AllDirectories))
            {
                var commanderName = Path.GetFileNameWithoutExtension(commanderFilepath);
                using var stream = System.IO.File.Open(commanderFilepath, FileMode.Open, FileAccess.Read, FileShare.Read);
                var commanderData = new XmlSerializer(typeof(Commander)).Deserialize(XmlReader.Create(stream)) as Commander;
                var commanderId = commanderData.Data.Templates.First(t => t.Name == "server_item" && t.Value == "server_item").UniqueId;
                if (commanderId.Name != "server_id")
                {
                    throw new Exception($"\tCould not find server_id for commander {commanderFilepath}");
                }

                dynamic commander = new JObject();
                commander.name = commanderName;
                commander.server_id = commanderId.Value;
                commander.locstring = new JObject();
                commander.icon = new JObject();
                foreach (var locstring in commanderData.Data.LocStrings)
                {
                    commander.locstring[locstring.Name] = locstring.Value;
                }
                foreach (var icon in commanderData.Data.Icons)
                {
                    commander.icon[icon.Name] = icon.Value;
                }

                var smallIconName = commanderData.Data.Icons.First(i => i.Name == "icon").Value;
                var commanderIconFilepath = Path.Join(CommanderIconsSourceRoot, $"{smallIconName}.png");
                if (smallIconName == "")
                {
                    Console.WriteLine($"\tCommander {commanderName} icon is not set.");
                }
                else if (!System.IO.File.Exists(commanderIconFilepath))
                {
                    throw new Exception($"\tCommander {commanderName} icon is not available.");
                }
                else
                {
                    System.IO.File.Copy(commanderIconFilepath, Path.Join(CommanderIconDestinationRoot, $"cmdr-{commanderId.Value}.png"), true);
                }
                result.Add(commander);
            }

            File.WriteAllText(CommanderDatabaseDestinationFilepath, JsonConvert.SerializeObject(result, Newtonsoft.Json.Formatting.Indented));
            Console.WriteLine($"Commander database compilation succeeded. Total of {result.Count} commanders processed.\n\n");
        }
    }
}
