import * as React from "react";
import { render } from "react-dom";
import "./styles.css";
import "react-notifications-component/dist/theme.css";

import { CanvasEvents, W, CanvasColors } from "./consts";
import { AutoUpdate } from "./AutoUpdate";
import Canvas from "./Canvas";
import { myImageData } from "./ImageData";
import { Modal } from "./Modal";
import { ReactNotifications, Store } from "react-notifications-component";

import { sendColor } from "./WebSocket";
import { encode } from "fast-png";

export const sendEvent = (eventname: string, data?: any) =>
  document.dispatchEvent(new CustomEvent(eventname, { detail: data }));

const rootElement = document.getElementById("root");

const AppHeader = (props: { x: number; y: number; scale: number }) => {
  const createBMP = (rawimage: Uint8Array) => {
    const pngBytes = encode({ width: W, height: W, data: rawimage });
    const blob = new Blob([pngBytes], { type: "image/png" });
    const url = window.URL.createObjectURL(blob);
    return url;
  };

  const downloadImage = () => {
    const url = createBMP(myImageData.latest);
    let a = document.createElement("a");
    a.href = url;
    a.download = "r-place-israel.png";
    a.click();
    /* setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 10 * 1000); */
  };

  return (
    <div
      style={{
        height: "calc( 11vh)",
        width: "100vw",
        padding: "0",
        margin: "0",
        overflow: "clip",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center"
        }}
      >
        {" "}
        <button className="btn-1" onClick={() => sendEvent(CanvasEvents.reset)}>
          🔄 Reset
        </button>
        <button className="btn-1  rowsp" onClick={downloadImage}>
          📷 Download
        </button>
        <button
          className="btn-1 rowsp "
          onClick={() => sendEvent(CanvasEvents.zoomIn)}
        >
          🔎 Zoom In
        </button>
        <button
          className="btn-1 "
          onClick={() => sendEvent(CanvasEvents.zoomOut)}
        >
          🔎 Zoom Out
        </button>
      </div>
      <div
        style={{
          width: "100%",
          flexGrow: "1",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <button disabled className="btn-1" style={{ pointerEvents: "none" }}>
          <span style={{ fontWeight: "normal" }}> XY: </span>{" "}
          {Math.floor(props.y)}
          <span style={{ fontWeight: "normal" }}>x</span>
          {Math.floor(props.x)}{" "}
          <span style={{ fontWeight: "normal" }}> Scale: </span>{" "}
          {Math.round((props.scale || 0) * 100) / 100}x
        </button>

        {/*  <button className="btn-1 rowsp" dir="rtl" onClick={() => {}}>
          🤖 Robot?
        </button> */}
      </div>
    </div>
  );
};

const ColorPicker = (props: {
  onChoose: (colorid: number) => void;
  onApply: () => void;
}) => {
  return (
    <div
      className="scroller"
      style={{
        height: "calc( 9vh )",
        padding: "0",
        margin: "0"
      }}
    >
      <div style={{ display: "flex", height: "9vh", maxHeight: "9vh" }}>
        <button className=" btn-1 sqr8vh" onClick={() => props.onApply()}>
          🎨 <br />
          Paint!
        </button>
        <div
          style={{
            overflowY: "auto",

            display: "inline-block"
          }}
        >
          <div style={{}}>
            {CanvasColors.map((_, i) => (
              <button
                key={"color-" + i}
                className={`btn-1  color-${i} sqr`}
                onClick={() => {
                  props.onChoose(i);
                  sendEvent(CanvasEvents.setColor, i);
                }}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const uiNotify = (
  type: "info" | "danger",
  message?: string,
  title?: string | null,
  timeOut?: number | null,
  callback?: () => void | null,
  priority?: boolean
) => {
  Store.addNotification({
    title: "",
    message: message,
    type: type,
    insert: "top",
    container: "top-left",
    animationIn: ["animate__animated", "animate__fadeIn"],
    animationOut: ["animate__animated", "animate__fadeOut"],
    dismiss: {
      duration: 1000,
      onScreen: true
    }
  });
};

const App = () => {
  const [scale, setScale] = React.useState(0);
  const [x, setX] = React.useState(0);
  const [y, setY] = React.useState(0);
  const [selColor, setSelColor] = React.useState(0);

  React.useState(() => {
    function uiNotifyHandlerInfo(details: CustomEventInit) {
      uiNotify("info", details.detail, "", 1000 + Math.random() * 500);
    }

    function uiNotifyHandlerError(details: CustomEventInit) {
      uiNotify("danger", details.detail, "", 1000 + Math.random() * 500);
    }

    function setColorHandler(details: CustomEventInit) {
      const { y, x, color } = details.detail;
      console.log("Got color from server: " + details.detail);
      myImageData.setPixel(x, y, color);
    }

    document.addEventListener(CanvasEvents.showMsg, uiNotifyHandlerInfo);
    document.addEventListener(CanvasEvents.showErr, uiNotifyHandlerError);
    document.addEventListener(CanvasEvents.applyColor, setColorHandler);
    return () => {
      document.removeEventListener(CanvasEvents.showMsg, uiNotifyHandlerInfo);
      document.removeEventListener(CanvasEvents.showErr, uiNotifyHandlerError);
      document.removeEventListener(CanvasEvents.applyColor, setColorHandler);
    };
  });

  return (
    <>
      <ReactNotifications />
      <div style={{ textAlign: "center" }}>
        <h2>r/place - selfhosted</h2>
      </div>
      <AppHeader {...{ x, y, scale }} />
      <AutoUpdate
        rootElement={rootElement}
        getChild={(w, h) => {
          return (
            <Canvas
              key={w + "_" + h + "_"}
              canvasHeight={h * 0.6}
              canvasWidth={w * 1}
              onClick={(x, y) => {}}
              onScale={setScale}
              onMove={(p) => {
                setX(p.x);
                setY(p.y);
              }}
            />
          );
        }}
      />
      <ColorPicker
        onChoose={setSelColor}
        onApply={() => sendColor(x, y, selColor)}
      />
      <div style={{ textAlign: "center", color: "#eaeaea" }}>
        <sub>10.04.2022 v1</sub>
      </div>
      <Modal appElement={rootElement} />
    </>
  );
};

if (rootElement) {
  render(<App />, rootElement);
}
