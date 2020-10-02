import { BinaryReader } from "../io";

export enum ChunkType {
    Folder = 'FOLD',
    Data = 'DATA',
}

export enum ChunkParseMode {
    Strict,
    Graceful,
}

// Implementation based on Corsix' https://github.com/corsix/coh2-formats and
// Copernicus' CoH2_RGDTools (source unavailable as of 2020/10/2)
export class Chunk {
    public Version: number;
    public Type: ChunkType;
    public Kind: string;
    public DataSize: number;
    public NameSize: number;
    public Unknown01: number;
    public Unknown02: number;
    public Name: string;
    public Data: Buffer;
    public readonly MinVersion: number;
    public readonly Flags: number;
    public children: Chunk[] = [];

    public readonly IsValid: boolean;
    constructor(public readonly Chunky: RelicChunky, reader: BinaryReader, mode = ChunkParseMode.Strict) {
        this.Type = reader.readString(4, 'ascii') as ChunkType;
        this.Kind = reader.readString(4, 'ascii');
        this.IsValid = this.Type === ChunkType.Data || this.Type === ChunkType.Folder;;
        if (!this.IsValid) {
             if (mode === ChunkParseMode.Graceful) {
                // Roll back reading UInt32 x 2
                reader.position -= 8;
                return;
            }
            throw new Error(`Invalid chunk type "${this.Type}"`); 
        }

        this.Version = reader.ReadUInt32();
        this.DataSize = reader.ReadUInt32();
        this.NameSize = reader.ReadUInt32();
        if (this.Chunky.Version >= 2) {
            this.MinVersion = reader.ReadUInt32();
        }
        if (this.Chunky.Version >= 3) {
            this.Flags = reader.ReadUInt32();
        }

        this.Name = reader.readString(this.NameSize, 'ascii');
        
        if (this.Type === ChunkType.Folder) {
            this.children.push(...Chunk.readChunks(this.Chunky, reader, {endOffset: reader.position + this.DataSize, mode}));
        } else {
            this.ReadData(reader);
        }
    }

    protected ReadData(reader: BinaryReader) {
        this.Data = reader.read(this.DataSize);
    }

    public static readChunks(chunky: RelicChunky, reader: BinaryReader, {endOffset, mode}: {endOffset?: number, mode: ChunkParseMode}) {
        const result: Chunk[] = [];
        while (true) {
            const chunk = new Chunk(chunky, reader, mode);
            if (chunk.IsValid) {
                result.push(chunk);
            }
            if (reader.position == (endOffset ?? reader.length) || (mode === ChunkParseMode.Graceful && !chunk.IsValid)) {
                break;
            }
        }
        return result;
    }
}

export class RelicChunky {
    public Name: string;
    public Magic: string;
    public Signature: number;
    public Version: number;
    public Platform: number;
    public FileHeaderSize: number = 36;
    public ChunkHeaderSize: number;
    public MinVersion: number;
    public Chunks: Chunk[] = [];

    constructor(reader: BinaryReader, mode = ChunkParseMode.Strict) {
        this.Magic = reader.readString(12, 'ascii');
        this.Signature = reader.ReadUInt32();
        this.Version = reader.ReadUInt32();
        this.Platform = reader.ReadUInt32();
        if (this.Version >= 3) {
            this.FileHeaderSize = reader.ReadUInt32();
            this.ChunkHeaderSize = reader.ReadUInt32();
            this.MinVersion = reader.ReadUInt32();
        }

        this.Chunks.push(...Chunk.readChunks(this, reader, {mode}));
    }
}