/**
 * Definition for https://github.com/ryantaylor/vault JSON output.
 */
export interface Replay {
    version: string;
    chat: {
        tick: number;
        name: string;
        message: string;
    }[];
    date_time: string;
    duration: number;
    game_type: string;
    map: {
        file: string;
        name: string;
        description: string;
        description_long: string;
        width: number;
        height: number;
        players: number;
    };

    players: ReadonlyArray<{
        id: number;
        name: string;
        steam_id: number;
        steam_id_str: string;
        team: 0 | 1;
        faction: string;
        commander: number;
        items: {
            selection_id: number;
            server_id: number;
            item_type: string;
        }[];
    }>;
}