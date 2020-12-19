using COH2ReplayDiscordBotDataGenerator.Attributes;
using COH2ReplayDiscordBotDataGenerator.Tasks;
using Humanizer;
using LuaInterface;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RelicCore.Archive;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Processing;
using SteamWebAPI2.Interfaces;
using SteamWebAPI2.Utilities;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Xml;
using System.Xml.Serialization;

namespace COH2ReplayDiscordBotMapImageExtractor
{
    class Program
    {
        static List<string> Output = new List<string>();

        /// <summary>
        /// Absolute path to the directory from which the program entrypoint is located.
        /// </summary>
        public static string StartupRootPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);

        public static string CoH2GameRootPath = System.IO.File.ReadAllText(Path.Join(StartupRootPath, ".coh2.game.rootpath.local")).Trim();
        public static string CoH2ArchivesRootPath = Path.Join(CoH2GameRootPath, "CoH2", "Archives");
        public static string CoH2ModdingToolDataSourceRootPath = System.IO.File.ReadAllText(Path.Join(StartupRootPath, ".coh2.modding-tool-data.rootpath.local")).Trim();
        public static string ScenarioPreviewImageDestinationRootPath = System.IO.File.ReadAllText(Path.Join(StartupRootPath, ".scenario-images.output.rootpath.local")).Trim();
        public static string CommanderIconDestinationRoot = System.IO.File.ReadAllText(Path.Join(StartupRootPath, ".commander-icons.output.rootpath.local")).Trim();
        public static string CommanderDatabaseDestinationFilepath = System.IO.File.ReadAllText(Path.Join(StartupRootPath, ".commander-database.output.rootpath.local")).Trim();
        public static string ScenarioIconsSourceRootPath = Path.Join(StartupRootPath, @"assets\icons\minimap");
        public static string CommanderIconsSourceRoot = Path.Join(StartupRootPath, @"assets\icons\commander");
        public static string CachedCustomScenariosOutputRootPath = Path.Join(StartupRootPath, ".workshop-downloads-cache");

        static async Task Main(string[] args)
        {
            GenerateCommanderDatabase.Run(
                CoH2ModdingToolDataSourceRootPath,
                CommanderIconsSourceRoot,
                CommanderIconDestinationRoot,
                CommanderDatabaseDestinationFilepath
            );
            await UpdateCustomScenarios.Run(
                StartupRootPath,
                CachedCustomScenariosOutputRootPath
            );
            GenerateScenarioPreviewImages.Run(
                CoH2ArchivesRootPath,
                CachedCustomScenariosSourceRootPath: CachedCustomScenariosOutputRootPath,
                ScenarioPreviewImageDestinationRootPath,
                ScenarioIconsSourceRootPath
            );
        }
    }
}
