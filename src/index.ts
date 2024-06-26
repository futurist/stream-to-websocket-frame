export const OPCODE_CONTINUATION = 0;
export const OPCODE_TEXT = 1;
export const OPCODE_BINARY = 2;
export const OPCODE_CLOSE = 8;
export const OPCODE_PING = 9;
export const OPCODE_PONG = 10;

export type Callback = (arg: {
    resultCode?: number;
    data?: Uint8Array;
}) => void;
export interface Stream {
    destroy?: () => void;
    write?: (data: string | Uint8Array, callback: Callback) => void;
    read: (callback: Callback) => void;
}
export interface Frame {
    isFinal: boolean;
    opcode: number;
    masked: boolean;
    payloadLength: number;
    maskingKey: Uint8Array;
    payloadData: Uint8Array;
}
export interface Config {
    onFrame?: (frame: Frame) => void;
    onData: (data: string | Uint8Array) => void;
    onClosed?: () => void;
    onError?: (errorMessage: string) => void;
}

export class StreamToWebSocket {
    onClosed: () => void;
    onError: (errorMessage: string) => void;
    dataBuffer: ArrayBuffer;
    buildingFrame: {opcode: number, dataBuffer: Uint8Array} | null = null;
    closing: any;
    constructor(private stream: Stream, private config: Config) {
        this.onClosed = config.onClosed || (() => { });
        this.onError = config.onError || ((err) => { console.error(err) });
        this.dataBuffer = new ArrayBuffer(0);
    }

    consumeFragment() {
        const data = new Uint8Array(this.dataBuffer);
        if (data.length < 2) return false;

        let i = 0;
        const finalFragment = (data[i] & 128) != 0;
        let opcode = data[i++] & 0xf;
        const masked = (data[i] & 128) != 0;
        let payloadLength = data[i++] & 127;
        if (payloadLength == 126) {
            payloadLength = (data[i++] << 8) | data[i++];
        } else if (payloadLength == 127) {
            payloadLength =
                (data[i++] << 24) | (data[i++] << 16) | (data[i++] << 8) | data[i++];
        }
        const maskingKey = new Uint8Array(4);
        if (masked) {
            for (let j = 0; j < 4; j++, i++) {
                maskingKey[j] = data[i];
            }
        }
        if (data.length < payloadLength + i) {
            return false;
        }
        let applicationData = new Uint8Array(payloadLength);
        for (let j = 0; j < payloadLength; j++, i++) {
            if (masked) {
                applicationData[j] = data[i] ^ maskingKey[j % 4];
            } else {
                applicationData[j] = data[i];
            }
        }

        if (this.config.onFrame) {
            const frame = {
                isFinal: finalFragment,
                opcode,
                masked,
                payloadLength,
                maskingKey: maskingKey,
                payloadData: applicationData,
            };
            this.config.onFrame(frame);
        }

        this.dataBuffer = this.dataBuffer.slice(i);
        if (finalFragment) {
            if (this.buildingFrame != null) {
                if (opcode != OPCODE_CONTINUATION) {
                    this.close("incomplete frame!");
                    return true;
                }
                applicationData = joinBuffers(
                    this.buildingFrame.dataBuffer,
                    applicationData
                );
                opcode = this.buildingFrame.opcode;
            }
            switch (opcode) {
                case OPCODE_TEXT:
                    const text = arrayBufferToString(applicationData);
                    this.config.onData(text);
                    break;
                case OPCODE_BINARY:
                    this.config.onData(applicationData);
                    break;
                case OPCODE_CLOSE:
                    this.onClosed();
                    if (this.closing) {
                        this.onClosed = () => { };
                        this.stream.destroy?.();
                    } else {
                        this.closing = true;
                        this.close();
                    }
                    break;
                case OPCODE_PONG:
                    break;
                case OPCODE_PING:
                    this.sendPong(applicationData);
                    break;
                case OPCODE_CONTINUATION:
                    this.close("initial frame can't be continuation!");
                    break;
                default:
                    this.close("unhandled websocket opcode 0x" + opcode.toString(16).toUpperCase());
                    break;
            }
        } else {
            if (this.buildingFrame == null)
                this.buildingFrame = { opcode: opcode, dataBuffer: applicationData };
            else {
                if (opcode != OPCODE_CONTINUATION) {
                    this.close("incomplete frame!");
                } else {
                    this.buildingFrame.dataBuffer = joinBuffers(
                        this.buildingFrame.dataBuffer,
                        applicationData
                    );
                }
            }
        }
        return true;
    }

    listen() {
        if (this.closing) return;
        this.stream.read((readInfo) => {
            if (Number(readInfo.resultCode) < 0) {
                this.onClosed();
                this.onClosed = () => { };
                return;
            }
            if (readInfo.data != null) {
                this.dataBuffer = joinBuffers(this.dataBuffer, readInfo.data);
            }
            while (this.consumeFragment());
            // simulate process.nextTick
            Promise.resolve().then(() => this.listen());
        });
    }

    close(errorMessage = '') {
        this.onError(errorMessage);
        const frameData = new Uint8Array(2);
        frameData[0] = 128 | OPCODE_CLOSE;
        frameData[1] = 0;
        this.stream.write?.(frameData, () => {
            if (this.closing) {
                this.onClosed = () => { };
                this.stream.destroy?.();
            } else {
                this.closing = true;
            }
        });
    }

    _sendFrame(opcode: number, data: Uint8Array, masked: boolean, finalFragment: boolean) {
        const payloadLength = data.byteLength;
        const totalSize =
            payloadLength +
            (payloadLength <= 125 ? 1 : payloadLength <= 65535 ? 3 : 5) +
            1;
        const frameData = new Uint8Array(totalSize);
        let i = 0;
        frameData[i++] = (finalFragment == true ? 128 : 0) | (opcode & 0xf);
        if (payloadLength <= 125) {
            frameData[i++] = payloadLength;
        } else if (payloadLength <= 65535) {
            frameData[i++] = 126;
            frameData[i++] = (payloadLength >> 8) & 0xff;
            frameData[i++] = payloadLength & 0xff;
        } else {
            frameData[i++] = 126;
            frameData[i++] = (payloadLength >> 24) & 0xff;
            frameData[i++] = (payloadLength >> 16) & 0xff;
            frameData[i++] = (payloadLength >> 8) & 0xff;
            frameData[i++] = payloadLength & 0xff;
        }
        for (let j = 0; j < payloadLength; j++, i++) {
            frameData[i] = data[j];
        }
        this.stream.write?.(frameData, () => {});
    }

    sendFrame(data: string | Uint8Array) {
        let dataBuffer: Uint8Array;
        let opcode: number;
        if (typeof data == "string") {
            dataBuffer = new Uint8Array(stringToArrayBuffer(data));
            opcode = OPCODE_TEXT;
        } else if (typeof data == "object" && data.byteLength != null) {
            dataBuffer = new Uint8Array(data);
            opcode = OPCODE_BINARY;
        } else {
            console.error("Websocket: tried to send unsupported data!");
            return false;
        }
        const masked = false;
        const finalFragment = true;
        this._sendFrame(opcode, dataBuffer, masked, finalFragment);
        return true;
    }

    sendPong(data: Uint8Array) {
        const dataBuffer = new Uint8Array(data);
        const masked = false;
        const opcode = OPCODE_PONG;
        const finalFragment = true;
        this._sendFrame(opcode, dataBuffer, masked, finalFragment);
    }
    sendPing(data: Uint8Array) {
        const dataBuffer = new Uint8Array(data);
        const masked = false;
        const opcode = OPCODE_PING;
        const finalFragment = true;
        this._sendFrame(opcode, dataBuffer, masked, finalFragment);
    }
}

function arrayBufferToString(buffer: Uint8Array) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
}

function stringToArrayBuffer(str: string) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

function joinBuffers(buffer1: ArrayBuffer, buffer2: ArrayBuffer) {
    const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp;
}
