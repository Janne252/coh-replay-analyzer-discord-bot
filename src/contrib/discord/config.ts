/* istanbul ignore next */
export class DiagnosticsConfig {
    log: {
        readonly guild?: string;
        readonly channel?: string;
    } = {};

    test: {
        readonly guild?: string;
        readonly channel?: string;
    } = {};

    error: {
        readonly guild?: string;
        readonly channel?: string;
    } = {};
   
    admin: {
        readonly guild?: string;
        readonly user?: string;
    } = {};
}
