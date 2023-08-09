using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Archive = Essence.Core.IO.Archive.Archive;
using ArchiveFolder = Essence.Core.IO.Archive.Folder;
using ArchiveFile = Essence.Core.IO.Archive.File;
using System.IO;
using LuaInterface;
using System.Security.Cryptography;
using System.Diagnostics;
using SixLabors.ImageSharp;
using DotNetEnv;

namespace CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.GenerateScenarioPreviewImages
{
    internal class ScenarioFolder
    {
        public class MissingInfoFileException : Exception { }
        public class MissingPreviewImageFileException : Exception { }
        public class InvalidInfoFileException : Exception
        {
            public ArchiveFile InfoFile { get; private set; }
            public InvalidInfoFileException(string message, Exception inner, ArchiveFile infoFile): base(message, inner)
            {
                InfoFile = infoFile;
            }

            public InvalidInfoFileException(string message, ArchiveFile infoFile) : base(message)
            {
                InfoFile = infoFile;
            }
        }

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

            public ScenarioIcon(LuaTable data) : this()
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

        public string ScenarioName { get; private set; }
        public ArchiveFolder Folder { get; private set; }
        public ArchiveFile InfoFile { get; private set; }
        public ArchiveFile PreviewImageFile { get; private set; }

        public double ScenarioWidth { get; private set; }
        public double ScenarioHeight { get; private set; }
        public ScenarioIcon[] Icons { get; private set; }

        public string NormalizedScenarioFilepath { get; private set; }
        public string ScenarioId { get; private set; }

        private static MD5 ScenarioIdHasher = MD5.Create();

        public ScenarioFolder(ArchiveFile scenarioFile, string[] scenarioPreviewImageCandidates, bool loadIcons)
        {

            ScenarioName = Path.GetFileNameWithoutExtension(scenarioFile.Name);
            NormalizedScenarioFilepath = Path.GetFileNameWithoutExtension(scenarioFile.FullName)
                .ToLower()
                .Replace("data:", "")
                .Replace("\\", "/")
                .Trim('/')
            ;
            ScenarioId = BitConverter.ToString(ScenarioIdHasher.ComputeHash(Encoding.ASCII.GetBytes(NormalizedScenarioFilepath)))
                .ToLower()
                .Replace("-", "")
            ;
            Debug.WriteLine($"{NormalizedScenarioFilepath}\n\t{ScenarioId}\n");
            Folder = scenarioFile.Parent as ArchiveFolder;
            InfoFile = Folder.Children.FirstOrDefault(file => file.Name == $"{ScenarioName}.info") as ArchiveFile;

            foreach (var candidateTemplate in scenarioPreviewImageCandidates)
            {
                var candidateFile = Folder.Children.FirstOrDefault(file => file.Name == String.Format(candidateTemplate, ScenarioName));
                if (candidateFile != null)
                {
                    PreviewImageFile = candidateFile as ArchiveFile;
                    break;
                }
            }
            if (PreviewImageFile == null)
            {
                throw new MissingPreviewImageFileException();
            }

            var icons = new List<ScenarioIcon>();
            if (loadIcons)
            {
                var lua = new Lua();
                if (InfoFile == null)
                {
                    throw new MissingInfoFileException();
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
                        throw new InvalidInfoFileException($"{InfoFile.Name} in {Folder.Archive} info file does not have any point_positions.", InfoFile);
                    }
                    else
                    {
                        foreach (var point in point_positions.Values)
                        {
                            icons.Add(new ScenarioIcon(point as LuaTable));
                        }
                    }

                }
                catch (LuaException execption)
                {
                    throw new InvalidInfoFileException($"{InfoFile.Name} lua parsing failed", execption, InfoFile);
                }
            }
            Icons = icons.ToArray();
        }

        public Image GetPreviewImageData()
        {
            var rawImageData = PreviewImageFile.GetData();
            var tgaDecoder = new SixLabors.ImageSharp.Formats.Tga.TgaDecoder();
            var extension = Path.GetExtension(PreviewImageFile.Name);

            if (extension == ".rgt")
            {
                var tempRgtFilepath = Path.Combine(Path.GetTempPath(), PreviewImageFile.Name);
                File.WriteAllBytes(tempRgtFilepath, rawImageData);
                var outputFilepath = RGTConverter.ConvertRGT(Env.GetString("COH2_MODDING_TOOLS_ROOT_PATH"), tempRgtFilepath, Path.GetTempPath());
                var image = Image.Load(outputFilepath, tgaDecoder);
                File.Delete(outputFilepath);
                return image;
            } else if (extension == ".tga")
            {
                return Image.Load(rawImageData, new SixLabors.ImageSharp.Formats.Tga.TgaDecoder());
            } else
            {
                throw new ArgumentException($"Unsupported image type {extension} ({PreviewImageFile.Name})");
            }
        }
    }
}
