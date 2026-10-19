// Camera & codes: MediaPipe smile detection, plus native FaceDetector and BarcodeDetector.
import { FaceDetectorClient } from "../face-detector.js";
import { byId, message, errorText } from "./shared.js";

const video = byId("camera-video");
const canvas = byId("camera-overlay");
const context = canvas.getContext("2d");
let stream;
let detector;
let steadyAnchor;
let steadySince;
let smilingSince;
let unlocked = false;
const steadyHoldMs = 1500;
const smileHoldMs = 1000;
const smileThreshold = 0.65;
const resetTracking = () => {
  steadyAnchor = null;
  steadySince = null;
  smilingSince = null;
  byId("smile-progress").style.width = "0%";
};
const drawFace = (face) => {
  // Resizing a canvas clears it and resets its state, so only do it when needed.
  if (canvas.width !== canvas.clientWidth) canvas.width = canvas.clientWidth;
  if (canvas.height !== canvas.clientHeight)
    canvas.height = canvas.clientHeight;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!face) return;
  const scale = Math.min(
    video.clientWidth / video.videoWidth,
    video.clientHeight / video.videoHeight,
  );
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const offsetX = video.offsetLeft + (video.clientWidth - renderedWidth) / 2;
  const offsetY = video.offsetTop + (video.clientHeight - renderedHeight) / 2;
  context.strokeStyle = unlocked ? "#bce5cc" : "#ffe17b";
  context.lineWidth = 5;
  const mirroredX = 1 - face.box.x - face.box.width;
  context.strokeRect(
    offsetX + mirroredX * renderedWidth,
    offsetY + face.box.y * renderedHeight,
    face.box.width * renderedWidth,
    face.box.height * renderedHeight,
  );
};
const onResult = ({ face, timestamp }) => {
  drawFace(face);
  if (!face) {
    resetTracking();
    message("camera-status", "Step into view. Looking for a face…");
    message("smile-score", "Smile score: —");
    return;
  }
  message("smile-score", `Smile score: ${face.smileScore.toFixed(2)}`);
  if (unlocked) return;
  const box = face.box;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const movement = steadyAnchor
    ? Math.hypot(
        centerX - (steadyAnchor.x + steadyAnchor.width / 2),
        centerY - (steadyAnchor.y + steadyAnchor.height / 2),
      ) / Math.max(box.width, box.height)
    : Infinity;
  const scaleChange = steadyAnchor
    ? Math.abs(
        (box.width * box.height) / (steadyAnchor.width * steadyAnchor.height) -
          1,
      )
    : Infinity;
  if (!steadyAnchor || movement >= 0.08 || scaleChange >= 0.16) {
    steadyAnchor = { ...box };
    steadySince = timestamp;
    smilingSince = null;
  }
  const steadyElapsed = timestamp - steadySince;
  if (steadyElapsed < steadyHoldMs) {
    byId("smile-progress").style.width =
      `${Math.min(40, (steadyElapsed / steadyHoldMs) * 40)}%`;
    message("camera-status", "Face found. Hold still for a moment…");
    return;
  }
  if (face.smileScore < smileThreshold) {
    smilingSince = null;
    byId("smile-progress").style.width = "40%";
    message("camera-status", "Now smile! Hold it for one second.");
    return;
  }
  if (smilingSince === null) smilingSince = timestamp;
  const smileElapsed = timestamp - smilingSince;
  byId("smile-progress").style.width =
    `${Math.min(100, 40 + (smileElapsed / smileHoldMs) * 60)}%`;
  if (smileElapsed < smileHoldMs) {
    message("camera-status", "Keep smiling… nearly there.");
    return;
  }
  unlocked = true;
  byId("smile-apply").disabled = false;
  byId("smile-code").hidden = false;
  drawFace(face);
  message(
    "camera-status",
    "Smile detected! Use code SMILE10 for 10% off your next order.",
  );
};
byId("camera-start").addEventListener("click", async () => {
  byId("camera-start").disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    byId("camera-placeholder").hidden = true;
    ["face-check", "qr-check", "camera-stop"].forEach((id) => {
      byId(id).disabled = false;
    });
    message("camera-status", "Loading the local face model…");
    detector = new FaceDetectorClient(video, {
      intervalMs: 80,
      onResult,
      onError: (error) => message("camera-status", errorText(error)),
    });
    await detector.initialise();
    detector.start();
    message("camera-status", "Camera is live. Step into view and hold still.");
  } catch (error) {
    detector?.destroy();
    detector = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    byId("camera-start").disabled = false;
    message("camera-status", errorText(error));
  }
});
const stop = () => {
  detector?.destroy();
  detector = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  byId("camera-placeholder").hidden = false;
  byId("camera-start").disabled = false;
  ["face-check", "qr-check", "camera-stop"].forEach((id) => {
    byId(id).disabled = true;
  });
  resetTracking();
  message("camera-status", "Camera off.");
};
byId("camera-stop").addEventListener("click", stop);
byId("face-check").addEventListener("click", async () => {
  if (!("FaceDetector" in window)) {
    message(
      "camera-status",
      "Native FaceDetector is unavailable here. The MediaPipe smile detector above still works.",
    );
    return;
  }
  try {
    const faces = await new FaceDetector({ fastMode: true }).detect(video);
    message(
      "camera-status",
      `Native FaceDetector found ${faces.length} face${faces.length === 1 ? "" : "s"}. Smile score comes from MediaPipe.`,
    );
  } catch (error) {
    message("camera-status", errorText(error));
  }
});
byId("qr-check").addEventListener("click", async () => {
  if (!("BarcodeDetector" in window)) {
    message("camera-status", "BarcodeDetector is unavailable in this browser.");
    return;
  }
  try {
    const codes = await new BarcodeDetector({ formats: ["qr_code"] }).detect(
      video,
    );
    message(
      "camera-status",
      codes.length
        ? `QR result: ${codes[0].rawValue}`
        : "No QR code in this frame. Hold one up and try again.",
    );
  } catch (error) {
    message("camera-status", errorText(error));
  }
});
byId("qr-file").addEventListener("change", async (event) => {
  if (!("BarcodeDetector" in window)) {
    message(
      "qr-file-status",
      "BarcodeDetector is unavailable in this browser.",
    );
    return;
  }
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const bitmap = await createImageBitmap(file);
    const codes = await new BarcodeDetector({ formats: ["qr_code"] }).detect(
      bitmap,
    );
    bitmap.close();
    message(
      "qr-file-status",
      codes.length
        ? `Decoded: ${codes[0].rawValue}`
        : "No QR code found in that image.",
    );
  } catch (error) {
    message("qr-file-status", errorText(error));
  }
});
byId("smile-apply").addEventListener("click", () => {
  window.location.assign(byId("smile-apply").dataset.orderUrl);
});
window.addEventListener("pagehide", () => {
  detector?.destroy();
  stream?.getTracks().forEach((track) => track.stop());
});
