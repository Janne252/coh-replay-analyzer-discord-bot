import { Replay } from "../src/types";

export function replay(options: Partial<Replay['map']>): Replay {
    return {
        map: {
            name: options.name,
            description: options.description,
            players: options.players,
            file: options.file,
            width: options.width,
            height: options.height,
        }
    } as Replay;
}
