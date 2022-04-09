import { sendEvent } from ".";
import { CanvasEvents, W, CanvasColors } from "./consts";
import { sendColor } from "./WebSocket";

const initImage = () => {
  let data = new Uint8Array(W * W * 4);
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < W; j++) {
      data[4 * (i * 1024 + j)] = 255;
      data[4 * (i * 1024 + j) + 1] = 255;
      data[4 * (i * 1024 + j) + 2] = 255;
      data[4 * (i * 1024 + j) + 3] = 255;
    }
  }
  return data;
};

function _3bytes_to4colors(arr: Uint8Array | number[], i: number) {
  let result = [
    arr[i] >> 2,
    ((arr[i] & 3) << 4) + (arr[i + 1] >> 4),
    ((arr[i + 1] & 15) << 2) + (arr[i + 2] >> 6),
    arr[i + 2] & 63
  ];
  return result;
}

function unzipImageBuffer(arr: Uint8Array | number[]) {
  const count = Math.ceil(arr.length / 3);
  let result = new Array(count * 4).fill(0);
  for (let i = 0; i < count; i++) {
    let bigagain = _3bytes_to4colors(arr, i * 3);
    for (let j = 0; j < 4; j++) {
      result[i * 4 + j] = bigagain[j];
    }
  }
  return result;
}

let _image = initImage();

function updateColorRefresh(x: number, y: number, colorId: number) {
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof colorId !== "number"
  ) {
    console.error("Bad params update: ", x, y, colorId);
    return;
  } else {
    x = Math.floor(x); // Integer
    y = Math.floor(y);
    colorId = Math.floor(colorId);
    if (
      x < 0 ||
      x >= W ||
      y < 0 ||
      y >= W ||
      colorId < 0 ||
      colorId >= CanvasColors.length
    ) {
      console.error("Bad params update: ", x, y, colorId);
      return;
    }
  }
  let realIndex = (y * 1024 + x) * 4;
  let color = CanvasColors[colorId];
  for (let i = 0; i < 3; i++) {
    _image[realIndex + i] = color[i];
  }
  _image[realIndex + 3] = 255;
  console.log({ x, y, colorId });
  sendEvent(CanvasEvents.refresh);
}

function setZippedImage(unzipped: Uint8Array | number[]) {
  let colorArr = unzipImageBuffer(unzipped);

  for (let i = 0; i < colorArr.length; i++) {
    let colorData = colorArr[i];
    if (colorData < 0 || colorData > 23) {
      colorData = 20;
    }
    let colorID = CanvasColors[colorData];
    for (let j = 0; j < 3; j++) {
      // no alpha
      _image[i * 4 + j] = colorID[j];
    }
  }

  sendEvent(CanvasEvents.refresh);
}

export const myImageData = {
  latest: _image,
  setPixel: updateColorRefresh,
  setZippedImage
};
