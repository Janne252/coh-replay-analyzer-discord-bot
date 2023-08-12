using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Archive = Essence.Core.IO.Archive.Archive;
using ArchiveFolder = Essence.Core.IO.Archive.Folder;
using ArchiveFile = Essence.Core.IO.Archive.File;
using DotNetEnv;
using System.IO;
using System.Text.RegularExpressions;

namespace CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.BuildLocaleDatabase
{
    internal class BuildLocaleDatabase
    {
        public string LocalesConfig { get; private set; }
        public string LocaleDBFilePath { get; private set; }
        public string LocalizationDBOutputRootPath { get; private set; }
        public string LocaleOutputFilenameTemplate { get; private set; }
        public byte[] ArchiveDecryptionKey { get; private set; }
        public BuildLocaleDatabase(string envPrefix)
        {
            LocalesConfig = Env.GetString($"LOCALES");
            LocaleDBFilePath = Env.GetString($"{envPrefix}_LOCALIZATION_DB_FILE_PATH");
            LocalizationDBOutputRootPath = Env.GetString($"{envPrefix}_LOCALIZATION_DB_OUTPUT_ROOT_PATH");
            LocaleOutputFilenameTemplate = Env.GetString("LOCALE_OUTPUT_FILENAME");
            var archiveDecryptionKey = Env.GetString($"{envPrefix}_ARCHIVE_DECRYPTION_KEY", fallback: null);

            if (archiveDecryptionKey != null)
            {
                ArchiveDecryptionKey = archiveDecryptionKey.Split(' ').Select((hex) => Convert.ToByte(hex, 16)).ToArray();
            }
        }

        public void Run()
        {
            foreach (var locale in LocalesConfig.Split(','))
            {
                var tokens = locale.Split(':');
                var localeName = tokens[0];
                var localeKey = tokens[1];

                var localeDBFilepath = LocaleDBFilePath
                    .Replace("{localeName}", localeName)
                    .Replace("{localeKey}", localeKey)
                ;

                var outputFilename = LocaleOutputFilenameTemplate.Replace("{localeName}", localeName);

                // in archive (CoH3)
                if (localeDBFilepath.Contains("::"))
                {
                    var localeDBFilepathTokens = Regex.Split(localeDBFilepath, "::");
                    var archiveFilepath = localeDBFilepathTokens[0];
                    var inArchiveFilepath = localeDBFilepathTokens[1];

                    var archive = new Archive(archiveFilepath);
                    if (ArchiveDecryptionKey != null)
                    {
                        archive.Key = Archive.RandomizeKey(ArchiveDecryptionKey, archive.NiceName);
                    }

                    ArchiveIterator.EachFile(archive, (file) =>
                    {
                        if (file.FullName.ToLower() == inArchiveFilepath.ToLower())
                        {
                            File.WriteAllBytes(Path.Combine(LocalizationDBOutputRootPath, outputFilename), file.GetData());
                        }
                    });
                }
                else
                {
                    if (File.Exists(localeDBFilepath))
                    {
                        File.Copy(localeDBFilepath, Path.Combine(LocalizationDBOutputRootPath, outputFilename), true);
                    }
                }
            }
        }
    }
}
