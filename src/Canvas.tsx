import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  useState
} from "react";

import * as React from "react";

import { CanvasEvents, W, CanvasColors } from "./consts";
import { myImageData } from "./ImageData";

type CanvasProps = {
  canvasWidth: number;
  canvasHeight: number;
  onClick: (x: number, y: number) => void;
  onMove?: (p: Point) => void;
  onScale?: (scale: number) => void;
};

type Point = {
  x: number;
  y: number;
};

const ORIGIN = Object.freeze({ x: 0, y: 0 });

// adjust to device to avoid blur
const ratio = window.devicePixelRatio;

function diffPoints(p1: Point, p2: Point) {
  return { x: p1.x - p2.x, y: p1.y - p2.y };
}

function addPoints(p1: Point, p2: Point) {
  return { x: p1.x + p2.x, y: p1.y + p2.y };
}

function scalePoint(p1: Point, scale: number) {
  return { x: p1.x / scale, y: p1.y / scale };
}

const ZOOM_SENSITIVITY = 500; // bigger for lower zoom per scroll

interface ExtWindow {
  BG_FRAMES: Array<{
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
  }>;
}

export default function Canvas(props: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<Point>(ORIGIN);
  const [mousePos, setMousePos] = useState<Point>(ORIGIN);
  const [viewportTopLeft, setViewportTopLeft] = useState<Point>(ORIGIN);
  const isResetRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<Point>(ORIGIN);
  const lastOffsetRef = useRef<Point>(ORIGIN);
  const [myColor, setMyColor] = useState<number>(0);

  // update last offset
  useEffect(() => {
    lastOffsetRef.current = offset;
  }, [offset]);

  // reset
  const reset = useCallback((context: CanvasRenderingContext2D) => {
    if (context && !isResetRef.current) {
      // adjust for device pixel density
      //context.canvas.width = props.canvasWidth * ratio;
      //context.canvas.height = props.canvasHeight * ratio;
      context.resetTransform();
      context.scale(ratio * 0.15, ratio * 0.15);
      setScale(0.15);

      // reset state and refs
      setContext(context);
      setOffset(ORIGIN);

      setMousePos(ORIGIN);
      setViewportTopLeft(ORIGIN);
      lastOffsetRef.current = ORIGIN;
      lastMousePosRef.current = ORIGIN;

      // this thing is so multiple resets in a row don't clear canvas
      isResetRef.current = true;
    }
  }, []);

  // functions for panning
  const mouseMove = useCallback(
    (event: MouseEvent) => {
      if (context) {
        const lastMousePos = lastMousePosRef.current;
        const currentMousePos = { x: event.pageX, y: event.pageY }; // use document so can pan off element
        lastMousePosRef.current = currentMousePos;

        const mouseDiff = diffPoints(currentMousePos, lastMousePos);
        setOffset((prevOffset) => addPoints(prevOffset, mouseDiff));
      }
    },
    [context]
  );

  const mouseUp = useCallback(() => {
    document.removeEventListener("mousemove", mouseMove);
    document.removeEventListener("mouseup", mouseUp);
  }, [mouseMove]);

  const startPan = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      document.addEventListener("mousemove", mouseMove);
      document.addEventListener("mouseup", mouseUp);
      lastMousePosRef.current = { x: event.pageX, y: event.pageY };
    },
    [mouseMove, mouseUp]
  );

  // setup canvas and set context
  useLayoutEffect(() => {
    if (canvasRef.current) {
      // get new drawing context
      const renderCtx = canvasRef.current.getContext("2d");

      if (renderCtx) {
        reset(renderCtx);
      }
    }
  }, [reset]);

  // pan when offset or scale changes
  useLayoutEffect(() => {
    if (context && lastOffsetRef.current) {
      const offsetDiff = scalePoint(
        diffPoints(offset, lastOffsetRef.current),
        scale
      );
      context.translate(offsetDiff.x, offsetDiff.y);

      setViewportTopLeft((prevVal) => diffPoints(prevVal, offsetDiff));
      isResetRef.current = false;
    }
  }, [context, offset, scale]);

  function multiplyPoint(point: { x: number; y: number }, matrix: DOMMatrix) {
    return {
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f
    };
  }

  const draw = React.useCallback(
    (context: CanvasRenderingContext2D | null, props: CanvasProps) => {
      if (context) {
        props.onScale?.call(null, scale);

        // clear canvas but maintain transform
        const storedTransform = context.getTransform();
        const invTransform = storedTransform.inverse();
        context.canvas.width = context.canvas.width + 0;
        context.setTransform(storedTransform);

        const getPixelVP = (sX: number, sY: number) => {
          return multiplyPoint(
            { x: props.canvasWidth * sX, y: props.canvasHeight * sY },
            invTransform
          );
        };

        const viewportBottomRight = getPixelVP(1, 1);
        const viewportMiddle = getPixelVP(0.5, 0.5);

        let inMemoryCanvas = document.createElement("canvas");
        inMemoryCanvas.width = W;
        inMemoryCanvas.height = W;
        let ctx2 = inMemoryCanvas.getContext("2d");
        if (ctx2) {
          var image1 = context.createImageData(W, W);
          image1.data.set(myImageData.latest);
          ctx2.putImageData(image1, 0, 0);

          context.imageSmoothingEnabled = false;
          context.drawImage(inMemoryCanvas, 0, 0);
        }

        context.beginPath();
        context.lineWidth = 0.25;
        context.rect(
          Math.floor(viewportMiddle.x) - 0.5,
          Math.floor(viewportMiddle.y) - 0.5,
          2,
          2
        );
        context.stroke();

        let leftMiddle = getPixelVP(0, 0.5);
        let rightMiddle = getPixelVP(1, 0.5);
        context.beginPath();
        context.lineWidth = 0.25;
        context.rect(
          leftMiddle.x,
          leftMiddle.y,
          rightMiddle.x - leftMiddle.x,
          Math.min(Math.max(2 / scale, 0), W)
        );
        context.fillStyle = "rgba(0,0,0,128)";
        context.fill();

        let topMiddle = getPixelVP(0.5, 0);
        let bottomMiddle = getPixelVP(0.5, 1);
        context.beginPath();
        context.lineWidth = 0.25;
        context.rect(
          topMiddle.x,
          topMiddle.y,
          Math.min(Math.max(2 / scale, 0), W),
          bottomMiddle.y - topMiddle.y
        );
        context.fillStyle = "rgba(0,0,0,128)";
        context.fill();

        context.fillStyle = "rgba(" + CanvasColors[myColor].join(",") + ",255)";
        context.fillRect(
          Math.floor(viewportMiddle.x) - 0,
          Math.floor(viewportMiddle.y) - 0,
          1,
          1
        );
        props.onMove?.call(null, {
          x: Math.floor(viewportMiddle.x),
          y: Math.floor(viewportMiddle.y)
        });

        /* const radius = 5;
    context.fillStyle = "red";
    context.beginPath();
    context.arc(viewportTopLeft.x, viewportTopLeft.y, radius, 0, 2 * Math.PI);
    context.fill();
    context.beginPath();
    context.arc(viewportBottomRight.x, viewportBottomRight.y, radius, 0, 2 * Math.PI);
    context.fill();
    context.beginPath();
    context.arc(W / 2, W / 2, radius, 0, 2 * Math.PI);
    context.fill(); */
      }
    },
    [myColor, scale]
  );

  // draw
  useLayoutEffect(() => {
    draw(context, props);
  }, [context, scale, offset, viewportTopLeft, myColor, draw, props]);

  // add event listener on canvas for mouse position
  useEffect(() => {
    const canvasElem = canvasRef.current;
    if (canvasElem === null) {
      return;
    }

    function handleUpdateMouse(event: MouseEvent) {
      event.preventDefault();
      if (canvasRef.current) {
        const viewportMousePos = { x: event.clientX, y: event.clientY };
        const topLeftCanvasPos = {
          x: canvasRef.current.offsetLeft,
          y: canvasRef.current.offsetTop
        };
        setMousePos(diffPoints(viewportMousePos, topLeftCanvasPos));
      }
    }

    canvasElem.addEventListener("mousemove", handleUpdateMouse);
    canvasElem.addEventListener("wheel", handleUpdateMouse);
    return () => {
      canvasElem.removeEventListener("mousemove", handleUpdateMouse);
      canvasElem.removeEventListener("wheel", handleUpdateMouse);
    };
  }, []);

  function ZoomSamePixel(
    context: CanvasRenderingContext2D | null,
    scale = 0.5
  ) {
    if (context) {
      // clear canvas but maintain transform
      let storedTransform = context.getTransform();
      let invTransform = storedTransform.inverse();

      const viewportMiddlePixel_old = multiplyPoint(
        { x: props.canvasWidth / 2, y: props.canvasHeight / 2 },
        invTransform
      );

      context.scale(scale, scale);

      storedTransform = context.getTransform();
      invTransform = storedTransform.inverse();

      const viewportMiddlePixel_new = multiplyPoint(
        { x: props.canvasWidth / 2, y: props.canvasHeight / 2 },
        invTransform
      );

      context.translate(
        viewportMiddlePixel_new.x - viewportMiddlePixel_old.x,
        viewportMiddlePixel_new.y - viewportMiddlePixel_old.y
      );

      setScale((prev) => prev * scale);

      isResetRef.current = false;
    }
  }

  function Zoom(
    context: CanvasRenderingContext2D | null,
    mousePos: { x: number; y: number },
    deltaY = 100
  ) {
    /* if (context) {
      const zoom = 1 - deltaY / ZOOM_SENSITIVITY;
      const viewportTopLeftDelta = {
        x: (mousePos.x / scale) * (1 - 1 / zoom),
        y: (mousePos.y / scale) * (1 - 1 / zoom)
      };
      const newViewportTopLeft = addPoints(
        viewportTopLeft,
        viewportTopLeftDelta
      );
      context.translate(viewportTopLeft.x, viewportTopLeft.y);
      context.scale(zoom, zoom);
      context.translate(-newViewportTopLeft.x, -newViewportTopLeft.y);

      setScale(scale * zoom);
      isResetRef.current = false;
    } */
    ZoomSamePixel(context, 1 - deltaY / ZOOM_SENSITIVITY);
  }

  const getCanvasMiddle = () => ({
    x: (canvasRef.current?.clientHeight || 0) / 2,
    y: (canvasRef.current?.clientWidth || 0) / 2
  });

  // add event listener on canvas for zoom
  useEffect(() => {
    const canvasElem = canvasRef.current;
    if (canvasElem === null) {
      return;
    }

    // this is tricky. Update the viewport's "origin" such that
    // the mouse doesn't move during scale - the 'zoom point' of the mouse
    // before and after zoom is relatively the same position on the viewport
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      Zoom(context, mousePos, event.deltaY);
    }

    canvasElem.addEventListener("wheel", handleWheel);
    return () => canvasElem.removeEventListener("wheel", handleWheel);
  }, [context, mousePos.x, mousePos.y, viewportTopLeft, scale]);

  // add event listener on canvas for clicks
  useEffect(() => {
    const canvasElem = canvasRef.current;
    if (canvasElem === null) {
      return;
    }

    function getMousePos(canvas: HTMLCanvasElement, evt: MouseEvent) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
      };
    }

    function handleClick(event: MouseEvent) {
      event.preventDefault();
      if (context && canvasRef.current) {
        let screen2canvas = context.getTransform().inverse();
        let relMouse = getMousePos(canvasRef.current, event);
        let xyPoint = multiplyPoint(relMouse, screen2canvas);
        xyPoint = { x: Math.floor(xyPoint.x), y: Math.floor(xyPoint.y) };

        //console.log(JSON.stringify(xyPoint));
        if (xyPoint.x > 0 && xyPoint.y > 0 && xyPoint.x < W && xyPoint.y < W) {
          props.onClick(xyPoint.x, xyPoint.y);
        }
        isResetRef.current = false;
      }
    }

    canvasElem.addEventListener("click", handleClick);
    return () => canvasElem.removeEventListener("click", handleClick);
  }, [context, props]);

  useEffect(() => {
    const resetHandler = () => context && reset(context);
    const refreshHandler = () => context && draw(context, props);

    const zoomInHandler = () => context && ZoomSamePixel(context, 2); // Zoom(context, getCanvasMiddle(), -200);
    const zoomOutHandler = () => context && ZoomSamePixel(context, 0.5); // Zoom(context, getCanvasMiddle(), +200);

    const newColorHandler = (e: CustomEventInit) => {
      setMyColor(e.detail);
      //draw by useEffet
    };

    document.addEventListener(CanvasEvents.refresh, refreshHandler);
    document.addEventListener(CanvasEvents.reset, resetHandler);
    document.addEventListener(CanvasEvents.zoomIn, zoomInHandler);
    document.addEventListener(CanvasEvents.zoomOut, zoomOutHandler);
    document.addEventListener(CanvasEvents.setColor, newColorHandler);

    return () => {
      document.removeEventListener(CanvasEvents.refresh, refreshHandler);
      document.removeEventListener(CanvasEvents.reset, resetHandler);
      document.removeEventListener(CanvasEvents.zoomIn, zoomInHandler);
      document.removeEventListener(CanvasEvents.zoomOut, zoomOutHandler);
      document.removeEventListener(CanvasEvents.setColor, newColorHandler);
    };
  });

  return (
    <div style={{ width: "100%", textAlign: "center" }}>
      {/*  <button onClick={() => context && reset(context)}>Reset</button>
      <pre>scale: {scale}</pre>
      <pre>offset: {JSON.stringify(offset)}</pre>
      <pre>viewportTopLeft: {JSON.stringify(viewportTopLeft)}</pre> */}
      <canvas
        onMouseDown={startPan}
        ref={canvasRef}
        width={props.canvasWidth /* ratio */}
        height={props.canvasHeight /* ratio */}
        style={{
          backgroundColor: "lightgrey",
          width: `${props.canvasWidth}px`,
          height: `${props.canvasHeight}px`,
          borderTop: "2px dotted #000",
          borderBottom: "2px dotted #000"
        }}
      ></canvas>
    </div>
  );
}
