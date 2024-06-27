import { StreamToWebSocket } from './index';

const d = new StreamToWebSocket();

d.on('message', e => console.log('message:', e));
d.on('close', e => console.log('closed:', e));
d.on('error', e => console.log('error:', e));
d.on('frame', e => console.log('frame:', e));

d.emit('data', {
    data: new Uint8Array([
        130, 6, 104, 101,
        108, 108, 111, 33
    ])
})
