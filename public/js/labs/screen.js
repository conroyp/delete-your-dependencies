// Screen portal: capture a screen, window or tab, then crop it to a PNG.
import { byId, message, errorText } from "./shared.js";

const video = byId("screen-video");
const canvas = byId("screen-overlay");
const context = canvas.getContext("2d");
let stream;
let selection;
let start;
const resize = () => {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  draw();
};
const draw = () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!selection) return;
  context.fillStyle = "#ed705e55";
  context.strokeStyle = "#ffe17b";
  context.lineWidth = 3;
  context.fillRect(selection.x, selection.y, selection.w, selection.h);
  context.strokeRect(selection.x, selection.y, selection.w, selection.h);
};
canvas.addEventListener("pointerdown", (event) => {
  if (!stream) return;
  canvas.setPointerCapture(event.pointerId);
  start = { x: event.offsetX, y: event.offsetY };
});
canvas.addEventListener("pointermove", (event) => {
  if (!start) return;
  selection = {
    x: Math.min(start.x, event.offsetX),
    y: Math.min(start.y, event.offsetY),
    w: Math.abs(event.offsetX - start.x),
    h: Math.abs(event.offsetY - start.y),
  };
  draw();
});
canvas.addEventListener("pointerup", () => {
  start = null;
  byId("screen-save").disabled =
    !selection || selection.w < 8 || selection.h < 8;
  message("screen-status", "Crop selected. Save it as a PNG.");
});
byId("screen-start").addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    byId("screen-placeholder").hidden = true;
    byId("screen-stop").disabled = false;
    stream.getVideoTracks()[0].addEventListener("ended", stop);
    resize();
    message(
      "screen-status",
      "Screen captured. Drag on the preview to select a region.",
    );
  } catch (error) {
    message("screen-status", errorText(error));
  }
});
function stop() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  selection = null;
  draw();
  byId("screen-stop").disabled = true;
  byId("screen-save").disabled = true;
  byId("screen-placeholder").hidden = false;
  message("screen-status", "Capture stopped.");
}
byId("screen-stop").addEventListener("click", stop);
byId("screen-save").addEventListener("click", () => {
  if (!selection || !video.videoWidth) return;
  const frameScale = Math.min(
    video.clientWidth / video.videoWidth,
    video.clientHeight / video.videoHeight,
  );
  const frameWidth = video.videoWidth * frameScale;
  const frameHeight = video.videoHeight * frameScale;
  const frameX = video.offsetLeft + (video.clientWidth - frameWidth) / 2;
  const frameY = video.offsetTop + (video.clientHeight - frameHeight) / 2;
  const cropX = Math.max(frameX, selection.x);
  const cropY = Math.max(frameY, selection.y);
  const cropRight = Math.min(frameX + frameWidth, selection.x + selection.w);
  const cropBottom = Math.min(frameY + frameHeight, selection.y + selection.h);
  if (cropRight <= cropX || cropBottom <= cropY) {
    message("screen-status", "Choose a region inside the video preview.");
    return;
  }
  const output = document.createElement("canvas");
  output.width = Math.round((cropRight - cropX) / frameScale);
  output.height = Math.round((cropBottom - cropY) / frameScale);
  output
    .getContext("2d")
    .drawImage(
      video,
      (cropX - frameX) / frameScale,
      (cropY - frameY) / frameScale,
      output.width,
      output.height,
      0,
      0,
      output.width,
      output.height,
    );
  output.toBlob((blob) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "screen-portal-crop.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  message("screen-status", `Saved a ${output.width} × ${output.height} crop.`);
});
window.addEventListener("resize", resize);
window.addEventListener("pagehide", () =>
  stream?.getTracks().forEach((track) => track.stop()),
);
