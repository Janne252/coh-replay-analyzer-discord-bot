using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CoHReplayAnalyzerDiscordBotDataGenerator.Tasks.GenerateScenarioPreviewImages
{
    internal static class RGTConverter
    {
        public static string ConvertRGT(string coh2ToolsPath, string inputFilePath, string outputRootPath, bool saveToSameDirectory = false)
        {
            string resultFile = "";
            ProcessStartInfo burnExeProcessStartInfo = new ProcessStartInfo();
            burnExeProcessStartInfo.FileName = Path.Combine(coh2ToolsPath, "Burn.exe");

            string arguments = String.Format(" --game_data \"{0}\" --source \"{1}\" --dest \"{2}\" --plugin \"data-rgt to generic-image\"",
                Path.Combine(coh2ToolsPath, @"assets\data"),
                inputFilePath,
                outputRootPath.TrimEnd(Path.DirectorySeparatorChar));
            Debug.WriteLine(arguments);
            burnExeProcessStartInfo.Arguments = arguments;
            burnExeProcessStartInfo.CreateNoWindow = true;

            List<string> burnExeOutput = new List<string>();
            Process burnExeProcess = new Process();
            burnExeProcess.StartInfo = burnExeProcessStartInfo;
            burnExeProcess.StartInfo.RedirectStandardOutput = true;
            burnExeProcess.StartInfo.RedirectStandardError = true;

            burnExeProcess.OutputDataReceived += (sender, args) => burnExeOutput.Add(args.Data);

            burnExeProcess.StartInfo.UseShellExecute = false;

            burnExeProcess.Start();
            burnExeProcess.BeginOutputReadLine();
            burnExeProcess.BeginErrorReadLine();

            burnExeProcess.WaitForExit();
            int resultFileIndex = burnExeOutput.Count - 1 - 2;
            if (resultFileIndex > -1 && resultFileIndex < burnExeOutput.Count)
            {
                resultFile = burnExeOutput[resultFileIndex];
            }
            return Path.Combine(outputRootPath, $"{Path.GetFileNameWithoutExtension(inputFilePath)}.tga");
        }
    }
}
