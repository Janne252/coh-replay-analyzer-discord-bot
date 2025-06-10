import * as fs from "fs-extra";

export function readToEnd(stream: fs.ReadStream): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    return new Promise((resolve, reject) => {
        // No encoding set so 'data' event is always providing chunks as `Buffer`
        // Safe forced type cast; `Buffer` extends `Uint8Array`
        stream.on('data', chunk => chunks.push(chunk as unknown as Uint8Array));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}