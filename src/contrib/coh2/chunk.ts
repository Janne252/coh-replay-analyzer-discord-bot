import { BinaryReader, DataSection } from "../io";

export enum ChunkType {
    Folder = 'FOLD',
    Data = 'DATA',
}

export enum ChunkParseMode {
    Strict,
    Graceful,
}

export abstract class ChunkLike extends DataSection {
    public version: number;
    public children: Chunk[] = [];
}

// Implementation based on Corsix' https://github.com/corsix/coh2-formats and
// Copernicus' CoH2_RGDTools (source unavailable as of 2020/10/2)
export class Chunk extends ChunkLike {
    static get alias() { return 'Chunk' }

    public readonly dataOffset: number;
    public readonly type: ChunkType;
    public readonly kind: string;
    public readonly alias: string;
    public readonly dataLength: number;
    public readonly nameLength: number;
    public readonly name: string;
    public readonly minVersion: number;
    public readonly flags: number;
    public data: Buffer;

    public readonly isValid: boolean;
    constructor(public readonly Chunky: RelicChunky, reader: BinaryReader, {mode, dataParsers}: {mode: ChunkParseMode, dataParsers?: ChunkDataParsers}) {
        super(reader);
        this.type = reader.readString(4, 'ascii') as ChunkType;
        this.kind = reader.readString(4, 'ascii');
        this.alias = `${this.type}${this.kind}`;
        this.isValid = this.type === ChunkType.Data || this.type === ChunkType.Folder;;
        if (!this.isValid) {
             if (mode === ChunkParseMode.Graceful) {
                // Roll back reading UInt32 x 2
                reader.position -= 8;
                return;
            }
            throw new Error(`Invalid chunk type "${this.type}"`); 
        }

        this.version = reader.readUInt32();
        this.dataLength = reader.readUInt32();
        this.nameLength = reader.readUInt32();
        if (this.Chunky.version >= 2) {
            this.minVersion = reader.readUInt32();
        }
        if (this.Chunky.version >= 3) {
            this.flags = reader.readUInt32();
        }

        this.name = reader.readString(this.nameLength, 'ascii');
        
        const endOffset = reader.position + this.dataLength;
        this.dataOffset = reader.position;
        if (this.type === ChunkType.Folder) {
            this.children.push(...Chunk.readChunks(this.Chunky, reader, {endOffset, mode: ChunkParseMode.Strict, dataParsers}));
        } else if (dataParsers && this.alias in dataParsers) {
            dataParsers[this.alias](this, reader);
            if (reader.position < endOffset) {
                throw new Error(`dataParser "${this.alias}" did not parse all data`);
            }
        } else {
            this.readData(reader);
        }
    }

    protected readData(reader: BinaryReader) {
        this.data = reader.read(this.dataLength);
    }

    public static readChunks(chunky: RelicChunky, reader: BinaryReader, {endOffset, mode, dataParsers}: {endOffset?: number, mode: ChunkParseMode, dataParsers?: ChunkDataParsers}) {
        const result: Chunk[] = [];
        while (true) {
            const chunk = new Chunk(chunky, reader, {mode, dataParsers});
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

export type ChunkDataParsers = Record<string, (chunk: Chunk, reader: BinaryReader) => void>;

export class RelicChunky extends ChunkLike {
    static get alias() { return 'RelicChunky' }

    public readonly magic: string;
    // In Corsix' implementation "magi"c is "Relic Chunky" and the signature is processed separately as below
    // For comparison Copernicus reads the signature as part of the "magic": "Relic Chunky\r\n\u001a\0"
    public readonly signature: number;
    public readonly platform: number;
    public readonly fileHeaderSize: number = 36;
    public readonly chunkHeaderSize: number;
    public readonly minVersion: number;
    /** Number of bytes excluding header bytes. */
    public readonly dataLength: number;

    constructor(reader: BinaryReader, {mode, dataParsers, expectedDataLength}: {mode: ChunkParseMode, dataParsers?: ChunkDataParsers, expectedDataLength?: number}) {
        super(reader);
        this.magic = reader.readString(12, 'ascii');
        this.signature = reader.readUInt32();
        this.version = reader.readUInt32();
        this.platform = reader.readUInt32();
        if (this.version >= 3) {
            this.fileHeaderSize = reader.readUInt32();
            this.chunkHeaderSize = reader.readUInt32();
            this.minVersion = reader.readUInt32();
        }

        const offsetForDataLength = reader.position;
        this.children.push(...Chunk.readChunks(this, reader, {mode, dataParsers}));
        this.dataLength = reader.position - offsetForDataLength;

        if (expectedDataLength != null && this.dataLength != expectedDataLength) {
            throw new Error(`Unexpected chunky data length ${this.dataLength}, expected ${expectedDataLength}`);
        }
    }
}