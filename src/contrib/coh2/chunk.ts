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
    public readonly version: number;
    public readonly type: ChunkType;
    public readonly kind: string;
    public readonly dataLength: number;
    public readonly nameLength: number;
    public readonly name: string;
    public readonly minVersion: number;
    public readonly flags: number;
    public data: Buffer;
    public children: Chunk[] = [];

    public readonly isValid: boolean;
    constructor(public readonly Chunky: RelicChunky, reader: BinaryReader, mode = ChunkParseMode.Strict) {
        this.type = reader.readString(4, 'ascii') as ChunkType;
        this.kind = reader.readString(4, 'ascii');
        this.isValid = this.type === ChunkType.Data || this.type === ChunkType.Folder;;
        if (!this.isValid) {
             if (mode === ChunkParseMode.Graceful) {
                // Roll back reading UInt32 x 2
                reader.position -= 8;
                return;
            }
            throw new Error(`Invalid chunk type "${this.type}"`); 
        }

        this.version = reader.ReadUInt32();
        this.dataLength = reader.ReadUInt32();
        this.nameLength = reader.ReadUInt32();
        if (this.Chunky.version >= 2) {
            this.minVersion = reader.ReadUInt32();
        }
        if (this.Chunky.version >= 3) {
            this.flags = reader.ReadUInt32();
        }

        this.name = reader.readString(this.nameLength, 'ascii');
        
        if (this.type === ChunkType.Folder) {
            this.children.push(...Chunk.readChunks(this.Chunky, reader, {endOffset: reader.position + this.dataLength, mode}));
        } else {
            this.readData(reader);
        }
    }

    protected readData(reader: BinaryReader) {
        this.data = reader.read(this.dataLength);
    }

    public static readChunks(chunky: RelicChunky, reader: BinaryReader, {endOffset, mode}: {endOffset?: number, mode: ChunkParseMode}) {
        const result: Chunk[] = [];
        while (true) {
            const chunk = new Chunk(chunky, reader, mode);
            if (chunk.isValid) {
                result.push(chunk);
            }
            if (reader.position == (endOffset ?? reader.length) || (mode === ChunkParseMode.Graceful && !chunk.isValid)) {
                break;
            }
        }
        return result;
    }
}

export class RelicChunky {
    public readonly name: string;
    public readonly magic: string;
    // In Corsix' implementation "magi"c is "Relic Chunky" and the signature is processed separately as below
    // For comparison Copernicus reads the signature as part of the "magic": "Relic Chunky\r\n\u001a\0"
    public readonly signature: number;
    public readonly version: number;
    public readonly platform: number;
    public readonly fileHeaderSize: number = 36;
    public readonly chunkHeaderSize: number;
    public readonly minVersion: number;
    public readonly chunks: Chunk[] = [];

    constructor(reader: BinaryReader, mode = ChunkParseMode.Strict) {
        this.magic = reader.readString(12, 'ascii');
        this.signature = reader.ReadUInt32();
        this.version = reader.ReadUInt32();
        this.platform = reader.ReadUInt32();
        if (this.version >= 3) {
            this.fileHeaderSize = reader.ReadUInt32();
            this.chunkHeaderSize = reader.ReadUInt32();
            this.minVersion = reader.ReadUInt32();
        }

        this.chunks.push(...Chunk.readChunks(this, reader, {mode}));
    }
}