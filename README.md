# stream-to-websocket-frame
Convert stream data into WebSocket Frame Data, text or binary.

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
var streamToWS = new StreamToWebSocket(
  {
    destroy: () => {
      console.log("destroy");
    },
    write: (data, fn) => {
      console.log("write", data);
      fn({
        resultCode: 0,
      });
    },
    read: (fn) => {
      if (arr.length) {
        fn({
          data: arr.pop(),
        });
      } else {
        fn({
          resultCode: -1,
        });
      }
    },
  },
  {
    onFrame,
    onData,
    onClosed,
  }
);

streamToWS.listen();

```