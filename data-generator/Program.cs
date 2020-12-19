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
        /// List of possible candidates for scenario preview image in the order of importance (first available will be used).
        /// </summary>
        static readonly string[] ScenarioPreviewImageCandidates = new string[]
        {
            "{0}_mm_preview.tga",
            "{0}_mm_preview_high.tga",
            "{0}_mm_preview_low.tga",
            "{0}_mm.tga",
        };

        /// <summary>
        /// List of runtime-resolved icon names and their matching icon file.
        /// </summary>
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
        static Dictionary<string, Image> ScenarioIconCache = new Dictionary<string, Image>();

        /// <summary>
        /// Absolute path to the directory from which the program entrypoint is located.
        /// </summary>
        public static string StartupRootPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);

        public static string CoH2GameRootPath = System.IO.File.ReadAllText(Path.Join(StartupRootPath, ".coh2.game.rootpath.local")).Trim();
        public static string CoH2ArchivesRootPath = Path.Join(CoH2GameRootPath, "CoH2", "Archives");
        public static string CoH2ModdingToolDataSourceRootPath = System.IO.File.ReadAllText(Path.Join(StartupRootPath, ".coh2.modding-tool-data.rootpath.local")).Trim();
        public static string ScenarioPreviewImageDestinationRoot = System.IO.File.ReadAllText(Path.Join(StartupRootPath, ".scenario-images.output.rootpath.local")).Trim();
        public static string CommanderIconDestinationRoot = System.IO.File.ReadAllText(Path.Join(StartupRootPath, ".commander-icons.output.rootpath.local")).Trim();
        public static string CommanderDatabaseDestinationFilepath = System.IO.File.ReadAllText(Path.Join(StartupRootPath, ".commander-database.output.rootpath.local")).Trim();
        public static string ScenarioIconsRoot = Path.Join(StartupRootPath, @"assets\icons\minimap");
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
            ExportScenarioPreviewImages();
        }


        static double scale(double value, double fromMin, double fromMax, double toMin, double toMax)
        {
            return (value - fromMin) * (toMax - toMin) / (fromMax - fromMin) + toMin;
        }

        static double Flip(double number) => number < 0 ? Math.Abs(number) : 0 - number;

        static void ExportScenarioPreviewImages()
        {
            var archives = new List<string>();

            archives.AddRange(
                Directory.GetFiles(CoH2ArchivesRootPath, "*.sga", SearchOption.AllDirectories)
            );
            archives.AddRange(
                Directory.GetFiles(CachedCustomScenariosOutputRootPath, "*.sga", SearchOption.AllDirectories)
            );
            var noScenarioRootArchives = new List<Archive>();
            var noPreviewImageFoundScenarios = new List<ScenarioFolder>();
            var jpgEncoder = new JpegEncoder()
            {
                Quality = 75,
            };
            var pngEncoder = new PngEncoder();

            if (Directory.Exists(ScenarioPreviewImageDestinationRoot))
                Directory.Delete(ScenarioPreviewImageDestinationRoot, true);

            Directory.CreateDirectory(ScenarioPreviewImageDestinationRoot);

            foreach (var filename in archives)
            {
                var archive = new Archive(filename);
                if (ExcludeArchives.Contains(Path.GetFileName(filename)))
                {
                    Output.Add($"[info] {archive.Name} excluded.");
                    continue;
                }

                var scenariosRoot = getScenariosRoot(archive);
                if (scenariosRoot == null)
                {
                    noScenarioRootArchives.Add(archive);
                    continue;
                }

                var scenarioFolders = getScenarioFolders(scenariosRoot);
                foreach (var scenario in scenarioFolders)
                {
                    //if (scenario.ScenarioName != "1941_smolensk"/* && scenario.ScenarioName != "4p_crossing_in_the_woods"*/)
                    //    continue;

                    var preview = getScenarioPreviewImage(scenario);
                    if (preview == null)
                    {
                        noPreviewImageFoundScenarios.Add(scenario);
                        continue;
                    }

                    var scenarioId = scenario.File.FullName
                        .Substring(0, scenario.File.FullName.Length - ".sgb".Length)
                        .Replace("Data:", "", StringComparison.OrdinalIgnoreCase)
                        .Replace("\\", "/")
                        .Replace("/", "-")
                        .Replace(" ", "-")
                        .Replace("_", "-")
                        .Replace(":", "")
                        .Trim('/')
                        .Trim('-')
                        .ToLower()
                    ;
                    // Normalize repeated dashes to one
                    scenarioId = Regex.Replace(scenarioId, "[\\-]+", "-");

                    var imageFilename = Path.Join(ScenarioPreviewImageDestinationRoot, $"{scenarioId}.jpg");
                    var thumbnailImageFilenamex64 = Path.Join(ScenarioPreviewImageDestinationRoot, $"{scenarioId}-x64.jpg");
                    var thumbnailImageFilenamex80 = Path.Join(ScenarioPreviewImageDestinationRoot, $"{scenarioId}-x80.jpg");
                    var horizontallyPaddedFilename = Path.Join(ScenarioPreviewImageDestinationRoot, $"{scenarioId}-padded.png");
                    var image = SixLabors.ImageSharp.Image.Load(preview.GetData());

                    var icons = scenario.GetIcons();
                    // Maximum width of Discord embed image
                    var targetWidth = 300;
                    var targetHeight = 300;

                    if (image.Width > targetWidth && image.Height > targetHeight)
                    {
                        image.Mutate(_ => _
                            .Resize(new ResizeOptions()
                            {
                                Mode = ResizeMode.Max,
                                Size = new SixLabors.ImageSharp.Size(targetWidth, targetHeight)
                            })
                        );
                    }
                    else
                    {
                        Output.Add($"Warning: Low resolution preview image: {scenario.ScenarioName} in {scenario.Folder.Archive}");
                    }

                    var iconOverlayScale = image.Width * 1.0 / Math.Max(scenario.ScenarioWidth, scenario.ScenarioHeight);
                    var xScale = image.Width * 1.0 / scenario.ScenarioWidth;
                    var yScale = image.Height * 1.0 / scenario.ScenarioHeight;

                    var scenarioWidthMin = 1 - (scenario.ScenarioWidth / 2);
                    var scenarioWidthMax = scenario.ScenarioWidth / 2;
                    var scenarioHeightMin = 1 - (scenario.ScenarioHeight / 2);
                    var scenarioHeightMax = scenario.ScenarioHeight / 2;

                    var imageWidthMin = 1 - (image.Width / 2.0);
                    var imageWidthMax = image.Width / 2.0;
                    var imageHeightMin = 1 - (image.Height / 2.0);
                    var imageHeightMax = image.Height / 2.0;

                    foreach (var icon in icons)
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
                            Output.Add($"[info] Ignoring icon {icon.EbpName} for {scenario.ScenarioName} in {scenario.Folder.Archive}");
                            continue;
                        }

                        var iconImage = getScenarioIconImage(icon);
                        var x = (image.Width / 2.0) + scale(icon.X * iconOverlayScale / xScale, scenarioWidthMin, scenarioWidthMax, imageWidthMin, imageWidthMax) - iconImage.Width / 2.0;
                        var y = (image.Height / 2.0) + scale(Flip(icon.Y) * iconOverlayScale / yScale, scenarioHeightMin, scenarioHeightMax, imageHeightMin, imageHeightMax) - iconImage.Height / 2.0;

                        try
                        {
                            image.Mutate(_ => _
                                .DrawImage(iconImage, location: new SixLabors.ImageSharp.Point(Convert.ToInt32(x), Convert.ToInt32(y)), opacity: 1.0f)
                            );
                        }
                        catch (ImageProcessingException e)
                        {
                            var b = 1;
                        }
                    }
                    /*
                    var padding = 64;
                    var horizontallyPadded = new Image<Rgba32>(image.Width + padding * 2, image.Height);
                    horizontallyPadded.Mutate(_ =>
                    {
                        _.DrawImage(image, new SixLabors.ImageSharp.Point(padding, 0), 1);
                    });
                    horizontallyPadded.Save(horizontallyPaddedFilename, pngEncoder);
                    */
                    image.Save(imageFilename, jpgEncoder);
                    var thumbnailx64 = image.Clone();
                    thumbnailx64.Mutate(_ => _
                        .Resize(new ResizeOptions()
                        {
                            Mode = ResizeMode.Max,
                            Size = new SixLabors.ImageSharp.Size(64, 64)
                        })
                    );
                    thumbnailx64.Save(thumbnailImageFilenamex64, jpgEncoder);
                    // 3rd repeat and this becomes its own method
                    var thumbnailx80 = image.Clone();
                    thumbnailx80.Mutate(_ => _
                        .Resize(new ResizeOptions()
                        {
                            Mode = ResizeMode.Max,
                            Size = new SixLabors.ImageSharp.Size(80, 80)
                        })
                    );
                    thumbnailx80.Save(thumbnailImageFilenamex80, jpgEncoder);
                    Console.WriteLine($"{scenario.ScenarioName}: {preview.Name}");
                }
            }

            foreach (var ignoredArchive in noScenarioRootArchives)
            {
                Output.Add($"[warning] Ignored archive {ignoredArchive.Name}: No scenario root folder found.");
            }

            foreach (var scenario in noPreviewImageFoundScenarios)
            {
                Output.Add($"[warning] Ignored scenario {scenario.ScenarioName} in {scenario.Folder.Archive.Name}: No preview image found.");
            }

            Console.WriteLine($"Errors:\n----------------\n");
            foreach (var error in Output)
            {
                Console.WriteLine(error);
            }
            Console.WriteLine();
            Console.WriteLine();
            Console.WriteLine("Press enter to exit.");
            Console.ReadLine();
        }

        /// <summary>
        /// Resolves an icon to an Image instance.
        /// </summary>
        /// <param name="icon"></param>
        /// <returns></returns>
        private static Image getScenarioIconImage(ScenarioFolder.ScenarioIcon icon)
        {
            var iconKey = icon.EbpName;
            if (icon.OwnerId != 0 && !ScenarioIconNoOwnerVariant.Contains(icon.EbpName))
            {
                iconKey = $"{iconKey}__{icon.OwnerId}";
            }
            iconKey = Path.Join(ScenarioIconsRoot, $"{ScenarioIconsFilenameMap[iconKey]}.png");

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

        /// <summary>
        /// Representation of a scenario folder and deserialization mapping of a scenario *.info file.
        /// </summary>
        public class ScenarioFolder
        {
            public class ScenarioIcon
            {
                public double X { get; set; }
                public double Y { get; set; }
                public int OwnerId { get; set; }
                public string EbpName { get; set; }
                public LuaTable Data { get; set; }

                public ScenarioIcon()
                {

                }

                public ScenarioIcon(LuaTable data) :this()
                {
                    Data = data;
                    foreach (var key in data.Keys)
                    {
                        var name = key.ToString();
                        var value = data[key].ToString();
                        if (name == "x")
                            X = double.Parse(value);
                        else if (name == "y")
                            Y = double.Parse(value);
                        else if (name == "owner_id")
                            OwnerId = int.Parse(value);
                        else if (name == "ebp_name")
                            EbpName = value;
                    }
                }
            }

            public RelicCore.Archive.File File { get; set; }
            public string ScenarioName { get; set; }
            public RelicCore.Archive.Folder Folder { get; set; }
            public RelicCore.Archive.File InfoFile { get; set; }
            public double ScenarioWidth { get; set; }
            public double ScenarioHeight { get; set; }

            public IEnumerable<ScenarioIcon> GetIcons()
            {
                var result = new List<ScenarioIcon>();
                var lua = new Lua();
                if (InfoFile == null)
                {
                    Output.Add($"[warning] Map {ScenarioName} in {Folder.Archive} does not have an info file.");
                    return result;
                }

                var infoLuaCode = Encoding.UTF8.GetString(InfoFile.GetData());
                try
                {
                    lua.DoString(infoLuaCode);
                    // Probably the most ridiculous piece of code I've had to write in a while.
                    // It works and does the thing, perhaps one day I'll learn how to index the LuaTable values directly.
                    var mapsize = (lua["HeaderInfo.mapsize"] as LuaTable).GetEnumerator();
                    mapsize.MoveNext();
                    ScenarioWidth = double.Parse((mapsize.Current as System.Collections.DictionaryEntry?).Value.Value.ToString());
                    mapsize.MoveNext();
                    ScenarioHeight = double.Parse((mapsize.Current as System.Collections.DictionaryEntry?).Value.Value.ToString());


                    var point_positions = lua["HeaderInfo.point_positions"] as LuaTable;
                    if (point_positions == null)
                    {
                        Output.Add($"[warning] Map {ScenarioName} in {Folder.Archive} info file does not have any point_positions.");
                    }
                    else
                    {
                        foreach (var point in point_positions.Values)
                        {
                            result.Add(new ScenarioIcon(point as LuaTable));
                        }
                    }
                }
                catch (LuaException execption)
                {
                    Output.Add($"[error] Unable to parse icons for map {ScenarioName} in {Folder.Archive} ({InfoFile.Name}):\n\t{execption}");
                }
                return result;
            }
        }


        /// <summary>
        /// Finds all parent nodes (scenario folder) in which an .sgb file is stored.
        /// </summary>
        /// <param name="root"></param>
        /// <returns></returns>
        private static IEnumerable<ScenarioFolder> getScenarioFolders(INode root)
        {
            var result = new List<ScenarioFolder>();
            Action<INode> iterator = null;
            iterator = (INode node) =>
            {
                if (node.Name.EndsWith(".sgb"))
                {
                    var scenarioName = Path.GetFileNameWithoutExtension(node.Name);
                    result.Add(new ScenarioFolder
                    {
                        ScenarioName = scenarioName,
                        File = node as RelicCore.Archive.File,
                        Folder = node.Parent as RelicCore.Archive.Folder,
                        InfoFile = node.Parent.Children.FirstOrDefault(file => file.Name == $"{scenarioName}.info") as RelicCore.Archive.File,
                    });
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

        /// <summary>
        /// Finds the most suitable preview image of a scenario.
        /// </summary>
        /// <param name="scenario"></param>
        /// <returns></returns>
        private static RelicCore.Archive.File getScenarioPreviewImage(ScenarioFolder scenario)
        {
            foreach (var candidateTemplate in ScenarioPreviewImageCandidates)
            {
                var file = scenario.Folder.Children.FirstOrDefault(node => node.Name == String.Format(candidateTemplate, scenario.ScenarioName));
                if (file != null)
                {
                    return file as RelicCore.Archive.File;
                }
            }
            return null;
        }
        /// <summary>
        /// Finds the root folder of all scenarios in an archive.
        /// </summary>
        /// <param name="archive"></param>
        /// <returns></returns>
        private static INode getScenariosRoot(Archive archive)
        {
            var root = archive.Children.FirstOrDefault(node => node.Name == "data");
            if (root == null)
                return null;

            var scenarios = root.Children.FirstOrDefault(node => node.Name == "scenarios");
            if (scenarios == null)
                return null;

            return scenarios;
        }
    }
}
