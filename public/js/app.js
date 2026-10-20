import "./runtime.js";
import "./orders.js";

// Each lab page loads only its own demo module.
const labs = {
  "lab-screen": "./labs/screen.js",
  "lab-camera": "./labs/camera.js",
  "lab-files": "./labs/files.js",
  "lab-storage": "./labs/storage.js",
  "lab-ai": "./labs/ai.js",
  "lab-lamp": "./labs/lamp.js",
  "lab-print": "./labs/print.js",
  "lab-extras": "./labs/extras.js",
};
const lab = labs[document.body.dataset.page];
if (lab) import(lab);
if (document.getElementById("code-qr-pip")) import("./get-the-code.js");
