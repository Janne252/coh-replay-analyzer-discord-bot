using CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.GenerateScenarioPreviewImages;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using DotNetEnv;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.BuildLocaleDatabase;

namespace CoHReplayAnalyzerDiscordBotDataGenerator
{
    internal class Program
    {

        static void Main(string[] args)
        {
            System.Threading.Thread.CurrentThread.CurrentUICulture = new System.Globalization.CultureInfo("en-US");
            // Auto-generated environment variables
            var baseEnv = new StringBuilder();
            baseEnv.AppendLine($"ASSETS_ROOT_PATH={Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location), "assets")}");
            DotNetEnv.Env.LoadContents(baseEnv.ToString());
            DotNetEnv.Env.Load(".secrets");
            DotNetEnv.Env.Load(".env.local");
            DotNetEnv.Env.Load(".env");

            new BuildLocaleDatabase("COH1").Run();
            new BuildLocaleDatabase("COH2").Run();
            new BuildLocaleDatabase("COH3").Run();

            new GenerateScenarioPreviewImages("COH1").Run();
            new GenerateScenarioPreviewImages("COH2").Run();
            new GenerateScenarioPreviewImages("COH3").Run();

        }
    }
}
