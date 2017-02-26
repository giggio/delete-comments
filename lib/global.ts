declare var log: debug.IDebugger;
declare namespace NodeJS {
    export interface Global {
        log: typeof debug;
    }
}