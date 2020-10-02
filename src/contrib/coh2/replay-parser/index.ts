import assert from 'assert';
import { BinaryReader } from '../../io';
import { RelicChunky } from '../chunk';

/**
 * TypeScript implementation of https://github.com/ryantaylor/vault
 */
// TODO don't extend BinaryReader, instead use an instance of it
export class ReplayParser extends BinaryReader {
    public static readonly MinimumVersion = 19545;


    private _version: number;
    public get version() { return this._version; }

    private _magic: string;
    public get magic() { return this._magic; }

    private _timestamp: string;
    public get timestamp() { return this._timestamp; }

    constructor(data: Buffer) {
        super(data);
        this.parseHeader();
    }

    private parseHeader() {
        // Prefix, always seems to be 0x00
        const prefix = this.readUInt16();
        if (prefix !== 0x00) {
            this.unexpectedValue(this.position - 2, prefix, 0);
        }

        // Version
        this._version = this.readUInt16();
        if (this.version < ReplayParser.MinimumVersion) {
            this.unexpectedValue(this.position - 2, this.version, `version >= ${ReplayParser.MinimumVersion}`);
        }
        
        // Magic
        this._magic = this.readString(8, 'utf8');

        this._timestamp = this.readNullTerminatedString(2, 'utf16le');

        // Padding (32 bytes including last 2 bytes of the null-terminated timestamp)
        const padding = this.read(30).reduce((a, b) => a + b, 0);
        if (padding !== 0x00) {
            this.unexpectedValue(`${this.position - 30} - ${this.position}`, padding, 0x00);
        }

        // TODO parse Relic Chunky (chunky bois)
        // For some reason there are 2 Chunkies. Where's the indication that chunk's children end?
        const chunky01 = new RelicChunky(this, 'replay01');
        // The next chunky has a child chunk "DATAPLAS" which seems to report its end way before its data appears to end
        // How do we know DATAPLAS does not have any siblings after it? It's parent is DATAFOLD
        const chunky02 = new RelicChunky(this, 'replay02');
        var b = 1;
    }
}