import { BinaryReader } from "../io";

export abstract class RelicChunk {
    public children: RelicChunk[] = [];

    public get hasChildren() { return this.children.length > 0; }

    /*
    public int CountChildren(bool recursive = true)
    {
        if (Children == null || Children.Length == 0)
        {
            return 0;
        }
        var count = Children.Length;
        if (recursive)
        {
            foreach(var child in Children)
            {
                count += child.CountChildren(recursive);
            }
        }

        return count;
    }
    public virtual bool HasData => false;
    */
}

export class BaseChunk extends RelicChunk {
    public DataSize: number;
    public NameSize: number;
    public Unknown01: number;
    public Unknown02: number;
    public Name: string;
    public Data: Buffer;

    constructor(public readonly Chunky: RelicChunky, public readonly Kind: string, public readonly Type: string, public readonly Version: number, reader: BinaryReader) {
        super();
        this.DataSize = reader.ReadUInt32();
        this.NameSize = reader.ReadUInt32();
        switch (this.Chunky.Version) {
            case 3:
                this.Unknown01 = reader.ReadUInt32();
                this.Unknown02 = reader.ReadUInt32();
                break;
            case 4:
                break;
            default:
                throw new Error(`Unsupported Version ${this.Version} (expected 3 or 4)`);
        }

        this.Name = reader.readString(this.NameSize, 'ascii');
        
        if (this.Kind == "FOLD") {
            var end = reader.position + this.DataSize;
            while (reader.position < end) {
                this.children.push(BaseChunk.ReadChunk(this.Chunky, reader));
            }
        } else {
            this.ReadData(reader);
        }
    }

    protected ReadData(reader: BinaryReader) {
        this.Data = reader.read(this.DataSize);
    }

    public static ReadChunk(chunky: RelicChunky, reader: BinaryReader) {
        const kind = reader.readString(4, 'ascii');
        const type = reader.readString(4, 'ascii');
        const version = reader.ReadUInt32();
        return new BaseChunk(chunky, kind, type, version, reader);
    }
}

export class RelicChunky extends RelicChunk {
    public Name: string;
    public Magic: string;
    public Signature: number;
    public Version: number;
    public Unknown01: number;
    public DataOffset: number;
    public Unknown02: number;
    public Unknown03: number;

    /*
    public static bool IsRelicChunkyFile(Stream stream)
    {
        using (var reader = new BinaryReader(stream, Encoding.ASCII, true))
        {
            if (stream.Length < 12)
            {
                return false;
            }
            return Encoding.ASCII.GetString(reader.ReadBytes(12)) == "Relic Chunky";
        }
    }
    */
    constructor(reader: BinaryReader, name: string) {
        super();
        this.Name = name;
        
        this.Magic = reader.readString(12, 'ascii');
        this.Signature = reader.ReadUInt32();
        this.Version = reader.ReadUInt32();
        this.Unknown01 = reader.ReadUInt32();
        switch (this.Version) {
            case 3:
                this.DataOffset = reader.ReadUInt32();
                this.Unknown02 = reader.ReadUInt32();
                this.Unknown03 = reader.ReadUInt32();
                break;
            case 4:
                this.DataOffset = reader.position;
                break;
            default:
                throw new Error(`Unsupported Version: ${this.Version} (expected 3 or 4)`);
        }

        const root = BaseChunk.ReadChunk(this, reader);
        this.children.push(root);
        // If first chunk is FOLD, it's the only root chunk of the Chunky
        // Assumption, seems to hold with .scenariomarker files
        if (root.Kind !== 'FOLD') {
            while (reader.position < reader.length) {
                this.children.push(BaseChunk.ReadChunk(this, reader))
            }
        }
    }
}