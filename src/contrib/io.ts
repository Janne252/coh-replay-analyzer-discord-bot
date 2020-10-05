import fs from 'fs-extra';

export class BinaryReader {
    public position = 0;
    public data: Buffer;
    public filepath?: string;
   
    get length() {
        return this.data.byteLength;
    }

    constructor(filepath: string)
    constructor(data: Buffer)
    // The actual implementation constructor is hidden; We have to publish it
    constructor(filepathOrBuffer: string | Buffer)
    constructor(filepathOrBuffer: string | Buffer) {
        if (filepathOrBuffer instanceof Buffer) {
            this.data = filepathOrBuffer;
        } else {
            this.filepath = filepathOrBuffer;
            this.data = fs.readFileSync(this.filepath);
        }
    }

    public offset(offset: number) {
        this.position += offset;
        if (this.position > this.length) {
            throw new Error(`Offset ${this.position} out of range (0 - ${this.length})`);
        }
        return this.position;
    }

    public read(length: number) {
        return this.data.subarray(this.position, this.offset(length));
    }

    public readUInt8() {
        const result = this.data.readUInt8(this.position);
        this.offset(1);
        return result;
    }

    public readUInt16() {
        const result = this.data.readUInt16LE(this.position);
        this.offset(2);
        return result;
    }

    public readUInt32() {
        const result = this.data.readUInt32LE(this.position);
        this.offset(4);
        return result;
    }

    public readUInt64() {
        const result = this.data.readBigUInt64LE(this.position);
        this.offset(8);
        return result;
    }

    public readFloat() {
        const result = this.data.readFloatLE(this.position);
        this.offset(4);
        return result;
    }

    public readString(length: number, encoding: BufferEncoding = 'utf8') {
        return this.data.subarray(this.position, this.offset(length)).toString(encoding);
    }

    public readNullTerminatedString(charSize: number, encoding: BufferEncoding = 'utf8') {
        const charBuffer = new Uint8Array(charSize);
        let charBufferIndex = 0;
        // Sum of charBuffer bytes to check for 0x00 (NULL)
        let charBufferValue = 0;
        const buffer: number[] = [];
        while (true) {
            charBuffer[charBufferIndex] = this.readUInt8();
            charBufferValue += charBuffer[charBufferIndex];
            charBufferIndex++;
            if (charBufferIndex == charSize) {
                if (charBufferValue === 0x00) {
                    break;
                }
                buffer.push(...charBuffer);
                charBufferIndex = 0;
                charBufferValue = 0;
            }
        }

        return Buffer.from(buffer).toString(encoding);
    }

    public unexpectedValue(offset: number | string, value: any, expected: any) {
        throw new Error(`Unexpected value at offset ${offset}: ${value}, expected ${expected}`);
    }
}

/**
 * Represents a section of data in a file that may or may not repeat multiple times.
 */
export abstract class DataSection {
    public readonly startOffset: number;

    static get alias(): string {
        throw new Error(`All sub-classes of DataSection must implement static alias: string`);
    }

    public static collection<T>(this: {new(reader: BinaryReader, ...args: any[]): T}, {reader, count, args}: {reader: BinaryReader, count?: number, args?: any[]}) {
        const result: T[] = [];
        while (reader.position < reader.length && result.length != count) {
            const offset = reader.position;
            const index = result.length;
            try {
                result.push(new this(reader, ...args ?? []));
            } catch (error) {
                let message = `Failed to initialize a data section of type "${(this as any).alias}" at index ${index} at byte offset ${offset}`;

                // Append original error to the message if it's not a DataSectionError
                if (!(error instanceof DataSectionError)) {
                    message += `: ${error}`;
                } 
                const dataSectionError = new DataSectionError(message, {index , offset});

                // Re-throw inner-most error if it's a DataSectionError
                if (error instanceof DataSectionError) {
                    error.parent = dataSectionError;
                    throw error;
                }

                throw dataSectionError;
            }
        }

        return result;
    }

    constructor(reader: BinaryReader) {
        this.startOffset = reader.position;
    }
}

export class DataSectionError extends Error {
    public readonly index: number;
    public readonly offset: number;
    public parent?: DataSectionError;
    
    constructor(message: string, {index, offset}: {index: number, offset: number}) {
        super(message);
        this.index = index;
        this.offset = offset;
    }

    toString() {
        return `${this.message}${this.parent ? `\n\t${this.parent}` : ''}`;
    }
}