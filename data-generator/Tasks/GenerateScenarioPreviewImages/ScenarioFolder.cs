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
using Essence.Core.IO;
using Essence.Core;
using static CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.GenerateScenarioPreviewImages.ScenarioFolder;
using System.IO.Compression;
using BCnEncoder.Decoder;
using BCnEncoder;
using BCnEncoder.Shared;

namespace CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.GenerateScenarioPreviewImages
{
    internal class ScenarioFolder
    {
        public class MissingInfoFileException : FileNotFoundException {
            public MissingInfoFileException(string filename): base("", filename) { }
        }
        public class MissingPreviewImageFileException : FileNotFoundException
        {
            public MissingPreviewImageFileException(string filename) : base("", filename) {} 
        }
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

        public uint PlayerCount { get; private set; } = 0;

        private static MD5 ScenarioIdHasher = MD5.Create();

        public string PreviewImageSourceRootPath { get; private set; }
        public ScenarioFolder(ArchiveFile scenarioFile, string[] scenarioPreviewImageCandidates, bool loadInfo, string previewImageSourceRootPath)
        {

            ScenarioName = Path.GetFileNameWithoutExtension(scenarioFile.Name);
            NormalizedScenarioFilepath = Path.Combine(Path.GetDirectoryName(scenarioFile.FullName), Path.GetFileNameWithoutExtension(scenarioFile.FullName))
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
            var infoFilename = $"{ScenarioName}.info";
            InfoFile = Folder.Children.FirstOrDefault(file => file.Name == infoFilename) as ArchiveFile;

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
                throw new MissingPreviewImageFileException(String.Join(", ", scenarioPreviewImageCandidates));
            }

            var icons = new List<ScenarioIcon>();
            if (loadInfo)
            {
                var lua = new Lua();
                if (InfoFile == null)
                {
                    throw new MissingInfoFileException(infoFilename);
                }

                var infoLuaCode = Encoding.UTF8.GetString(InfoFile.GetData());
                try
                {
                    lua.DoString(infoLuaCode);
                    if (lua["HeaderInfo.ScenarioDescription"] == null && lua["HeaderInfo.scenariodescription"] == null)
                    {
                        throw new InvalidInfoFileException("Missing HeaderInfo.ScenarioDescription (likely an internal map)", InfoFile);
                    }
                    var mapsize = (lua["HeaderInfo.mapsize"] as LuaTable).GetEnumerator();
                    mapsize.MoveNext();
                    ScenarioWidth = double.Parse((mapsize.Current as System.Collections.DictionaryEntry?).Value.Value.ToString());
                    mapsize.MoveNext();
                    ScenarioHeight = double.Parse((mapsize.Current as System.Collections.DictionaryEntry?).Value.Value.ToString());


                    var point_positions = lua["HeaderInfo.point_positions"] as LuaTable;
                    if (point_positions == null)
                    {
                        throw new InvalidInfoFileException($"Missing HeaderInfo.point_positions", InfoFile);
                    }
                    else
                    {
                        foreach (var point in point_positions.Values)
                        {
                            var icon = new ScenarioIcon(point as LuaTable);
                            icons.Add(icon);

                            if (icon.EbpName == "starting_position" && icon.OwnerId != 0)
                            {
                                PlayerCount++;
                            }
                        }
                    }

                }
                catch (LuaException execption)
                {
                    throw new InvalidInfoFileException($"{InfoFile.Name} lua parsing failed", execption, InfoFile);
                }
            }
            Icons = icons.ToArray();

            PreviewImageSourceRootPath = previewImageSourceRootPath;
        }

        public struct Block
        {
            public uint DataSizeUncompressed;
            public uint DataSizeCompressed;
            public Block(uint dataSizeUncompressed, uint dataSizeCompressed)
            {
                DataSizeUncompressed = dataSizeUncompressed;
                DataSizeCompressed = dataSizeCompressed;
            }
        }

        private static FourCC DATA_TMAN = FourCC.Parse("TMAN");
        private static FourCC DATA_TDAT = FourCC.Parse("TDAT");
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
            }
            else if (extension == ".tga")
            {
                return Image.Load(rawImageData, new SixLabors.ImageSharp.Formats.Tga.TgaDecoder());
            }
            else if (extension == ".rrtex")
            {
                if (PreviewImageSourceRootPath != null)
                {
                    var sourceFilePath = Path.Combine(PreviewImageSourceRootPath, $"{Path.GetFileNameWithoutExtension(PreviewImageFile.Name)}.tga");
                    if (!File.Exists(sourceFilePath))
                    {
                        throw new FileNotFoundException(sourceFilePath);
                    }

                    return Image.Load(sourceFilePath, new SixLabors.ImageSharp.Formats.Tga.TgaDecoder());
                }
                if (false)
                {
                    using (var stream = new MemoryStream(rawImageData))
                    using (var reader = new ChunkyReader(stream))
                    {
                        reader.PushFolderChunk(FourCC.Parse("TSET"), 1u);
                        reader.PushDataChunk(FourCC.Parse("DATA"), 4u);
                        reader.PopChunk();

                        reader.PushFolderChunk(FourCC.Parse("TXTR"), 2u);
                        reader.PushFolderChunk(FourCC.Parse("DXTC"), 6u);
                        reader.PushDataChunk(DATA_TMAN, 2);

                        var __unknown_01 = reader.ReadUInt32();
                        var width = reader.ReadUInt32();
                        var height = reader.ReadUInt32();
                        var __unknown_02 = reader.ReadUInt32();
                        var __unknown_03 = reader.ReadUInt32();
                        var compression = reader.ReadUInt32();

                        var mipCount = reader.ReadInt32();
                        var unknown4 = reader.ReadInt32();


                        if (__unknown_01 >= 6)
                        {
                            // New struct fields in version 6
                            byte unknown5 = reader.ReadByte();
                            int unknown6 = reader.ReadInt32();
                        }

                        int[] mipTextureCounts = new int[mipCount];
                        for (int i = 0; i < mipCount; i++)
                        {
                            mipTextureCounts[i] = reader.ReadInt32();
                        }

                        int[][] sizeCompressed = new int[mipCount][];
                        int[][] sizeUncompressed = new int[mipCount][];

                        for (int i = 0; i < mipCount; i++)
                        {
                            int textureChunkCount = mipTextureCounts[i];
                            sizeUncompressed[i] = new int[textureChunkCount];
                            sizeCompressed[i] = new int[textureChunkCount];
                            for (int j = 0; j < textureChunkCount; j++)
                            {
                                sizeUncompressed[i][j] = reader.ReadInt32();
                                sizeCompressed[i][j] = reader.ReadInt32();
                            }
                        }

                        if (compression != 28)
                        {
                            throw new Exception($"Unsupported compression type ${compression}");
                        }

                        reader.PopChunk();

                        var tdat = reader.PushDataChunk(DATA_TDAT, 1u);
                        var tdatData = reader.ReadBytes((int)tdat.Size);
                    }
                }
                // Dummy
                throw new ArgumentException($"Unsupported image type {extension} ({PreviewImageFile.Name})");
            }
            else
            {
                throw new ArgumentException($"Unsupported image type {extension} ({PreviewImageFile.Name})");
            }
        }
    }
}
