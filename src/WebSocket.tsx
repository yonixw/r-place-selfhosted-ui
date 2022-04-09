import { sendEvent } from ".";
import { CanvasEvents, W } from "./consts";
import { myImageData } from "./ImageData";

function getUrlParam(paramName: string): string | null {
  let result = null;
  let urlParamSplit = window.location.href.split("?");
  if (urlParamSplit.length === 2) {
    let params = new URLSearchParams(urlParamSplit[1]);
    return params.get(paramName);
  }

  return result;
}

let _wsUrl =
  getUrlParam("server") ||
  localStorage.getItem("server") ||
  "no-server-found-err";
let _websocket: WebSocket | null = null;

localStorage.setItem(
  "nick",
  localStorage.getItem("nick") || "User" + Math.floor(Math.random() * 10 * 1000)
);
localStorage.setItem("robot", localStorage.getItem("robot") || "0");

let _connMeta = {
  nick: localStorage.getItem("nick") || "err",
  captcha: localStorage.getItem("robot") || "err"
};

type _tp_onMsg = ((this: WebSocket, ev: MessageEvent<Blob>) => any) | null;
type _tp_onClose = ((this: WebSocket, ev: CloseEvent) => any) | null;
type _tp_onError = ((this: WebSocket, ev: Event) => any) | null;

function _connect(
  url: string,
  onmessage: _tp_onMsg,
  onclose: _tp_onClose,
  onerror: _tp_onError
) {
  return new Promise<void>((ok, bad) => {
    if (
      _websocket &&
      (_websocket.readyState !== WebSocket.CLOSED ||
        _websocket.readyState !== WebSocket.CLOSING)
    ) {
      try {
        _websocket.close();
      } catch (error) {
        bad(error);
      }
    }
    _websocket = new WebSocket(url);
    _websocket.onopen = (ev) => {
      ok();
    };
    _websocket.onmessage = onmessage;
    _websocket.onclose = onclose;
    _websocket.onerror = onerror;
  });
}

const ERROR_CODES = {
  PLAYTIME_END: 4000,
  NOT_HUMAN: 4001,
  TOO_FAST: 4002
};

const ERROR_CODE_TEXT: { [key: number]: string } = {
  4000: "Timeout, please refresh",
  4001: "Please captcha again",
  4002: "Too fast! Wait for cooldown"
};

function _ws_onclose(event: CloseEvent) {
  if (event.code === 4000) {
    // try to reconnect
    wsConnect(_connMeta.captcha, _connMeta.nick);
  } else if (event.code > 4001 && event.code < 4003) {
    sendEvent(CanvasEvents.showErr, ERROR_CODE_TEXT[event.code]);
  } else {
    console.log("Other close ", event.code, event.reason);
    sendEvent(CanvasEvents.showMsg, "Connection closed.");
  }
}

const wsMsgCodes = {
  TOO_SOON: 0,
  SET_COLOR: 1,
  FULL_IMAGE: 2
};

function encodeColors(code: number, x: number, y: number, color: number) {
  const encoded = [
    (color << 2) + (x >> 8),
    x & 255,
    y >> 2,
    ((y & 3) << 6) + code
  ];

  return new Uint8Array(encoded);
}

export type WsColorMsg = {
  code: number;
  x: number;
  y: number;
  color: number;
};

const fullUpdate = Math.round(W * W * (3 / 4));

function parseMsg(m = new Uint8Array([])): WsColorMsg {
  let data = { code: -1, x: -1, y: -1, color: -1 };
  if (m.length !== 1 && m.length !== 4 && m.length !== fullUpdate) {
    // Do nothing, return initial -1
  } else if (m.length === 1) {
    data.code = m[0] & 63;
  } else if (m.length === 4) {
    let parsed = [
      m[0] >> 2,
      ((m[0] & 3) << 8) + m[1],
      (m[2] << 2) + (m[3] >> 6),
      m[3] & 63
    ];
    data.color = parsed[0];
    data.x = parsed[1];
    data.y = parsed[2];
    data.code = parsed[3];
  } else if (m.length === fullUpdate) {
    data.code = wsMsgCodes.FULL_IMAGE;
  }
  return data;
}

function _ws_onmessage(message: MessageEvent<Blob>) {
  message.data.arrayBuffer().then((arr) => {
    const uintMsg = new Uint8Array(arr);
    const data = parseMsg(uintMsg);
    console.log("ws data", data);
    if (data.code === wsMsgCodes.TOO_SOON) {
      sendEvent(CanvasEvents.showErr, ERROR_CODE_TEXT[ERROR_CODES.TOO_FAST]);
    } else if (data.code === wsMsgCodes.SET_COLOR) {
      sendEvent(CanvasEvents.applyColor, data);
    } else if (data.code == wsMsgCodes.FULL_IMAGE) {
      myImageData.setZippedImage(uintMsg);
    }
  });
}

function _ws_onerror(ev: Event) {
  console.error("Websocket Error", ev);
  sendEvent(CanvasEvents.showErr, "Connection Error, please refresh");
}

export function wsConnect(captcha: string, nickname: string) {
  return new Promise<void>((ok, bad) => {
    let params = "?" + encodeURI(`captcha=${captcha}&nick=${nickname}`);
    try {
      _connect(_wsUrl + params, _ws_onmessage, _ws_onclose, _ws_onerror)
        .then(() => ok())
        .catch((err) => bad(err));
    } catch (error) {
      console.error("Websocket onConnect Error", error);
      sendEvent(CanvasEvents.showErr, "Connection Error, please refresh");
      bad(error);
    }
  });
}

function sendMessage(data: Uint8Array) {
  if (
    !_websocket ||
    (_websocket &&
      (_websocket.readyState === WebSocket.CLOSED ||
        _websocket.readyState === WebSocket.CLOSING))
  ) {
    wsConnect(_connMeta.captcha, _connMeta.nick).then(() => {
      _websocket?.send(data);
    });
  } else {
    if (_websocket.readyState !== WebSocket.CONNECTING) {
      _websocket?.send(data);
    }
  }
}

export function sendColor(x: number, y: number, color: number) {
  const code = wsMsgCodes.SET_COLOR;
  console.log({ code, x, y, color });
  let data = encodeColors(code, x, y, color);
  sendMessage(data);
}

function sendGetFull() {
  sendMessage(new Uint8Array([wsMsgCodes.FULL_IMAGE]));
}

export function initConnection() {
  sendGetFull();
  setTimeout(() => {
    setInterval(() => sendGetFull(), 5 * 60 * 1000); // try to get 5 each minute
  }, 1000 * (((60 - new Date().getSeconds()) % 10) - 1));
}

initConnection();
