using RelicCore.Archive;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace COH2ReplayDiscordBotMapImageExtractor
{
    class Program
    {
        /// <summary>
        /// List of possible candiates for scenario preview image in the order of importance (first available will be used).
        /// </summary>
        static readonly string[] ScenarioPreviewImageCandidates = new string[]
        {
            "{0}_mm_preview.tga",
            "{0}_mm_preview_high.tga",
            "{0}_mm_preview_low.tga",
            "{0}_mm.tga",
        };

        static void Main(string[] args)
        {
            if (args.Length < 2)
            {
                Console.WriteLine("Please provide Company of Heroes 2 installation path as the first argument.");
                Console.WriteLine("Please provide map preview image destination directory path as the second argument.");
                return;
            }

            var coh2RootPath = args[0];
            var mapPreviewImageRoot = Path.GetFullPath(args[1]);
            var archives = Directory.GetFiles(Path.Join(coh2RootPath, "CoH2", "Archives"), "*.sga", SearchOption.AllDirectories);

            var noScenarioRootArchives = new List<Archive>();
            var noPreviewImageFoundScenarios = new List<ScenarioFolder>();
            var jpgEncoder = new JpegEncoder()
            {
                Quality = 75,
            };

            foreach (var filename in archives)
            {
                var archive = new Archive(filename);
                var scenariosRoot = getScenariosRoot(archive);
                if (scenariosRoot == null)
                {
                    noScenarioRootArchives.Add(archive);
                    continue;
                }

                var scenarioFolders = getScenarioFolders(scenariosRoot);
                foreach (var scenario in scenarioFolders)
                {
                    var preview = getScenarioPreviewImage(scenario);
                    if (preview == null)
                    {
                        noPreviewImageFoundScenarios.Add(scenario);
                        continue;
                    }

                    var imageFilename = Path.Join(mapPreviewImageRoot, $"{scenario.ScenarioName}.jpg");
                    var image = SixLabors.ImageSharp.Image.Load(preview.GetData());
                    if (image.Width >= 256 && image.Height >= 256)
                    {
                        image.Mutate(x => x
                            .Resize(256, 256)
                        );
                    }
                    image.Save(imageFilename, jpgEncoder);
                    Console.WriteLine($"{scenario.ScenarioName}: {preview.Name}");
                }
            }

            foreach (var ignoredArchive in noScenarioRootArchives)
            {
                Console.WriteLine($"Ignored achive {ignoredArchive.Name}: No scenario root folder found.");
            }

            foreach (var scenario in noPreviewImageFoundScenarios)
            {
                Console.WriteLine($"Ignored scenario {scenario.ScenarioName} in {scenario.Folder.Archive.Name}: No preview image found.");
            }

            Console.WriteLine("Press enter to exit.");
            Console.ReadLine();
        }

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

        class ScenarioFolder
        {
            public string ScenarioName { get; set; }
            public RelicCore.Archive.Folder Folder { get; set; }
        }

        private static IEnumerable<ScenarioFolder> getScenarioFolders(INode root)
        {
            var result = new List<ScenarioFolder>();
            Action<INode> iterator = null;
            iterator = (INode node) =>
            {
                if (node.Name.EndsWith(".sgb"))
                {
                    result.Add(new ScenarioFolder
                    {
                        ScenarioName = Path.GetFileNameWithoutExtension(node.Name),
                        Folder = node.Parent as RelicCore.Archive.Folder,
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
    }
}
