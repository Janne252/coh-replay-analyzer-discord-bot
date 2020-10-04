import assert from 'assert';
import fs from 'fs-extra';
import { BinaryReader, DataSection } from '../../io';
import { Chunk, ChunkParseMode, RelicChunky, ChunkType } from '../chunk';

export type ReplayParserOptions = {strict: boolean};

// Implementation loosely based on Ryan Taylor's https://github.com/ryantaylor/vault
export class ReplayParser {
    public static readonly ExpectedPrefix = 0x00;
    public static readonly MinimumVersion = 19545;
    public static readonly Magic = 'COH2_REC';

    private readonly strict: boolean;
    public readonly version: number;

    public readonly magic: string;

    public readonly timestamp: string;

    public errors: string[] = [];
    public readonly dataLength: number;
    private sections: RelicChunky[];
    isValid: boolean;
    opponentType: number;
    seed: number;
    players: Player[];
    scenario: Scenario;

    /**
     * Parses replay data. Setting strict to false (true by default) prevents
     * errors being thrown. Use the isValid property to check for validity when
     * parsing replay data with {strict: false}.
     */
    constructor(filepath: string, options?: ReplayParserOptions)
    constructor(data: Buffer, options?: ReplayParserOptions)
    constructor(filepathOrBuffer: string | Buffer, options: ReplayParserOptions = {strict: true}) {
        const reader = new BinaryReader(filepathOrBuffer);
        this.strict = options.strict ?? true;
        this.dataLength = reader.length;
        if (this.dataLength === 0) {
            this.exit(`No data (0 byes)`);
            return;
        }
        // Prefix, always seems to be 0x00
        const prefix = reader.readUInt16();
        if (prefix !== ReplayParser.ExpectedPrefix) {
            this.exit(`Unexpected replay file prefix at offset ${reader.position - 2}: ${prefix}, expected ${ReplayParser.ExpectedPrefix}`);
            return;
        }

        // Version
        this.version = reader.readUInt16();
        if (this.version < ReplayParser.MinimumVersion) {
            this.exit(`Unsupported replay file version ${this.version}, expected greater than or equal to ${ReplayParser.MinimumVersion}`);
            return;
        }
        
        // Magic
        this.magic = reader.readString(8, 'utf8');
        if (this.magic  !== ReplayParser.Magic) {
            this.exit(`Unsupported replay magic ${this.magic}, expected ${ReplayParser.Magic}`);
            return;
        }
        
        this.timestamp = reader.readNullTerminatedString(2, 'utf16le');
        
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
        this.sections = RelicChunky.collection({reader, count: 2, args: [{mode: ChunkParseMode.Graceful, dataParsers}]});
        // If no parsing operation marked the the replay as invalid, default to valid
        this.isValid = this.isValid ?? true;
    }

    private exit(message: string) {
        this.errors.push(message);
        this.isValid = false;
        if (!this.strict) {
            return;
        }
        
        throw new Error(message);
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
            this.players = Player.collection({reader, count: reader.readUInt32()});
            var b = 1;
        }
    }

    private parse_DATASDSC(chunk: Chunk, reader: BinaryReader) {
        if (chunk.version !== 2020) {
            return this.exit(`Unsupported version ${chunk.version} for ${chunk.alias}`);
        }
        
        this.scenario = new Scenario(reader);
        var b = 1;
    }

    private parse_DATAPLAS(chunk: Chunk, reader: BinaryReader) {

    }

}

class Scenario extends DataSection {
    static get alias() { return 'Scenario' };

    public readonly filepath: string;
    public readonly name: string;
    public readonly descriptionLong: string;
    public readonly description: string;
    public readonly descriptionExt: string;
    public readonly maxPlayers: number;
    public readonly width: number;
    public readonly height: number;

    public readonly music: string;
    public readonly abbrNameMaybe: string;
    public readonly scenarioReferenceFilepath: string;
    public readonly scenarioReferenceName: string;
    public readonly scenarioReferenceDirectory: string;
    public readonly atmosphereOptions: AtmosphereOption[];
    public readonly minimapWidth: number;
    public readonly minimapHeight: number;
    public readonly wincondition: string;
    public readonly minimapLayers: MinimapLayer[];
    public readonly defaultSkins: DefaultSkin[];

    constructor(reader: BinaryReader) {
        super();
        /*
            Not yet parsed, but could potentially be present in replay data:
            - .info version (2007, 2008)
            - .info savedname ""
            - .info scenario_battlefront 2
                Test:
                - scenario_battlefront: 0 2p_don_river
                - scenario_battlefront: 1 2p_la_gleize_breakout
                - scenario_battlefront: 2 (2-4)_langres
                - scenario_battlefront: 3 2p_halbe
                - scenario_battlefront: 4 2p_cherneux
                - scenario_battlefront: 5 2p_arnherm_checkpoint
        */
        const unknown_01 = reader.readUInt32(); // 0x0
        const unknown_02 = reader.readUInt32(); // 0x0
        const unknown_03 = reader.read(4);
        const unknown_04 = reader.readUInt32(); // 0x3
        const unknown_05 = reader.readUInt32(); // 0x0
        const unknown_06 = reader.readUInt32(); // 0x0
        const unknown_07 = reader.readUInt32(); // 0x0
        if (unknown_01 != 0 || unknown_02 != 0 || unknown_04 != 3 || unknown_05 != 0 || unknown_06 != 0 || unknown_07 != 0) {
            var b = 1;
        }
        this.filepath = reader.readString(reader.readUInt32(), 'utf8');
        const unknown_08 = reader.read(16);
        this.name = reader.readString(reader.readUInt32() * 2, 'utf16le');
        this.descriptionLong = reader.readString(reader.readUInt32() * 2, 'utf16le');
        this.description = reader.readString(reader.readUInt32() * 2, 'utf16le');
        this.maxPlayers = reader.readUInt32();
        this.width = reader.readUInt32();
        this.height = reader.readUInt32();
        
        this.music = reader.readString(reader.readUInt32(), 'utf8');
        // Not savedname nor any other known text field (that we know of)
        // Will be tested again against a larger replay set
        this.abbrNameMaybe = reader.readString(reader.readUInt32() * 2, 'utf16le');

        // 16 bytes of strange data present only in a very small percentage of replays
        const unknown_10 = reader.read(16);
        
        this.scenarioReferenceFilepath = reader.readString(reader.readUInt32());
        this.scenarioReferenceName = reader.readString(reader.readUInt32());
        this.scenarioReferenceDirectory = reader.readString(reader.readUInt32());

        this.atmosphereOptions = AtmosphereOption.collection({reader, count: reader.readUInt32()});
        const unknown_12 = UnknownDataSection.collection({reader, count: reader.readUInt16(), args: [8]});
        if (unknown_12[0].data.reduce((a, b) => a + b, 0) !== 0 || unknown_12[1].data.reduce((a, b) => a + b, 0) !== 0) {
            var b = 1;
        }
        const [b1, b2, b3, b4] = reader.read(4);
        if (b1 != 0 || b2 != 0 || b3 != 0 || b4 != 0) {
            var b = 1;
            // console.log(b1, b2, b3, b4);
        }
        const unknown_13 = reader.readUInt32(); // 0x4 = layer count?
        if (unknown_13 !== 4) {
            var b = 1;
        }
        // .options scenario_description_ext field
        this.descriptionExt = reader.readString(reader.readUInt32() * 2, 'utf16le');
        this.minimapWidth = reader.readUInt32();
        this.minimapHeight = reader.readUInt32();
        // 00000000000000000000000000000000:XXXXXXXX
        this.wincondition = reader.readString(reader.readUInt32());
        const u14 = reader.readUInt32();

        // Replay file stores info about the minimap icons because
        // certain game modes replace entities at runtime, e.g.
        // annihilation mode replaces all victory points with standard territory points

        // Does not explain though why annihilation mode replays have info about
        // victory point icons
        this.minimapLayers = MinimapLayer.collection({reader, count: 3});

        this.defaultSkins = DefaultSkin.collection({reader, count: reader.readUInt32()});
        // sometimes there's 0x00, sometimes 0x01 0x00
        // Do we just assume 0x01 means there's one additional byte?
        var b = 1;
    }
}

class UnknownDataSection extends DataSection {
    static get alias() { return 'UnknownDataSection' };

    public readonly data: Buffer;
    constructor(reader: BinaryReader, public readonly byteLength: number) {
        super();
        this.data = reader.read(byteLength);
    }
}
class DefaultSkin extends DataSection {
    static get alias() { return 'DefaultSkin' };
    public readonly name: string;
    constructor(reader: BinaryReader) {
        super();
        this.name = reader.readString(reader.readUInt32());
    }
}
class AtmosphereOption extends DataSection {
    static get alias() { return 'AtmosphereOption' };

    private readonly titleLocStringId: number;
    private readonly filepath: string;
    constructor(reader: BinaryReader) {
        super();
        this.titleLocStringId = reader.readUInt32();
        this.filepath = reader.readString(reader.readUInt32());
    }
}

class MinimapLayer extends DataSection {
    static get alias() { return 'MinimapLayer' };

    public readonly icons: MinimapIcon[];

    constructor(reader: BinaryReader) {
        super();
        this.icons = MinimapIcon.collection({reader, count: reader.readUInt32()});
    }
}

class MinimapIcon extends DataSection {
    static get alias() { return 'MinimapIcon' };

    public readonly x: number;
    public readonly y: number;
    public readonly name: string;

    constructor(reader: BinaryReader) {
        super();
        this.x = reader.readFloat();
        this.y = reader.readFloat();
        this.name = reader.readString(reader.readUInt32(), 'utf8');
        var b = 1;
    }
}

class Player extends DataSection {
    static get alias() { return 'Player' };

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
        super();
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

        const skins = Skin.collection({reader, count: 3});
        
        const u09 = reader.readUInt16(); // 0x1

        const u10 = reader.read(8);
        this.steamId = reader.readUInt64();
        this.faceplate = new Faceplate(reader);
        this.victoryStrike = new VictoryStrike(reader);
        this.decal = new Decal(reader);

        this.commanders = Commander.collection({reader, count: reader.readUInt32()});
        this.intelBulletins = IntelBulletin.collection({reader, count: reader.readUInt32()});
        
        const u11 = reader.readUInt32(); // 0x0
        const u12 = reader.read(8);
        var b = 1;
    }
}

abstract class PlayerInventoryItem extends DataSection {
    public readonly kind: number;
    public selectionId: number;
    public serverId: number;
   
    constructor(reader: BinaryReader) {
        super();
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

class Skin extends PlayerInventoryItem {
    static get alias() { return 'Skin' };
}

class Faceplate extends PlayerInventoryItem {
    static get alias() { return 'Faceplate' };
}

class VictoryStrike extends PlayerInventoryItem {
    static get alias() { return 'VictoryStrike' };
}

class Decal extends PlayerInventoryItem {
    static get alias() { return 'Player' };
}

class Commander extends PlayerInventoryItem {
    static get alias() { return 'Commander' };
}

class IntelBulletin extends PlayerInventoryItem {
    static get alias() { return 'IntelBulletin' };
}
