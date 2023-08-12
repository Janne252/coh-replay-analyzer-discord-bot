using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using DotNetEnv;
using Humanizer;
using Newtonsoft.Json;
using SteamWebAPI2.Interfaces;
using SteamWebAPI2.Utilities;

namespace CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.UpdateCustomScenarios
{
    /// <summary>
    /// Iterates over configured custom scenarios and checks if they've changed since the last check.
    /// Downloads changed items from the Steam Workshop and caches them locally.
    /// </summary>
    /// <returns></returns>
    /// 
    internal class UpdateCustomScenarios
    {
        /// <summary>
        /// Defines the deserialization structure of a custom scenario to include in scenario preview image generation.
        /// </summary>
        public class CustomScenarioDefinition
        {
            [JsonProperty("id")]
            public ulong WorkshopId { get; set; }
            [JsonProperty("name")]
            public string Name { get; set; }
        }

        public string CustomScenariosConfigFilePath { get; private set; }
        public string CachedCustomScenariosOutputRootPath { get; private set; }

        public UpdateCustomScenarios(string envPrefix)
        {
            CustomScenariosConfigFilePath = Env.GetString($"{envPrefix}_CUSTOM_SCENARIOS_CONFIG_FILE_PATH", fallback: null);
            CachedCustomScenariosOutputRootPath = Env.GetString($"{envPrefix}_CUSTOM_SCENARIOS_DOWNLOAD_CACHE_ROOT_PATH", fallback: null);
        }
        public async Task Run()
        {
            if (CustomScenariosConfigFilePath == null)
            {
                return;
            }

            var customScenarios = JsonConvert.DeserializeObject<List<CustomScenarioDefinition>>(System.IO.File.ReadAllText(CustomScenariosConfigFilePath));
            Console.WriteLine($"Beginning to check updates for {customScenarios.Count} custom scenarios...");
            var apiFactory = new SteamWebInterfaceFactory(Env.GetString("STEAM_WEB_API_KEY"));
            var webClient = new WebClient();
            var api = apiFactory.CreateSteamWebInterface<SteamRemoteStorage>(new HttpClient());

            var scenarioCacheRootPath = CachedCustomScenariosOutputRootPath;
            if (!Directory.Exists(scenarioCacheRootPath))
            {
                Directory.CreateDirectory(scenarioCacheRootPath);
            }

            var lastCheckedTimestampFilepath = Path.Combine(scenarioCacheRootPath, ".last-checked.timestamp");
            if (System.IO.File.Exists(lastCheckedTimestampFilepath))
            {
                var lastCheckedAt = DateTime.Parse(System.IO.File.ReadAllText(lastCheckedTimestampFilepath).Trim());
                // If the last checked timestamp is more recent than 24 hours ago
                if (lastCheckedAt > (DateTime.UtcNow - TimeSpan.FromHours(24)))
                {
                    Console.WriteLine($"Custom scenarios were last checked for an update {lastCheckedAt.Humanize()} ({lastCheckedAt}). Skipping the update.");
                    return;
                }
            }

            foreach (var scenario in customScenarios)
            {
                Console.WriteLine($"\tBeginning to update scenario {scenario.WorkshopId} ({scenario.Name})");
                var itemInfo = await api.GetPublishedFileDetailsAsync(scenario.WorkshopId);
                if (itemInfo == null)
                {
                    throw new Exception($"\t\tFailed to fetch Steam Workshop item info of {scenario.WorkshopId}");
                }

                var lastModified = itemInfo.Data.TimeUpdated;
                var epocTimestamp = new DateTimeOffset(lastModified, TimeSpan.Zero).ToUnixTimeSeconds();
                var cachedFilepath = Path.Combine(CachedCustomScenariosOutputRootPath, $"{epocTimestamp}.{scenario.WorkshopId}.sga");
                if (System.IO.File.Exists(cachedFilepath))
                {
                    Console.WriteLine($"\t\tLatest version {epocTimestamp} already cached locally.");
                    continue;
                }

                Console.WriteLine($"\t\tLatest version {epocTimestamp} not found from the local cache. Clearing previous versions and fetching the latest version...");
                foreach (var outdatedScenarioFile in Directory.GetFiles(scenarioCacheRootPath, $"*{scenario.WorkshopId}.sga", SearchOption.AllDirectories))
                {
                    System.IO.File.Delete(outdatedScenarioFile);
                    Console.WriteLine($"\t\t{Path.GetFileName(outdatedScenarioFile)} deleted.");
                }

                await webClient.DownloadFileTaskAsync(itemInfo.Data.FileUrl, cachedFilepath);

                Console.WriteLine($"\t\t{epocTimestamp} of {scenario.WorkshopId} successfully downloaded!");
            }
            Console.WriteLine($"Finished processing {customScenarios.Count} custom scenarios.\n\n");
            System.IO.File.WriteAllText(lastCheckedTimestampFilepath, DateTime.UtcNow.ToString("s", System.Globalization.CultureInfo.InvariantCulture));
        }
    }
}
