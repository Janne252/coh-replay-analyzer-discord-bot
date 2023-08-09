using Essence.Core.IO.Archive;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Archive = Essence.Core.IO.Archive.Archive;
using ArchiveFolder = Essence.Core.IO.Archive.Folder;
using ArchiveFile = Essence.Core.IO.Archive.File;
using System.IO;
using System.Diagnostics;
using Essence.Core.IO;
using System.Runtime.InteropServices;
using static System.Net.Mime.MediaTypeNames;
using SixLabors.ImageSharp;
using Image = SixLabors.ImageSharp.Image;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using DotNetEnv;
using System.Reflection;
using SixLabors.ImageSharp.Processing;
using System.Runtime.CompilerServices;
using SixLabors.ImageSharp.Formats.Pbm;

namespace CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.GenerateScenarioPreviewImages
{
    internal class GenerateScenarioPreviewImages
    {
        static readonly Dictionary<string, string> ScenarioIconsFilenameMap = new Dictionary<string, string>
        {
            {"territory_point",  "Icons_symbols_flag_null_symbol" },
            {"territory_point_command",  "Icons_symbols_flag_null_symbol" },
            { "territory_point_mp", "Icons_symbols_flag_null_symbol" },
            { "starting_position_shared_territory__1000", "Icons_minimap_mm_starting_point_1" },
            { "starting_position_shared_territory__1001", "Icons_minimap_mm_starting_point_2" },
            { "starting_position_shared_territory__1002", "Icons_minimap_mm_starting_point_3" },
            { "starting_position_shared_territory__1003", "Icons_minimap_mm_starting_point_4" },
            { "starting_position_shared_territory__1004", "Icons_minimap_mm_starting_point_5" },
            { "starting_position_shared_territory__1005", "Icons_minimap_mm_starting_point_6" },
            { "starting_position_shared_territory__1006", "Icons_minimap_mm_starting_point_7" },
            { "starting_position_shared_territory__1007", "Icons_minimap_mm_starting_point_8" },

            { "starting_position_sp__1000", "Icons_minimap_mm_starting_point_1" },
            { "starting_position_sp__1001", "Icons_minimap_mm_starting_point_2" },
            { "starting_position_sp__1002", "Icons_minimap_mm_starting_point_3" },
            { "starting_position_sp__1003", "Icons_minimap_mm_starting_point_4" },
            { "starting_position_sp__1004", "Icons_minimap_mm_starting_point_5" },
            { "starting_position_sp__1005", "Icons_minimap_mm_starting_point_6" },
            { "starting_position_sp__1006", "Icons_minimap_mm_starting_point_7" },
            { "starting_position_sp__1007", "Icons_minimap_mm_starting_point_8" },

            { "starting_position__1000", "Icons_minimap_mm_starting_point_1" },
            { "starting_position__1001", "Icons_minimap_mm_starting_point_2" },
            { "starting_position__1002", "Icons_minimap_mm_starting_point_3" },
            { "starting_position__1003", "Icons_minimap_mm_starting_point_4" },
            { "starting_position__1004", "Icons_minimap_mm_starting_point_5" },
            { "starting_position__1005", "Icons_minimap_mm_starting_point_6" },
            { "starting_position__1006", "Icons_minimap_mm_starting_point_7" },
            { "starting_position__1007", "Icons_minimap_mm_starting_point_8" },

            { "victory_point", "Icons_symbols_flag_victory_symbol" },
            { "victory_point_no_swap", "Icons_symbols_flag_victory_symbol" },
            { "victory_point_no_ticker", "Icons_symbols_flag_victory_symbol" },

            { "territory_munitions_point", "Icons_symbols_building_common_munitions_symbol" },
            { "territory_munitions_point_mp", "Icons_symbols_building_common_munitions_symbol" },
            { "tow_kalach_munitions_point", "Icons_symbols_building_common_munitions_symbol" },

            { "territory_fuel_point", "Icons_symbols_flag_fuel_symbol" },
            { "territory_fuel_point_mp", "Icons_symbols_flag_fuel_symbol" },
            { "tow_kalach_fuel_point", "Icons_symbols_flag_fuel_symbol" },

            { "support_bay", "Icons_symbols_building_common_support_bay_symbol" },
            { "military_hospital", "Icons_symbols_building_common_support_bay_symbol" },
            { "m10_military_hospital", "Icons_symbols_building_common_support_bay_symbol" },

            { "tow_kalach_radio_tower", "Icons_resources_minimap_icon_radiotower" },
            { "radio_tower_point_occupation", "Icons_resources_minimap_icon_radiotower" },
            { "radio_tower_point_mp", "Icons_resources_minimap_icon_radiotower" },
            { "radio_antenna", "Icons_resources_minimap_icon_radiotower" },
            { "radio_antenna_no_abilities", "Icons_resources_minimap_icon_radiotower" },

            { "watchtower", "Icons_symbols_building_common_guard_tower_symbol" },
            { "tow_kalach_watchtower", "Icons_symbols_building_common_guard_tower_symbol" },
        };

        enum ScenarioIconExclusionRule
        {
            All,
            Neutral,
        }
        /// <summary>
        /// Conditional mapping of entities to ignore. Consists of entity name and ownership.
        /// </summary>
        static readonly Dictionary<string, ScenarioIconExclusionRule> ScenarioIconsFilenameMapExcludes = new Dictionary<string, ScenarioIconExclusionRule>
        {
            // Some maps have neutral starting positions
            { "starting_position", ScenarioIconExclusionRule.Neutral },
            { "starting_position_sp", ScenarioIconExclusionRule.Neutral },
            { "starting_position_shared_territory", ScenarioIconExclusionRule.Neutral },
            // Ignore invisible territory points
            { "territory_point_invisible", ScenarioIconExclusionRule.All },
            { "territory_point_invisible_command", ScenarioIconExclusionRule.All },
        };

        /// <summary>
        /// Entities that should never be suffixed with its owner id.
        /// Some maps may technically contain player-owned strategic points. We don't have numbered icons for those.
        /// For example "starting_position" will be suffixed with its owner, 
        /// and e.g. with ownership of player 1 it becomes "starting_position__1000". This is mapped to the starting position icon with number 1.
        /// </summary>
        static readonly string[] ScenarioIconNoOwnerVariant = new string[]
        {
            "territory_point", "territory_point_command", "territory_point_mp",

            "victory_point", "victory_point_no_swap", "victory_point_no_ticker",

            "territory_munitions_point", "territory_munitions_point_mp", "tow_kalach_munitions_point",

            "territory_fuel_point", "territory_fuel_point_mp", "tow_kalach_fuel_point",

            "radio_tower_point_occupation",

            "support_bay", "military_hospital", "m10_military_hospital",

            "radio_antenna", "radio_antenna_no_abilities",

            "watchtower", "tow_kalach_watchtower",
        };

        /// <summary>
        /// List of archives from which scenarios should never be loaded from. 
        /// Mostly Theater of War or Single Player maps.
        /// </summary>
        static readonly string[] ExcludeArchives = new string[]
        {
            "DLC1Scenarios.sga",
            "DLC2Scenarios.sga",
            "DLC3Scenarios.sga",
            "SPScenariosAA.sga",
            "SPScenariosEF.sga",
            "TOWScenarios.sga",
        };

        /// <summary>
        /// Runtime cache of scenario icon Image instances.
        /// </summary>
        private Dictionary<string, Image> ScenarioIconCache = new Dictionary<string, Image>();

        public static string StartupRootPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);

        public string GameArchivesRootPath { get; private set; }
        public string[] ScenarioPreviewImageCandidates { get; private set; }
        public string ScenarioPreviewImageIconsRootPath { get; private set; }
        public string ScenarioPreviewImageOutputRootPath { get; private set; }
        public string[] ExcludedArchiveNames { get; private set; }

        public bool LoadScenarioIconsInfo { get; private set; }
        static JpegEncoder JpegEncoder = new JpegEncoder()
        {
            Quality = 75,
        };
        static PngEncoder PngEncoder = new PngEncoder();

        public GenerateScenarioPreviewImages(string envSuffix)
        {
            GameArchivesRootPath = Env.GetString($"{envSuffix}_GAME_ARCHIVES_ROOT_PATH");
            ScenarioPreviewImageIconsRootPath = Path.Combine(StartupRootPath, Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_ICONS_RELATIVE_PATH"));
            ScenarioPreviewImageOutputRootPath = Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_OUTPUT_ROOT_PATH");
            ExcludedArchiveNames = Env.GetString($"{envSuffix}_EXCLUDED_ARCHIVE_FILE_NAMES").Split(',');
            ScenarioPreviewImageCandidates = Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_CANDIDATES").Split(',');
            LoadScenarioIconsInfo = Env.GetBool($"{envSuffix}_LOAD_SCENARIO_ICONS_INFO");

            if (GameArchivesRootPath == null || GameArchivesRootPath.Length == 0 || !Directory.Exists(GameArchivesRootPath))
            {
                throw new ArgumentException($"Invalid gameArchivesRootPath: Path \"{GameArchivesRootPath}\" doesn't exist for env suffix ${envSuffix}");
            }


        }
        public void Run()
        {
            if (Directory.Exists(ScenarioPreviewImageOutputRootPath))
                Directory.Delete(ScenarioPreviewImageOutputRootPath, true);
            Directory.CreateDirectory(ScenarioPreviewImageOutputRootPath);

            foreach (var archiveFilePath in Directory.GetFiles(GameArchivesRootPath, "*.sga", SearchOption.AllDirectories))
            {
                if (ExcludedArchiveNames.Contains(Path.GetFileName(archiveFilePath)))
                {
                    continue;
                }

                Debug.WriteLine(archiveFilePath);
                var scenarioFolders = getScenarioFolders(new Archive(archiveFilePath));
                foreach (var scenarioFolder in scenarioFolders)
                {
                    Debug.WriteLine(scenarioFolder.ScenarioName);

                    RenderPreviewImage(scenarioFolder);
                }
            }
        }

        private void RenderPreviewImage(ScenarioFolder scenario)
        {
            var outputImageFilePath = Path.Combine(ScenarioPreviewImageOutputRootPath, $"{scenario.ScenarioName}.{scenario.ScenarioId}.jpg");
            var outputImageFilePathLossless = Path.Combine(ScenarioPreviewImageOutputRootPath, $"{scenario.ScenarioName}.{scenario.ScenarioId}.png");
            var basePreviewImage = scenario.GetPreviewImageData();
            // Maximum width of Discord embed image
            var targetWidth = 300;
            var targetHeight = 300;

            if (basePreviewImage.Width > targetWidth && basePreviewImage.Height > targetHeight)
            {
                basePreviewImage.Mutate(_ => _
                    .Resize(new ResizeOptions()
                    {
                        Mode = ResizeMode.Max,
                        Size = new Size(targetWidth, targetHeight)
                    })
                );
            }


            var iconOverlayScale = basePreviewImage.Width * 1.0 / Math.Max(scenario.ScenarioWidth, scenario.ScenarioHeight);
            var xScale = basePreviewImage.Width * 1.0 / scenario.ScenarioWidth;
            var yScale = basePreviewImage.Height * 1.0 / scenario.ScenarioHeight;

            var scenarioWidthMin = 1 - (scenario.ScenarioWidth / 2);
            var scenarioWidthMax = scenario.ScenarioWidth / 2;
            var scenarioHeightMin = 1 - (scenario.ScenarioHeight / 2);
            var scenarioHeightMax = scenario.ScenarioHeight / 2;

            var imageWidthMin = 1 - (basePreviewImage.Width / 2.0);
            var imageWidthMax = basePreviewImage.Width / 2.0;
            var imageHeightMin = 1 - (basePreviewImage.Height / 2.0);
            var imageHeightMax = basePreviewImage.Height / 2.0;

            foreach (var icon in scenario.Icons)
            {
                if (
                        ScenarioIconsFilenameMapExcludes.ContainsKey(icon.EbpName) && (
                        // global ignore; No comparison
                        ScenarioIconsFilenameMapExcludes[icon.EbpName] == ScenarioIconExclusionRule.All ||
                        // Ignore neutral
                        (ScenarioIconsFilenameMapExcludes[icon.EbpName] == ScenarioIconExclusionRule.Neutral && icon.OwnerId == 0)
                    )
                )
                {
                    // $"Ignoring icon {icon.EbpName} for {scenario.ScenarioName} in {scenario.Folder.Archive}");
                    continue;
                }

                var iconImage = GetScenarioIconImage(icon);
                var x = (basePreviewImage.Width / 2.0) + scale(icon.X * iconOverlayScale / xScale, scenarioWidthMin, scenarioWidthMax, imageWidthMin, imageWidthMax) - iconImage.Width / 2.0;
                var y = (basePreviewImage.Height / 2.0) + scale(flip(icon.Y) * iconOverlayScale / yScale, scenarioHeightMin, scenarioHeightMax, imageHeightMin, imageHeightMax) - iconImage.Height / 2.0;

                basePreviewImage.Mutate(_ => _
                    .DrawImage(iconImage, location: new SixLabors.ImageSharp.Point(Convert.ToInt32(x), Convert.ToInt32(y)), opacity: 1.0f)
                );

            }
            basePreviewImage.Save(outputImageFilePathLossless, PngEncoder);
            // basePreviewImage.Save(outputImageFilePath, JpegEncoder);
        }

        private Image GetScenarioIconImage(ScenarioFolder.ScenarioIcon icon)
        {
            var iconKey = icon.EbpName;
            if (icon.OwnerId != 0 && !ScenarioIconNoOwnerVariant.Contains(icon.EbpName))
            {
                iconKey = $"{iconKey}__{icon.OwnerId}";
            }
            iconKey = Path.Combine(ScenarioPreviewImageIconsRootPath, $"{ScenarioIconsFilenameMap[iconKey]}.png");

            if (!ScenarioIconCache.ContainsKey(iconKey))
            {
                var image = SixLabors.ImageSharp.Image.Load(iconKey); ;
                ScenarioIconCache[iconKey] = image;
                if (image.Width > 24 && image.Height > 24)
                {
                    image.Mutate(_ => _
                        .Resize(24, 24)
                    );
                }
            }

            return ScenarioIconCache[iconKey];
        }
        private static double scale(double value, double fromMin, double fromMax, double toMin, double toMax)
        {
            return (value - fromMin) * (toMax - toMin) / (fromMax - fromMin) + toMin;
        }

        private static double flip(double number) => number < 0 ? Math.Abs(number) : 0 - number;

        private IEnumerable<ScenarioFolder> getScenarioFolders(INode root)
        {
            var result = new List<ScenarioFolder>();
            Action<INode> iterator = null;
            iterator = (INode node) =>
            {
                if (node.Name.EndsWith(".sgb"))
                {
                    try
                    {
                        var scenarioFolder = new ScenarioFolder(node as ArchiveFile, ScenarioPreviewImageCandidates, LoadScenarioIconsInfo);
                        result.Add(scenarioFolder);
                    }
                    catch (ScenarioFolder.MissingInfoFileException)
                    {
                        Debug.WriteLine($"[warning] Map {node.Name} in {node.Archive} does not have an info file.");
                    }
                    catch (ScenarioFolder.InvalidInfoFileException e)
                    {
                        Debug.WriteLine($"[warning] {e.Message} {node.Name} in {node.Archive} ({e.InfoFile.Name}):\n\t{e.InnerException?.ToString()}");
                    }
                }
                else if (node.Children != null && node.Children.Count > 0)
                {
                    foreach (var childNode in node.Children)
                    {
                        iterator(childNode);
                    }
                }
            };
            iterator(root);
            return result;
        }
    }
}
