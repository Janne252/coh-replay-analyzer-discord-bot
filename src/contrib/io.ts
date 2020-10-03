export class BinaryReader {
    public position = 0;

    get length() {
        return this.data.byteLength;
    }

    constructor(protected readonly data: Buffer) {

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