import * as fs from "fs-extra";

export function readToEnd(stream: fs.ReadStream): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk as Uint8Array));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}