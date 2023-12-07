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
using System.Xml.Linq;
using System.Text.RegularExpressions;
using System.Globalization;

namespace CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.GenerateScenarioPreviewImages
{
    internal class GenerateScenarioPreviewImages
    {
        public List<ScenarioFolder> ScenarioFolders { get; } = new List<ScenarioFolder>();

        public Dictionary<string, string> ScenarioIconsFilenameMap { get; private set; }
        public Dictionary<string, string> ScenarioPreviewImageIconExclusions { get; private set; }

        /// <summary>
        /// Runtime cache of scenario icon Image instances.
        /// </summary>
        private Dictionary<string, Image> ScenarioIconCache = new Dictionary<string, Image>();

        public string GameArchivesRootPath { get; private set; }
        public string[] ScenarioPreviewImageCandidates { get; private set; }
        public string ScenarioPreviewImageIconsRootPath { get; private set; }
        public string ScenarioPreviewImageOutputRootPath { get; private set; }
        public string[] ExcludedArchiveNames { get; private set; }
        public string[] ScenarioFileExtensions { get; private set; }
        public string PreviewImageSourceRootPath { get; private set; }

        public string[] SuffixPreviewImageIconNameWithOwner { get; private set; }
        public string[] SuffixPreviewImageIconNameWithPlayerCount { get; private set; }
        public string CustomScenariosRootPath { get; private set; }

        public bool LoadScenarioIconsInfo { get; private set; }
        static JpegEncoder JpegEncoder = new JpegEncoder()
        {
            Quality = 75,
        };
        static PngEncoder PngEncoder = new PngEncoder();

        public GenerateScenarioPreviewImages(string envSuffix)
        {
            GameArchivesRootPath = Env.GetString($"{envSuffix}_GAME_ARCHIVES_ROOT_PATH");
            LoadScenarioIconsInfo = Env.GetBool($"{envSuffix}_LOAD_SCENARIO_ICONS_INFO");
            ScenarioFileExtensions = Env.GetString($"{envSuffix}_SCENARIO_FILE_EXTENSION").Split(',');

            ScenarioPreviewImageIconsRootPath = Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_ICONS_ROOT_PATH");
            if (ScenarioPreviewImageIconsRootPath == null && LoadScenarioIconsInfo)
            {
                throw new ApplicationException($"environment variable {envSuffix}_SCENARIO_PREVIEW_IMAGE_ICONS_ROOT_PATH must be set when {envSuffix}_LOAD_SCENARIO_ICONS_INFO is enabled");
            }

            ScenarioPreviewImageOutputRootPath = Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_OUTPUT_ROOT_PATH");
            ExcludedArchiveNames = Env.GetString($"{envSuffix}_EXCLUDED_ARCHIVE_FILE_NAMES", fallback: "").Split(',');
            ScenarioPreviewImageCandidates = Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_CANDIDATES", fallback: "").Split(',');

            if (GameArchivesRootPath == null || GameArchivesRootPath.Length == 0 || !Directory.Exists(GameArchivesRootPath))
            {
                throw new ArgumentException($"Invalid gameArchivesRootPath: Path \"{GameArchivesRootPath}\" doesn't exist for env suffix ${envSuffix}");
            }

            PreviewImageSourceRootPath = Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_SOURCE_ROOT_PATH", fallback: null);
            ScenarioIconsFilenameMap = parseEnvDictionary(Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_ENTITY_ICONS"));

            ScenarioPreviewImageIconExclusions = parseEnvDictionary(Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_ICON_EXCLUSIONS", fallback: ""));

            SuffixPreviewImageIconNameWithOwner = Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_ICON_SUFFIX_OWNER", fallback: "").Split(',');
            SuffixPreviewImageIconNameWithPlayerCount = Env.GetString($"{envSuffix}_SCENARIO_PREVIEW_IMAGE_ICON_SUFFIX_PLAYER_COUNT", fallback: "").Split(',');
            CustomScenariosRootPath = Env.GetString($"{envSuffix}_CUSTOM_SCENARIOS_DOWNLOAD_CACHE_ROOT_PATH", fallback: null);
        }

        private static Dictionary<string, string> parseEnvDictionary(string raw)
        {
            return raw.Trim()
                .Split('\n')
                .Select((row) => row.Trim())
                .Where((row) => row.Length > 0)
                .Select((row) => row.Split('=').Select((token) => token.Trim()))
                .ToDictionary(tokens => tokens.ElementAt(0), tokens => tokens.ElementAt(1))
            ;
        }
        public void Run()
        {
            if (Directory.Exists(ScenarioPreviewImageOutputRootPath))
                Directory.Delete(ScenarioPreviewImageOutputRootPath, true);
            Directory.CreateDirectory(ScenarioPreviewImageOutputRootPath);

            var archiveFilePaths = new List<string>();
            if (CustomScenariosRootPath != null)
            {
                archiveFilePaths.AddRange(Directory.GetFiles(CustomScenariosRootPath, "*.sga", SearchOption.AllDirectories));
            }
            archiveFilePaths.AddRange(Directory.GetFiles(GameArchivesRootPath, "*.sga", SearchOption.AllDirectories));

            var scenarioShortNameMap = new Dictionary<string, List<ScenarioFolder>>();

            foreach (var archiveFilePath in archiveFilePaths)
            {
                if (ExcludedArchiveNames.Contains(Path.GetFileName(archiveFilePath)))
                {
                    continue;
                }

                LoadScenarioFolders(new Archive(archiveFilePath));
            }
            foreach (var scenarioFolder in ScenarioFolders)
            {
                RenderPreviewImage(scenarioFolder);
                RenderPreviewImage(scenarioFolder, filenameSuffix: "colored", iconKeySuffix: "colored", iconSizeMultiplier: 1.0);
                RenderPreviewImage(scenarioFolder, filenameSuffix: "tm",      iconKeySuffix: "large",   iconSizeMultiplier: 1.0);

                if (!scenarioShortNameMap.ContainsKey(scenarioFolder.NormalizedShortName))
                {
                    scenarioShortNameMap[scenarioFolder.NormalizedShortName] = new List<ScenarioFolder>();
                }
                if (scenarioShortNameMap[scenarioFolder.NormalizedShortName].Count > 0)
                {
                    Debug.WriteLine($"[warning] duplicate scenario NormalizedShortName: {scenarioFolder.NormalizedShortName} ({String.Join(", ", scenarioShortNameMap[scenarioFolder.NormalizedShortName].Select(s => s.ReferenceName))})");
                }
                scenarioShortNameMap[scenarioFolder.NormalizedShortName].Add(scenarioFolder);
            }
        }

        private void RenderPreviewImage(ScenarioFolder scenario, string filenameSuffix = null, string iconKeySuffix = null, double iconSizeMultiplier = 1.0)
        {
            var dottedFilenameSuffix = $"{(filenameSuffix != null ? "." : "")}{filenameSuffix ?? ""}";

            var outputImageFilePath = Path.Combine(ScenarioPreviewImageOutputRootPath, $"{scenario.ScenarioName}.{scenario.ScenarioId}{dottedFilenameSuffix}.x300.jpg");
            var outputImageFilePathCompact = Path.Combine(ScenarioPreviewImageOutputRootPath, $"{scenario.ScenarioName}.{scenario.ScenarioId}{dottedFilenameSuffix}.x80.jpg");
            var outputImageFilePathLossless = Path.Combine(ScenarioPreviewImageOutputRootPath, $"{scenario.ScenarioName}.{scenario.ScenarioId}{dottedFilenameSuffix}.x300.png");
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

            var iconOverlayScale = basePreviewImage.Width * 1.0 / System.Math.Max(scenario.ScenarioWidth, scenario.ScenarioHeight);
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
                        ScenarioPreviewImageIconExclusions.ContainsKey(icon.EbpName) && (
                        // global ignore; No comparison
                        ScenarioPreviewImageIconExclusions[icon.EbpName] == "ALL" ||
                        // Ignore neutral
                        (ScenarioPreviewImageIconExclusions[icon.EbpName] == "NEUTRAL" && icon.OwnerId == 0)
                    )
                )
                {
                    // $"Ignoring icon {icon.EbpName} for {scenario.ScenarioName} in {scenario.Folder.Archive}");
                    continue;
                }

                var iconImage = GetScenarioIconImage(scenario, icon, iconKeySuffix);
                if (iconImage == null)
                {
                    continue;
                }
                if (iconSizeMultiplier != 1.0)
                { 
                    iconImage = iconImage.Clone(_ => _.Resize((int)Math.Floor(iconImage.Width * iconSizeMultiplier), (int)Math.Floor(iconImage.Height * iconSizeMultiplier)));
                }
                var x = (basePreviewImage.Width / 2.0) + scale(icon.X * iconOverlayScale / xScale, scenarioWidthMin, scenarioWidthMax, imageWidthMin, imageWidthMax) - iconImage.Width / 2.0;
                var y = (basePreviewImage.Height / 2.0) + scale(flip(icon.Y) * iconOverlayScale / yScale, scenarioHeightMin, scenarioHeightMax, imageHeightMin, imageHeightMax) - iconImage.Height / 2.0;

                basePreviewImage.Mutate(_ => _
                    .DrawImage(iconImage, location: new SixLabors.ImageSharp.Point(Convert.ToInt32(x), Convert.ToInt32(y)), opacity: 1.0f)
                );

            }

            var thumbnailx80 = basePreviewImage.CloneAs<SixLabors.ImageSharp.PixelFormats.Argb32>();
            thumbnailx80.Mutate(_ => _
                .Resize(new ResizeOptions()
                {
                    Mode = ResizeMode.Max,
                    Size = new SixLabors.ImageSharp.Size(80, 80)
                })
            );

            thumbnailx80.Save(outputImageFilePathCompact, JpegEncoder);
            basePreviewImage.Save(outputImageFilePathLossless, PngEncoder);
            basePreviewImage.Save(outputImageFilePath, JpegEncoder);
        }

        private Image GetScenarioIconImage(ScenarioFolder scenario, ScenarioFolder.ScenarioIcon icon, string iconKeySuffix = null)
        {
            var iconKey = icon.EbpName;
            if (icon.OwnerId != 0 && SuffixPreviewImageIconNameWithOwner.Any((ebpName) => ebpName == icon.EbpName))
            {
                iconKey = $"{iconKey}__{icon.OwnerId}";
            }
            if (SuffixPreviewImageIconNameWithPlayerCount.Any((ebpName) => ebpName == icon.EbpName))
            {
                iconKey = $"{iconKey}__{scenario.PlayerCount}p";
            }
            if (!ScenarioIconsFilenameMap.ContainsKey(iconKey))
            {
                Debug.WriteLine($"Missing icon for entity: {iconKey}=");
                return null;
            }
            string fallbackIconKey = null;

            if (iconKeySuffix != null)
            {
                fallbackIconKey = iconKey;
                iconKey = $"{iconKey}__{iconKeySuffix}";
            }
            if (!ScenarioIconsFilenameMap.ContainsKey(iconKey))
            {
                Debug.WriteLine($"Warning! Using fallback icon '{fallbackIconKey}' for '{iconKey}', (suffix '{iconKeySuffix}' variant not configured)");
                iconKey = fallbackIconKey;
            }
            var iconEntry = ScenarioIconsFilenameMap[iconKey];
            var iconAttributesRegexp = new Regex(@"\[(scale:\s*(?<scale>.*?))?\]");
            double scale = 1.0;
            if (iconAttributesRegexp.IsMatch(iconEntry))
            {
                scale = double.Parse(iconAttributesRegexp.Match(iconEntry).Groups["scale"].Value, CultureInfo.InvariantCulture);
                iconEntry = iconAttributesRegexp.Replace(iconEntry, "");
            }
            iconKey = Path.Combine(ScenarioPreviewImageIconsRootPath, $"{iconEntry}");

            if (!ScenarioIconCache.ContainsKey(iconKey))
            {
                var image = SixLabors.ImageSharp.Image.Load(iconKey);
                ScenarioIconCache[iconKey] = image;
                if (image.Width > 24 && image.Height > 24)
                {
                    image.Mutate(_ => _
                        .Resize(24, 24)
                    );
                }
                if (scale != 1.0)
                {
                    image.Mutate(_ => _.Resize((int)Math.Floor(image.Width * scale), (int)Math.Floor(image.Height * scale)));
                }
            }

            return ScenarioIconCache[iconKey];
        }
        private static double scale(double value, double fromMin, double fromMax, double toMin, double toMax)
        {
            return (value - fromMin) * (toMax - toMin) / (fromMax - fromMin) + toMin;
        }

        private static double flip(double number) => number < 0 ? System.Math.Abs(number) : 0 - number;

        private void LoadScenarioFolders(INode root)
        {
            ArchiveIterator.EachFile(root as Archive, (file) =>
            {
                if (ScenarioFileExtensions.Any((extension) => file.Name.EndsWith(extension)))
                {
                    try
                    {
                        var scenarioFolder = new ScenarioFolder(
                            file,
                            ScenarioPreviewImageCandidates,
                            LoadScenarioIconsInfo,
                            PreviewImageSourceRootPath,
                            ScenarioFolders
                        );
                        ScenarioFolders.Add(scenarioFolder);
                    }
                    catch (ScenarioFolder.MissingInfoFileException e)
                    {
                        Debug.WriteLine($"[warning] {file.Name} @ {file.Archive}: {e.Message}");
                    }
                    catch (ScenarioFolder.InvalidInfoFileException e)
                    {
                        Debug.WriteLine($"[warning] {file.Name} @ {file.Archive}: {e.Message}{(e.InnerException != null ? ":\n\t" : "")}{e.InnerException?.ToString()}");
                    }
                    catch (ScenarioFolder.MissingPreviewImageFileException e)
                    {
                        Debug.WriteLine($"[warning] {file.Name} @ {file.Archive}: {e.Message}");
                    }
                    catch (ScenarioFolder.DuplicatScenarioException e)
                    {
                        Debug.WriteLine($"4[warning] {file.Name} @ {file.Archive}: {e.Message}");
                    }
                }
            });
        }
    }
}
