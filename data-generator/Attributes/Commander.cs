using System;
using System.Collections.Generic;
using System.Text;
using System.Xml.Serialization;

namespace COH2ReplayDiscordBotDataGenerator.Attributes
{
    [XmlRoot("instance")]
    public class Commander : AttributeInstance
    {
        public class CommanderBag
        {
            [XmlElement("locstring")]
            public List<LocStringReference> LocStrings { get; set; }

            [XmlElement("icon")]
            public List<IconReference> Icons { get; set; }

            [XmlElement("template_reference")]
            public List<TemplateReference> Templates { get; set; }
        }

        [XmlElement("group")]
        public CommanderBag Data { get; set; }
    }
}
