// Bluetooth print: rasterise a logo and send ESC/POS commands to a BLE printer.
import { byId, message, errorText } from "./shared.js";

const serviceInput = byId("printer-service");
const characteristicInput = byId("printer-characteristic");
const widthInput = byId("printer-width");
const connectButton = byId("printer-connect");
const disconnectButton = byId("printer-disconnect");
const printButton = byId("printer-print");
const savedDeviceKey = "daily-grind-printer-device-id";
const state = { device: null, characteristic: null };

const setConnected = (connected) => {
  connectButton.disabled = connected;
  disconnectButton.disabled = !connected;
  printButton.disabled = !connected;
};
const disconnect = () => {
  state.device?.gatt?.disconnect();
  state.device = null;
  state.characteristic = null;
  setConnected(false);
  message("printer-device", "No printer connected");
  message("printer-status", "Printer disconnected.");
};
const normalizedUuid = (value, kind) => {
  const uuid = value.trim();
  if (!uuid) throw new Error(`Enter a printer ${kind} UUID.`);
  try {
    return kind === "service"
      ? BluetoothUUID.getService(uuid)
      : BluetoothUUID.getCharacteristic(uuid);
  } catch {
    throw new Error(`The ${kind} UUID is not valid.`);
  }
};

const connectPrinter = async ({ showChooser = true } = {}) => {
  if (!navigator.bluetooth) {
    message(
      "printer-status",
      "Web Bluetooth is unavailable. Try Chrome or Edge over HTTPS.",
    );
    return;
  }
  connectButton.disabled = true;
  let device;
  try {
    const serviceUuid = normalizedUuid(serviceInput.value, "service");
    const characteristicUuid = normalizedUuid(
      characteristicInput.value,
      "characteristic",
    );
    const savedDeviceId = localStorage.getItem(savedDeviceKey);
    if (savedDeviceId && navigator.bluetooth.getDevices) {
      try {
        const permittedDevices = await navigator.bluetooth.getDevices();
        device = permittedDevices.find(({ id }) => id === savedDeviceId);
      } catch {
        // Fall back to the browser chooser if this browser cannot list grants.
      }
    }
    if (device) {
      message("printer-status", "Reconnecting to your saved printer…");
    } else {
      if (!showChooser) {
        message(
          "printer-status",
          "Could not reconnect automatically. Press Connect to choose the printer.",
        );
        return;
      }
      message("printer-status", "Choose the printer in the browser dialog…");
      device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [serviceUuid],
      });
    }
    if (!device.gatt) throw new Error("This device does not expose BLE GATT.");
    message("printer-status", `Connecting to ${device.name || "printer"}…`);
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(serviceUuid);
    const characteristic = await service.getCharacteristic(characteristicUuid);
    if (
      !characteristic.properties.write &&
      !characteristic.properties.writeWithoutResponse
    ) {
      throw new Error("That characteristic does not support writing.");
    }
    localStorage.setItem(savedDeviceKey, device.id);
    state.device = device;
    state.characteristic = characteristic;
    device.addEventListener("gattserverdisconnected", disconnect, {
      once: true,
    });
    setConnected(true);
    message("printer-device", device.name || "Bluetooth printer");
    message(
      "printer-status",
      `Connected. Ready to send to ${characteristicUuid}.`,
    );
  } catch (error) {
    connectButton.disabled = false;
    device?.gatt?.disconnect();
    state.device = null;
    state.characteristic = null;
    setConnected(false);
    message("printer-status", errorText(error));
  } finally {
    connectButton.disabled = Boolean(state.characteristic);
  }
};

connectButton.addEventListener("click", () => connectPrinter());
window.addEventListener("pageshow", () => {
  if (
    !state.characteristic &&
    !connectButton.disabled &&
    localStorage.getItem(savedDeviceKey) &&
    navigator.bluetooth?.getDevices
  ) {
    connectPrinter({ showChooser: false });
  }
});

disconnectButton.addEventListener("click", disconnect);

const createLogoRaster = async (printWidth) => {
  const image = new Image();
  image.src = "/images/square1-logo.svg";
  await image.decode();

  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  sourceContext.fillStyle = "#fff";
  sourceContext.fillRect(0, 0, source.width, source.height);
  sourceContext.drawImage(image, 0, 0);
  const sourcePixels = sourceContext.getImageData(
    0,
    0,
    source.width,
    source.height,
  ).data;
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const pixel = (y * source.width + x) * 4;
      const luminance =
        sourcePixels[pixel] * 0.2126 +
        sourcePixels[pixel + 1] * 0.7152 +
        sourcePixels[pixel + 2] * 0.0722;
      if (luminance < 250) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY)
    throw new Error("The attached mark could not be read as an image.");

  // Crop transparent padding, then center the mark at 82% of the paper width.
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const contentWidth = Math.floor((printWidth * 82) / 100);
  const contentHeight = Math.max(
    1,
    Math.round((cropHeight / cropWidth) * contentWidth),
  );
  const canvas = document.createElement("canvas");
  canvas.width = printWidth;
  canvas.height = contentHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    source,
    minX,
    minY,
    cropWidth,
    cropHeight,
    Math.floor((printWidth - contentWidth) / 2),
    0,
    contentWidth,
    contentHeight,
  );

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const bytesPerRow = Math.ceil(canvas.width / 8);
  const raster = new Uint8Array(bytesPerRow * canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const pixel = (y * canvas.width + x) * 4;
      const luminance =
        data[pixel] * 0.2126 +
        data[pixel + 1] * 0.7152 +
        data[pixel + 2] * 0.0722;
      if (luminance < 232)
        raster[y * bytesPerRow + Math.floor(x / 8)] |= 0x80 >> (x % 8);
    }
  }

  return { raster, bytesPerRow, height: canvas.height };
};

const makePrintJob = async () => {
  const width = Number.parseInt(widthInput.value, 10);
  if (!Number.isInteger(width) || width < 128 || width > 576 || width % 8)
    throw new Error(
      "Choose a print width from 128 to 576 dots, in steps of 8.",
    );
  const { raster, bytesPerRow, height } = await createLogoRaster(width);
  // prettier-ignore
  const command = [
    0x1b, 0x40,             // ESC @ — initialise
    0x1b, 0x64, 4,          // ESC d — top margin: feed four blank lines
    0x1b, 0x61, 1,          // ESC a — centre alignment
    0x1d, 0x76, 0x30, 0,    // GS v 0 — raster bit image
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
    ...raster,
    ...new TextEncoder().encode(
      "\nHello Square1!\nI am a bluetooth printer.\nNice to meet you :)\n",
    ),
    0x1b, 0x64, 6,          // ESC d — bottom margin: feed six blank lines
    0x1b, 0x61, 0,          // ESC a — restore left alignment
  ];
  return new Uint8Array(command);
};

printButton.addEventListener("click", async () => {
  const { characteristic } = state;
  if (!characteristic) return;
  printButton.disabled = true;
  try {
    message("printer-status", "Preparing the logo and receipt…");
    const job = await makePrintJob();
    const chunkSize = 20;
    const chunkCount = Math.ceil(job.length / chunkSize);
    for (let offset = 0, index = 0; offset < job.length; offset += chunkSize) {
      const chunk = job.subarray(offset, offset + chunkSize);
      if (characteristic.properties.writeWithoutResponse)
        await characteristic.writeValueWithoutResponse(chunk);
      else await characteristic.writeValueWithResponse(chunk);
      index++;
      if (index % 25 === 0 || index === chunkCount)
        message(
          "printer-status",
          `Sending receipt… ${Math.round((index / chunkCount) * 100)}%`,
        );
      if (offset + chunkSize < job.length)
        await new Promise((resolve) => setTimeout(resolve, 12));
    }
    message("printer-status", "Receipt sent. Check the printer output.");
  } catch (error) {
    message("printer-status", errorText(error));
  } finally {
    printButton.disabled = !state.characteristic;
  }
});
