# stream-to-websocket-frame
Convert stream data into WebSocket Frame Data, text or binary, works both in Node.js and Browser.

## Usage

```js

var arr = [new Uint8Array([130, 6, 104, 101, 108, 108, 111, 33])];
var onFrame = (frame) => {
  console.log("frame", frame);
};
var onData = (data) => {
  console.log("data", data);
};
var onClosed = () => {
  console.log("closed");
};

const stream = {
  destroy: () => {
    console.log("destroy");
  },
  write: (data, callback) => {
    console.log("write", data);
    callback({
      resultCode: 0,
    });
  },
  read: (callback) => {
    if (arr.length) {
      callback({
        data: arr.pop(),
      });
    } else {
      callback({
        resultCode: -1,
      });
    }
  },
};

var streamToWS = new StreamToWebSocket(stream, { onFrame, onData, onClosed });
streamToWS.listen();

```

The output is:

```
frame Uint8Array(6) [ 104, 101, 108, 108, 111, 33 ]
closed
write ArrayBuffer { [Uint8Contents]: <88 00>, byteLength: 2 }
destroy
```
