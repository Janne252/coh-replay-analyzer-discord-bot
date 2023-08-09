using CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.GenerateScenarioPreviewImages;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using DotNetEnv;
using System.IO;
using System.Reflection;

namespace CoHReplayAnalyzerDiscordBotDataGenerator
{
    internal class Program
    {

        static void Main(string[] args)
        {
            System.Threading.Thread.CurrentThread.CurrentUICulture = new System.Globalization.CultureInfo("en-US");

            DotNetEnv.Env.Load();
            // GenerateScenarioPreviewImages.Run(Env.GetString("COH1_GAME_ARCHIVES_ROOT_PATH"));
            new GenerateScenarioPreviewImages("COH1").Run();
            // new GenerateScenarioPreviewImages("COH2").Run();
            // GenerateScenarioPreviewImages.Run(Env.GetString("COH3_GAME_ARCHIVES_ROOT_PATH"));
        }
    }
}
