// Local AI: summarise text and describe images with the built-in Prompt API.
import { byId, message, errorText } from "./shared.js";

const options = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};
const imageOptions = {
  expectedInputs: [{ type: "text", languages: ["en"] }, { type: "image" }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};
const checkButton = byId("ai-check");
const checkSpinner = byId("ai-check-spinner");
const checkResult = byId("ai-check-result");
const runButton = byId("ai-run");
const output = byId("ai-output");
const outputWrap = byId("ai-output-wrap");
const outputOverlay = byId("ai-output-overlay");
let modelAvailability = null;
let availabilityPromise = null;
const setCheckResult = (state, text) => {
  checkResult.dataset.state = state;
  checkResult.textContent = text;
};
const setWorking = (working) => {
  runButton.disabled = working;
  outputWrap.setAttribute("aria-busy", String(working));
  outputOverlay.hidden = !working;
};
async function availability() {
  checkButton.disabled = true;
  checkSpinner.hidden = false;
  setCheckResult("", "");
  try {
    if (!window.LanguageModel)
      throw new Error("LanguageModel is unavailable in this browser.");
    const state = await LanguageModel.availability(options);
    modelAvailability = state;
    if (state === "available") {
      setCheckResult("ready", "✓ Model available");
      message(
        "ai-status",
        "The model is available in this browser. Starting its first session may take a moment.",
      );
    } else if (state === "downloadable") {
      setCheckResult("ready", "✓ Model available · download needed");
      message(
        "ai-status",
        "The browser can download the model when you use it.",
      );
    } else if (state === "downloading") {
      setCheckResult("ready", "✓ Model download in progress");
      message("ai-status", "The browser is downloading its local model.");
    } else {
      setCheckResult("error", "Model unavailable here");
      message("ai-status", `Browser model availability: ${state}.`);
    }
    return state;
  } catch (error) {
    const detail = errorText(error);
    setCheckResult("error", detail);
    message("ai-status", detail);
    return null;
  } finally {
    checkButton.disabled = false;
    checkSpinner.hidden = true;
  }
}
checkButton.addEventListener("click", () => {
  availabilityPromise = availability();
});
runButton.addEventListener("click", async () => {
  setWorking(true);
  let session;
  try {
    if (!window.LanguageModel)
      throw new Error("LanguageModel is unavailable in this browser.");
    if (availabilityPromise) await availabilityPromise;
    if (modelAvailability === "unavailable")
      throw new Error("The local model is unavailable in this browser.");
    message(
      "ai-status",
      modelAvailability === "available"
        ? "Warming up the local model…"
        : "Starting local model setup…",
    );
    session = await LanguageModel.create({
      ...options,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          const percent = Math.round(event.loaded * 100);
          if (modelAvailability === "available")
            message("ai-status", "Warming up the local model…");
          else if (percent <= 0)
            message("ai-status", "Preparing the model download…");
          else if (percent < 100)
            message("ai-status", `Downloading local model… ${percent}%`);
          else
            message(
              "ai-status",
              "Download complete. Loading the model into memory…",
            );
        });
      },
    });
    modelAvailability = "available";
    setCheckResult("ready", "✓ Model available");
    message("ai-status", "Local session started. Summarising in this browser…");
    const answer = await session.prompt(
      `Summarise this customer feedback in one short sentence:\n\n${byId("ai-input").value}`,
    );
    output.textContent = answer;
    message(
      "ai-status",
      "Answered by the browser model. No app AI endpoint was called.",
    );
  } catch (error) {
    output.textContent = "Could not summarise this feedback.";
    message("ai-status", errorText(error));
  } finally {
    session?.destroy?.();
    setWorking(false);
  }
});

const imageFile = byId("ai-image-file");
const imagePreviewWrap = byId("ai-image-preview-wrap");
const imagePreview = byId("ai-image-preview");
const imageRunButton = byId("ai-image-run");
const imageAvailability = byId("ai-image-availability");
const imageOutput = byId("ai-image-output");
const imageOutputWrap = byId("ai-image-output-wrap");
const imageOverlay = byId("ai-image-overlay");
let imagePreviewUrl;
imageFile.addEventListener("change", () => {
  const file = imageFile.files?.[0];
  if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
  if (!file) {
    imagePreviewUrl = null;
    imagePreview.removeAttribute("src");
    imagePreviewWrap.classList.add("hidden");
    return;
  }
  imagePreviewUrl = URL.createObjectURL(file);
  imagePreview.src = imagePreviewUrl;
  imagePreviewWrap.classList.remove("hidden");
});
imageRunButton.addEventListener("click", async () => {
  const image = imageFile.files?.[0];
  if (!image) {
    imageAvailability.textContent = "Choose an image first.";
    return;
  }
  imageRunButton.disabled = true;
  imageOutputWrap.setAttribute("aria-busy", "true");
  imageOverlay.hidden = false;
  let session;
  try {
    if (!window.LanguageModel)
      throw new Error("LanguageModel is unavailable in this browser.");
    imageAvailability.textContent = "Checking image input support…";
    const imageModelAvailability =
      await LanguageModel.availability(imageOptions);
    if (imageModelAvailability === "unavailable")
      throw new Error("This browser or device does not support image input.");

    message("ai-status", "Starting a local multimodal session…");
    session = await LanguageModel.create({
      ...imageOptions,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          const percent = Math.round(event.loaded * 100);
          message(
            "ai-status",
            percent > 0 && percent < 100
              ? `Preparing local model… ${percent}%`
              : "Loading the local model…",
          );
        });
      },
    });
    imageAvailability.textContent =
      "✓ Image input supported · answering locally";
    const answer = await session.prompt([
      {
        role: "user",
        content: [
          { type: "text", value: byId("ai-image-question").value },
          { type: "image", value: image },
        ],
      },
    ]);
    imageOutput.textContent = answer;
    message(
      "ai-status",
      "Answered from text and image by the local browser model.",
    );
  } catch (error) {
    imageOutput.textContent = "Could not analyse this image.";
    imageAvailability.textContent = errorText(error);
    message("ai-status", errorText(error));
  } finally {
    session?.destroy?.();
    imageRunButton.disabled = false;
    imageOutputWrap.setAttribute("aria-busy", "false");
    imageOverlay.hidden = true;
  }
});

availabilityPromise = availability();
