// Pickup lamp: drive a Bluetooth bulb over Web Bluetooth GATT writes.
import { byId, message, errorText } from "./shared.js";

const hexToRgb = (hex) =>
  [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
const serviceIds = [0xff0d, 0xff02];
const colourId = 0xfffc;
const pulseLevels = [0.22, 0.36, 0.54, 0.76, 1, 0.76, 0.54, 0.36];
const rainbowColours = [
  [255, 0, 0],
  [255, 100, 0],
  [255, 220, 0],
  [0, 255, 0],
  [0, 180, 255],
  [0, 0, 255],
  [140, 0, 255],
  [255, 0, 160],
];
// Dots and dashes for each letter and digit. Other characters are skipped.
// prettier-ignore
const morseCode = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.",
  H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.",
  O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-",
  V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-",
  5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
};
// Letters are separated by spaces and words by " / ", e.g. "Hi Ava" → ".... .. / .- ...- .-".
const toMorse = (text) =>
  text
    .toUpperCase()
    .split(/\s+/)
    .map((word) =>
      [...word]
        .map((character) => morseCode[character])
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join(" / ");
const state = {
  device: null,
  colour: null,
  writing: Promise.resolve(),
  rgb: [0, 255, 0],
  white: 0,
  effect: "steady",
  effectRun: 0,
  morseName: "",
};
const connectButton = byId("lamp-connect");
const disconnectButton = byId("lamp-disconnect");
const colourButtons = [...document.querySelectorAll(".lamp-colour")];
const effectSelect = byId("lamp-effect");
const pipButton = byId("lamp-pip");
let pipWindow = null;
const code = byId("lamp-code");
const codeLabel = byId("lamp-code-label");
const writeMethod = () =>
  state.colour?.properties.writeWithoutResponse
    ? "writeValueWithoutResponse"
    : "writeValueWithResponse";
const syncPip = () => {
  if (!pipWindow) return;
  const doc = pipWindow.document;
  doc.querySelectorAll("button").forEach((button) => {
    button.disabled = !state.colour;
    const active = button.dataset.effect
      ? button.dataset.effect === state.effect
      : colourButtons[button.dataset.index].dataset.active === "true";
    button.setAttribute("aria-pressed", String(active));
  });
  doc.getElementById("pip-status").textContent =
    byId("lamp-status").textContent;
};
const stopEffect = () => {
  state.effectRun++;
  state.effect = "steady";
  effectSelect.value = "steady";
  syncPip();
};
const setConnected = (connected) => {
  connectButton.disabled = connected;
  disconnectButton.disabled = !connected;
  colourButtons.forEach((button) => {
    button.disabled = !connected;
  });
  byId("lamp-send-custom").disabled = !connected;
  effectSelect.disabled = !connected;
  if (!connected)
    colourButtons.forEach((button) => {
      button.dataset.active = "false";
    });
  syncPip();
};
const disconnected = () => {
  stopEffect();
  state.device = state.colour = null;
  setConnected(false);
  message("lamp-device", "Not connected");
  message("lamp-status", "Lamp disconnected.");
};
const enqueueWrite = (write) => {
  state.writing = state.writing.catch(() => {}).then(write);
  return state.writing;
};
const writeColour = (bytes) => {
  const colour = state.colour;
  if (!colour) throw new Error("Connect a lamp first.");
  return enqueueWrite(() =>
    colour.properties.writeWithoutResponse
      ? colour.writeValueWithoutResponse(bytes)
      : colour.writeValueWithResponse(bytes),
  );
};
const sendColour = async (rgb, white = 0) => {
  stopEffect();
  const bytes = new Uint8Array([white, ...rgb]);
  codeLabel.textContent = "one colour write";
  code.textContent = `// One colour, one GATT write. No timer.\n// enqueueWrite waits for the previous GATT operation.\nconst bytes = new Uint8Array([${[...bytes].join(", ")}]);\nawait enqueueWrite(() => colour.${writeMethod()}(bytes));`;
  await writeColour(bytes);
  state.rgb = rgb;
  state.white = white;
  colourButtons.forEach((button) => {
    button.dataset.active =
      button.dataset.rgb === rgb.join(",") &&
      Number(button.dataset.white || 0) === white
        ? "true"
        : "false";
  });
  syncPip();
};
connectButton.addEventListener("click", async () => {
  if (!navigator.bluetooth) {
    message(
      "lamp-status",
      "Web Bluetooth is unavailable in this browser. Use Chrome or Edge over HTTPS.",
    );
    return;
  }
  connectButton.disabled = true;
  message("lamp-status", "Choose your lamp in the browser dialog…");
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [serviceIds[0]] },
        { services: [serviceIds[1]] },
        { namePrefix: "PLAYBULB" },
      ],
      optionalServices: serviceIds,
    });
    device.addEventListener("gattserverdisconnected", disconnected);
    message("lamp-status", "Connecting…");
    const server = await device.gatt.connect();
    const service = await server
      .getPrimaryService(serviceIds[0])
      .catch(() => server.getPrimaryService(serviceIds[1]));
    state.device = device;
    state.colour = await service.getCharacteristic(colourId);
    setConnected(true);
    message("lamp-device", device.name || "Playbulb connected");
    message(
      "lamp-status",
      "Connected. Pick a colour or mark an order ready in another tab.",
    );
    await sendColour([0, 0, 0]);
  } catch (error) {
    if (state.device?.gatt?.connected) state.device.gatt.disconnect();
    disconnected();
    message(
      "lamp-status",
      error?.name === "NotFoundError" ? "No lamp selected." : errorText(error),
    );
  } finally {
    connectButton.disabled = Boolean(state.colour);
  }
});
disconnectButton.addEventListener("click", async () => {
  try {
    await sendColour([0, 0, 0]);
  } catch {}
  if (state.device?.gatt?.connected) state.device.gatt.disconnect();
  disconnected();
});
colourButtons.forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      await sendColour(
        button.dataset.rgb.split(",").map(Number),
        Number(button.dataset.white || 0),
      );
      message("lamp-status", `${button.textContent.trim()} sent to the lamp.`);
    } catch (error) {
      message("lamp-status", errorText(error));
    }
  }),
);
byId("lamp-send-custom").addEventListener("click", async () => {
  const hex = byId("lamp-custom").value;
  try {
    await sendColour(hexToRgb(hex));
    message("lamp-status", `${hex.toUpperCase()} sent to the lamp.`);
  } catch (error) {
    message("lamp-status", errorText(error));
  }
});
byId("lamp-eyedropper").hidden = !window.EyeDropper;
byId("lamp-eyedropper").addEventListener("click", async () => {
  try {
    const { sRGBHex } = await new EyeDropper().open();
    byId("lamp-custom").value = sRGBHex;
    if (!state.colour) {
      message(
        "lamp-status",
        `${sRGBHex.toUpperCase()} picked. Connect a lamp to send it.`,
      );
      return;
    }
    await sendColour(hexToRgb(sRGBHex));
    message(
      "lamp-status",
      `${sRGBHex.toUpperCase()} picked from the screen and sent to the lamp.`,
    );
  } catch (error) {
    message(
      "lamp-status",
      error?.name === "AbortError"
        ? "Colour picking cancelled."
        : errorText(error),
    );
  }
});
// Returns false, leaving the current effect running, if there is nothing to send.
const startMorse = (name) => {
  const morse = toMorse(name?.slice(0, 24) || "");
  if (!morse) {
    effectSelect.value = state.effect;
    if (name !== null)
      message("lamp-status", "Use letters or numbers for Morse code.");
    return false;
  }
  state.morseName = name.trim();
  runMorse(state.morseName, morse);
  return true;
};
const runEffect = async (effect) => {
  if (effect === "morse") {
    startMorse(prompt("Name to flash in Morse code:", state.morseName));
    return;
  }
  if (effect === "steady") {
    try {
      await sendColour(state.rgb, state.white);
      message("lamp-status", "Effect stopped. Steady colour sent once.");
    } catch (error) {
      message("lamp-status", errorText(error));
    }
    return;
  }
  stopEffect();
  const runId = state.effectRun;
  const interval = effect === "pulse" ? 280 : 1000;
  const baseRgb =
    state.rgb.some(Boolean) || state.white ? [...state.rgb] : [0, 255, 0];
  const baseWhite = state.white;
  state.rgb = baseRgb;
  state.effect = effect;
  effectSelect.value = effect;
  codeLabel.textContent = `${effect} · repeated writes`;
  const rainbowList = rainbowColours
    .map((rgb) => `  [${rgb.join(", ")}]`)
    .join(",\n");
  code.textContent =
    effect === "pulse"
      ? `// Each GATT write waits for the previous one.\nconst baseRgb = [${baseRgb.join(", ")}];\nconst baseWhite = ${baseWhite};\nconst levels = [${pulseLevels.join(", ")}];\nconst runId = state.effectRun;\nconst sleep = ms => new Promise(resolve => setTimeout(resolve, ms));\nlet frame = 0;\nwhile (state.effectRun === runId && state.colour) {\n  const level = levels[frame++ % levels.length];\n  const bytes = new Uint8Array([\n    Math.round(baseWhite * level),\n    ...baseRgb.map(value => Math.round(value * level)),\n  ]);\n  await enqueueWrite(() => colour.${writeMethod()}(bytes));\n  await sleep(${interval});\n}`
      : `// Each GATT write waits for the previous one.\nconst colours = [\n${rainbowList},\n];\nconst runId = state.effectRun;\nconst sleep = ms => new Promise(resolve => setTimeout(resolve, ms));\nlet frame = 0;\nwhile (state.effectRun === runId && state.colour) {\n  const rgb = colours[frame++ % colours.length];\n  const bytes = new Uint8Array([0, ...rgb]);\n  await enqueueWrite(() => colour.${writeMethod()}(bytes));\n  await sleep(${interval});\n}`;
  message(
    "lamp-status",
    `${effect === "pulse" ? "Pulse" : "Rainbow"} running in this tab. Choose Steady or a colour to stop.`,
  );
  const frames = effect === "pulse" ? pulseLevels : rainbowColours;
  let frame = 0;
  while (state.effectRun === runId && state.colour) {
    try {
      const bytes =
        effect === "pulse"
          ? new Uint8Array([
              Math.round(baseWhite * frames[frame % frames.length]),
              ...baseRgb.map((value) =>
                Math.round(value * frames[frame % frames.length]),
              ),
            ])
          : new Uint8Array([0, ...frames[frame % frames.length]]);
      await writeColour(bytes);
      frame++;
      await new Promise((resolve) => setTimeout(resolve, interval));
    } catch (error) {
      stopEffect();
      message("lamp-status", errorText(error));
    }
  }
};
// Timings in milliseconds. A dash lasts as long as one rainbow step, and a dot half that.
const morseTiming = { ".": 500, "-": 1000 };
const runMorse = async (name, morse) => {
  stopEffect();
  const runId = state.effectRun;
  const running = () => state.effectRun === runId && state.colour;
  const baseRgb =
    state.rgb.some(Boolean) || state.white ? [...state.rgb] : [0, 255, 0];
  const on = new Uint8Array([state.white, ...baseRgb]);
  const off = new Uint8Array([0, 0, 0, 0]);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  state.rgb = baseRgb;
  state.effect = "morse";
  effectSelect.value = "morse";
  codeLabel.textContent = "morse · timed on/off writes";
  code.textContent = `// ${name} → ${morse}
const morse = "${morse}";
const on = new Uint8Array([${[...on].join(", ")}]);
const off = new Uint8Array([0, 0, 0, 0]);
const timing = { ".": 500, "-": 1000 };
const write = bytes => enqueueWrite(() => colour.${writeMethod()}(bytes));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
while (state.effectRun === runId && state.colour) {
  for (const symbol of morse) {
    if (symbol in timing) {
      await write(on);
      await sleep(timing[symbol]);   // dot or dash
      await write(off);
      await sleep(500);              // gap inside a letter
    } else {
      await sleep(1000);             // " " and "/" stretch the gap between letters and words
    }
  }
  await sleep(3000);                 // pause, then repeat
}`;
  message(
    "lamp-status",
    `Flashing “${name}” in Morse code: ${morse}. Choose Steady or a colour to stop.`,
  );
  try {
    while (running()) {
      for (const symbol of morse) {
        if (!running()) return;
        if (symbol in morseTiming) {
          await writeColour(on);
          await sleep(morseTiming[symbol]);
          // Another colour may have been chosen while this symbol was lit.
          if (!running()) return;
          await writeColour(off);
          await sleep(500);
        } else {
          await sleep(1000);
        }
      }
      await sleep(3000);
    }
  } catch (error) {
    stopEffect();
    message("lamp-status", errorText(error));
  }
};
effectSelect.addEventListener("change", () => runEffect(effectSelect.value));

// A floating colour menu, so the controls stay in reach while scrolled.
pipButton.hidden = !window.documentPictureInPicture;
pipButton.addEventListener("click", async () => {
  if (pipWindow) {
    pipWindow.focus();
    return;
  }
  try {
    pipWindow = await documentPictureInPicture.requestWindow({
      width: 220,
      height: 470,
    });
    const doc = pipWindow.document;
    doc.title = "Lamp colours";
    const style = doc.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      body { margin: 0; padding: 12px; background: #faf1df; color: #123a2a; font: 600 14px/1.3 system-ui, sans-serif; }
      h2 { margin: 12px 0 6px; color: #7c877e; font-size: 10px; letter-spacing: .15em; text-transform: uppercase; }
      h2:first-child { margin-top: 0; }
      button { display: flex; align-items: center; gap: 10px; width: 100%; margin-bottom: 6px; border: 1px solid #d5ddd6; border-radius: 10px; background: #fff; padding: 9px 10px; color: inherit; font: inherit; text-align: left; cursor: pointer; }
      button:hover:not(:disabled), button[aria-pressed="true"] { border-color: #819b89; background: #edf4ed; }
      button:disabled { opacity: .45; cursor: default; }
      input { display: block; width: 100%; margin-bottom: 6px; border: 1px solid #819b89; border-radius: 10px; background: #fff; padding: 9px 10px; color: inherit; font: inherit; outline: none; box-shadow: 0 0 0 3px #f5b22366; }
      .dot { width: 18px; height: 18px; flex: none; border: 1px solid #123a2a26; border-radius: 50%; }
      #pip-status { margin: 10px 0 0; color: #66746b; font-size: 12px; font-weight: 400; }
    `;
    doc.head.append(style);
    const heading = (text) => {
      const element = doc.createElement("h2");
      element.textContent = text;
      return element;
    };
    const colourList = colourButtons.map((source, index) => {
      const button = doc.createElement("button");
      const dot = doc.createElement("span");
      dot.className = "dot";
      dot.style.background = getComputedStyle(
        source.querySelector(".lamp-colour-dot"),
      ).backgroundColor;
      button.dataset.index = index;
      button.append(dot, source.textContent.trim());
      button.addEventListener("click", () => source.click());
      return button;
    });
    // Swap the Morse button for a same-sized text field; Enter sends, Escape cancels.
    const editMorseName = (button) => {
      const input = doc.createElement("input");
      input.type = "text";
      input.maxLength = 24;
      input.value = state.morseName;
      input.placeholder = "Type a name, then Enter";
      input.setAttribute("aria-label", "Name to flash in Morse code");
      let done = false;
      const finish = (name) => {
        if (done) return;
        if (name !== null && !startMorse(name)) return;
        done = true;
        input.replaceWith(button);
        syncPip();
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") finish(input.value);
        if (event.key === "Escape") finish(null);
      });
      input.addEventListener("blur", () => finish(null));
      button.replaceWith(input);
      input.focus();
      input.select();
    };
    const effectList = [...effectSelect.options].map((option) => {
      const button = doc.createElement("button");
      button.dataset.effect = option.value;
      button.textContent = option.textContent;
      button.addEventListener("click", () =>
        option.value === "morse"
          ? editMorseName(button)
          : runEffect(option.value),
      );
      return button;
    });
    const status = doc.createElement("p");
    status.id = "pip-status";
    doc.body.append(
      heading("Colours"),
      ...colourList,
      heading("Effects"),
      ...effectList,
      status,
    );
    pipWindow.addEventListener(
      "pagehide",
      () => {
        pipWindow = null;
      },
      { once: true },
    );
    syncPip();
  } catch (error) {
    message("lamp-status", errorText(error));
  }
});
new MutationObserver(syncPip).observe(byId("lamp-status"), {
  childList: true,
  characterData: true,
  subtree: true,
});
window.addEventListener("pagehide", () => pipWindow?.close(), {
  once: true,
});
if ("BroadcastChannel" in window) {
  const ordersChannel = new BroadcastChannel("daily-grind-orders");
  ordersChannel.addEventListener("message", async ({ data }) => {
    if (data.type !== "order-ready") return;
    console.info(
      `[Daily Grind · pickup lamp] ← RECEIVED on daily-grind-orders: order-ready · order #${data.id}`,
    );
    if (!state.colour) {
      message(
        "lamp-status",
        `Order #${data.id} is ready. Connect a lamp to show the green pickup cue.`,
      );
      return;
    }
    try {
      await sendColour([0, 255, 0]);
      message("lamp-status", `Order #${data.id} ready · lamp turned green.`);
    } catch (error) {
      message("lamp-status", errorText(error));
    }
  });
  window.addEventListener("pagehide", () => ordersChannel.close(), {
    once: true,
  });
}
if (!navigator.bluetooth)
  message(
    "lamp-status",
    "Web Bluetooth is unavailable in this browser. Use Chrome or Edge over HTTPS.",
  );
