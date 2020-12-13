using System;
using System.Collections.Generic;
using System.Text;
using System.Xml.Serialization;

namespace COH2ReplayDiscordBotDataGenerator.Attributes
{
    public class AttributeInstance
    {
        [XmlAttribute("description")]
        public string Description { get; set; }

        [XmlAttribute("template")]
        public string Template { get; set; }
    }

    public class LocStringReference
    {
        [XmlAttribute("name")]
        public string Name { get; set; }
        [XmlAttribute("value")]
        public int Value { get; set; }
    }

    public class IconReference
    {
        [XmlAttribute("name")]
        public string Name { get; set; }
        [XmlAttribute("value")]
        public string Value { get; set; }
    }

    public class UniqueId
    {
        [XmlAttribute("name")]
        public string Name { get; set; }
        [XmlAttribute("value")]
        public int Value { get; set; }
    }

    public class TemplateReference
    {
        [XmlAttribute("name")]
        public string Name { get; set; }

        [XmlAttribute("value")]
        public string Value { get; set; }

        [XmlElement("uniqueid")]
        public UniqueId UniqueId { get; set; }
    }

}
