/**
 * Mapps between CoH2 textual faction IDs and user-friendly display label of the faction.
 */
export const FACTION_NAMES: Record<string, string> = {
    german: 'Ostheer',
    soviet: 'Soviets',
    west_german: 'Oberkommando West',
    aef: 'US. Forces',
    british: 'British',
};

/**
 * Mappings between CoH2 textual faction IDs and matching custom emojis hosted on
 * the bot's "home" discord server.
 */
export const FACTION_EMOJIS: Record<string, string> = {
    german: '<:german:753277450171056208>',
    soviet: '<:soviet:753277450489954375>',
    west_german: '<:west_german:753277450217062411>',
    aef: '<:aef:753277449944432830>',
    british: '<:british:753277449957277867>',
};