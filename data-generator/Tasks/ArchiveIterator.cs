using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Archive = Essence.Core.IO.Archive.Archive;
using ArchiveFolder = Essence.Core.IO.Archive.Folder;
using ArchiveFile = Essence.Core.IO.Archive.File;
using Essence.Core.IO.Archive;

namespace CoHReplayAnalyzerDiscordBotDataGenerator.Tasks
{
    internal static class ArchiveIterator
    {
        public static void EachFile(Archive archive, Action<ArchiveFile> predicate)
        {
            Action<INode> iterator = null;
            iterator = (INode node) =>
            {
                if (node is ArchiveFile)
                {
                    predicate(node as ArchiveFile);
                }
                if (node.Children != null && node.Children.Count > 0)
                {
                    foreach (var childNode in node.Children)
                    {
                        iterator(childNode);
                    }
                } 
            };
            iterator(archive);
        }
    }
}
