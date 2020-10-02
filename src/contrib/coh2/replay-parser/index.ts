import assert from 'assert';
import { BinaryReader } from '../../io';
import { ChunkParseMode, RelicChunky } from '../chunk';

// Implementation loosely based on Ryan Taylor's https://github.com/ryantaylor/vault
export class ReplayParser {
    public static readonly ExpectedPrefix = 0x00;
    public static readonly MinimumVersion = 19545;


    private _version: number;
    public get version() { return this._version; }

    private _magic: string;
    public get magic() { return this._magic; }

    private _timestamp: string;
    public get timestamp() { return this._timestamp; }

    constructor(data: Buffer) {
        const reader = new BinaryReader(data);
        this.parseHeader(reader);
    }

    private parseHeader(reader: BinaryReader) {
        // Prefix, always seems to be 0x00
        const prefix = reader.readUInt16();
        if (prefix !== ReplayParser.ExpectedPrefix) {
            reader.unexpectedValue(reader.position - 2, prefix, 0);
            throw new Error(`Unexpected replay file prefix at offset ${reader.position - 2}: ${prefix}, expected ${ReplayParser.ExpectedPrefix}`);
        }

        // Version
        this._version = reader.readUInt16();
        if (this.version < ReplayParser.MinimumVersion) {
            throw new Error(`Unsupported replay file version ${this.version}, expected greater than or equal to ${ReplayParser.MinimumVersion}`);
        }
        
        // Magic
        this._magic = reader.readString(8, 'utf8');

        this._timestamp = reader.readNullTerminatedString(2, 'utf16le');

        // Padding (32 bytes including last 2 bytes of the null-terminated timestamp)
        const padding = reader.read(30).reduce((a, b) => a + b, 0);
        if (padding !== 0x00) {
            reader.unexpectedValue(`${reader.position - 30} - ${reader.position}`, padding, 0x00);
        }

        // Parse chunky bois
        // Replay is a special file where 2 Relic Chunky "files" are stored in series
        // There is no indication of how many chunks they should contain, meaning that
        // We have to parse their contents gracefully (stop when an invalid chunk is found)
        const chunky01 = new RelicChunky(reader, ChunkParseMode.Graceful);
        const chunky02 = new RelicChunky(reader, ChunkParseMode.Graceful);
        var b = 1;
    }
}