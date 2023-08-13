import fs from 'fs-extra';
import { Attachment } from "discord.js";

export type InputData<T, K extends keyof T> = T | Pick<T, K>;

export type AttachmentStub = { url?: Attachment['url'], name: string; stream?: fs.ReadStream; }

export enum ApplicationCommandScope {
    Global = 'global',
    Guild = 'guild'
}
