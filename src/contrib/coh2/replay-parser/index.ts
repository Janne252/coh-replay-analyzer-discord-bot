import assert from 'assert';
import { BinaryReader } from '../../io';
import { Chunk, ChunkParseMode, RelicChunky, ChunkType } from '../chunk';

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

    opponentType: number;
    seed: number;
    players: Player[];
    scenario: Scenario;

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
        
        reader.position = 76;

        const dataParsers = {
            DATATATA: this.parse_DATADATA,
            DATASDSC: this.parse_DATASDSC,
            DATAPLAS: this.parse_DATAPLAS,
        };
        // Parse chunky bois
        // Replay is a special file where 2 Relic Chunky "files" are stored in series
        // There is no indication of how many chunks they should contain, meaning that
        // We have to parse their contents gracefully (stop when an invalid chunk is found)
        const chunky01 = new RelicChunky(reader, {mode: ChunkParseMode.Graceful, dataParsers});
        const chunky02 = new RelicChunky(reader, {mode: ChunkParseMode.Graceful, dataParsers});

        /*
        const chunks = [...chunky01.flatten(), ...chunky02.flatten()];
        for (const chunk of chunks) {
            if (chunk.type === ChunkType.Folder) {
                continue;
            }
            const methodName = `parse_${chunk.alias}`;
            if (!(methodName in this)) {
                throw new Error(`${methodName} is not implemented`);
            }
            const reader = new BinaryReader(Buffer.from(chunk.data));
            this[methodName](chunk, reader);
        }
        */
    }

    private parse_DATADATA(chunk: Chunk, reader: BinaryReader) {
        if (chunk.version == 0x1) {
            // 4 bytes of data, what is it?
        } else if (chunk.version >= 27 && chunk.version <= 28) {
            this.opponentType = reader.readUInt32();
            const padding = reader.read(4);
            const u1 = reader.readUInt32();
            const u2 = reader.readUInt16();
            this.seed = reader.readUInt32();
            this.players = Player.collection(reader, reader.readUInt32());
            var b = 1;
        }
    }

    private parse_DATASDSC(chunk: Chunk, reader: BinaryReader) {
        if (chunk.version !== 2020) {
            throw new Error(`Unsupported version ${chunk.version} for ${chunk.alias}`);
        }
        
        this.scenario = new Scenario(reader);
        var b = 1;
    }

    private parse_DATAPLAS(chunk: Chunk, reader: BinaryReader) {

    }

}

/**
 * Represents a section in a replay file that may or may not repeat multiple times.
 */
abstract class ReplaySection {
    constructor(reader: BinaryReader) {

    }
  
    public static collection(this, reader: BinaryReader, length?: number) {
        const result: InstanceType<typeof this>[] = [];
        let count = 0;
        while (reader.position < reader.length && count != length) {
            result.push(new this(reader));
            count++;
        }

        return result;
    }
}

class Scenario extends ReplaySection {
    public readonly filepath: string;
    public readonly name: string;
    public readonly descriptionLong: string;
    public readonly description: string;
    public readonly maxPlayers: number;
    public readonly width: number;
    public readonly height: number;

    public readonly minimapWidth: number;
    public readonly minimapHeight: number;
    public readonly minimapLayers: MinimalLayer[];

    constructor(reader: BinaryReader) {
        super(reader);
        
        const u01 = reader.readUInt32(); // 0x0
        const u02 = reader.readUInt32(); // 0x0
        const u03 = reader.read(4);
        const u04 = reader.readUInt32(); // 0x3
        const u05 = reader.readUInt32(); // 0x0
        const u06 = reader.readUInt32(); // 0x0
        const u07 = reader.readUInt32(); // 0x0
        this.filepath = reader.readString(reader.readUInt32(), 'utf8');
        const u08 = reader.read(16);
        this.name = reader.readString(reader.readUInt32() * 2, 'utf16le');
        this.descriptionLong = reader.readString(reader.readUInt32() * 2, 'utf16le');
        this.description = reader.readString(reader.readUInt32() * 2, 'utf16le');
        this.maxPlayers = reader.readUInt32();
        this.width = reader.readUInt32();
        this.height = reader.readUInt32();
        
        const savedName = reader.readString(reader.readUInt32() * 2, 'utf16le');
        const abbrName = reader.readString(reader.readUInt32() * 2, 'utf16le');
        const u09 = reader.read(32);
        const u10 = reader.readUInt16(); // 0x2
        const u11 = reader.read(16);
        const u12 = reader.readUInt32(); // 0x0
        const u13 = reader.readUInt32(); // 0x4 = layer count?
        const u14 = reader.readUInt32(); // 0x0
        this.minimapWidth = reader.readUInt32();
        this.minimapHeight = reader.readUInt32();
        // 00000000000000000000000000000000:XXXXXXXX
        const wincondition = reader.readString(reader.readUInt32());
        this.minimapLayers = MinimalLayer.collection(reader, 4);
        // sometimes there's 0x00, sometimes 0x01 0x00
        // Do we just assume 0x01 means there's one additional byte?
        var b = 1;
    }
}

class MinimalLayer extends ReplaySection {
    public readonly icons: MinimapIcon[];

    constructor(reader: BinaryReader) {
        super(reader);
        this.icons = MinimapIcon.collection(reader, reader.readUInt32());
    }
}

class MinimapIcon extends ReplaySection {
    public readonly x: number;
    public readonly y: number;
    public readonly name: string;

    constructor(reader: BinaryReader) {
        super(reader);
        this.x = reader.readFloat();
        this.y = reader.readFloat();
        this.name = reader.readString(reader.readUInt32(), 'utf8');
        var b = 1;
    }
}

class Player extends ReplaySection {
    public readonly type: number;
    public readonly name: string;
    public readonly team: number;
    public readonly faction: string;
    public readonly steamId: bigint;

    public readonly faceplate: Faceplate;
    public readonly victoryStrike: VictoryStrike;
    public readonly decal: Decal;
    public readonly commanders: Commander[];
    public readonly intelBulletins: IntelBulletin[];

    constructor(reader: BinaryReader) {
        super(reader);
        this.type = reader.readUInt8();
        this.name = reader.readString(reader.readUInt32() * 2, 'utf16le');
        this.team = reader.readUInt32();
        this.faction = reader.readString(reader.readUInt32(), 'ascii');
        const u01 = reader.readUInt32(); // 0x5
        const u02 = reader.read(4);
        const u03 = reader.readString(reader.readUInt32(), 'utf8');
        const u04 = reader.read(4); 
        const u05 = reader.read(4);
        const u06 = reader.readUInt32(); // 0x0
        const u07 = reader.readUInt32(); // 0x5
        const u08 = reader.readUInt16(); // 0x1

        const skins = Skin.collection(reader, 3);
        
        const u09 = reader.readUInt16(); // 0x1

        const u10 = reader.read(8);
        this.steamId = reader.readUInt64();
        this.faceplate = new Faceplate(reader);
        this.victoryStrike = new VictoryStrike(reader);
        this.decal = new Decal(reader);

        this.commanders = Commander.collection(reader, reader.readUInt32());
        this.intelBulletins = IntelBulletin.collection(reader, reader.readUInt32());
        
        const u11 = reader.readUInt32(); // 0x0
        const u12 = reader.read(8);
        var b = 1;
    }
}

abstract class PlayerInventoryItem extends ReplaySection {
    public readonly kind: number;
    public selectionId: number;
    public serverId: number;
   
    constructor(reader: BinaryReader) {
        super(reader);
        this.kind = reader.readUInt16();
        switch (this.kind) {
            case 0x1: {
                break;
            }

            case 0x109: {
                this.parsePlayerItem(reader);
                break;
            }

            case 0x206: {
                this.parseAIPlayerItem(reader);
                break;
            }

            case 0x216: {
                this.parsePlayerItemSpecial(reader);
                break;
            }

            default: {
                throw new Error(`Unsupported player inventory item kind ${this.kind}`);
            }
        }
    }

    protected parsePlayerItem(reader: BinaryReader) {
        this.selectionId = reader.readUInt32();
        const u01 = reader.readUInt32(); // 0x0
        this.serverId = reader.readUInt32();
        const u02 = reader.readUInt32(); // 0x0
        const u03 = reader.read(reader.readUInt16());
        var b = 1;
    }

    protected parseAIPlayerItem(reader: BinaryReader) {
        const u01 = reader.readUInt8(); // 0x1
        const u02 = reader.read(4);
    }

    // Item that has durability? CoH2 had planned some time limited event intel bulletins.
    protected parsePlayerItemSpecial(reader: BinaryReader) {
        const u01 = reader.read(16);
        const u02 = reader.read(4);
        const u03 = reader.readUInt8();
    }
}

class Skin extends PlayerInventoryItem {}
class Faceplate extends PlayerInventoryItem {}
class VictoryStrike extends PlayerInventoryItem {}
class Decal extends PlayerInventoryItem {}
class Commander extends PlayerInventoryItem {}
class IntelBulletin extends PlayerInventoryItem {}
