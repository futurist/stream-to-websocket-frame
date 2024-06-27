export type Callback = (arg: {
    resultCode?: number;
    data?: ArrayBufferLike;
}) => void;
export interface Stream {
    destroy: () => void;
    write: (data: ArrayBufferLike, callback: Callback) => void;
    read: (callback: Callback) => void;
}
export interface Frame {
    isFinal: boolean;
    opcode: number;
    masked: boolean;
    payloadLength: number;
    maskingKey: number[];
    payloadData: Uint8Array;
}
export interface Config {
    onFrame: (frame: Frame) => void;
    onData: (data: string | Uint8Array) => void;
    onClosed: () => void;
    onError: (errorMessage: string) => void;
}
export declare class StreamToWebSocket {
    constructor(stream: Stream, config: Config);
    consumeFragment(): boolean;
    listen(): void;
    close(errorMessage?: string): void;
    sendFrame(data: string | Uint8Array): boolean;
    sendPong(data: Uint8Array): void;
    sendPing(data: Uint8Array): void;
}
