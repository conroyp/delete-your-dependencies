# The Daily Grind ☕ — delete your dependencies

**A coffee shop built from the browser alone: no frameworks, no plugins, no backend.** Cameras, Bluetooth lamps, receipt printers, local files, on-device AI and multi-tab sync, all from APIs that ship in the browser you already have.

Built as the live demo for the talk **[Delete your dependencies: what the browser can do now](https://www.conroyp.com/speaking/delete-your-dependencies-what-the-browser-can-do-now)**.

It's plain HTML and small, readable JavaScript modules, so open DevTools and read along. Every demo checks for API support and tells you when your browser can't do something yet.

## Run it

You need Node.js. Then:

```sh
npm install
npm run dev        # builds the CSS, then serves on http://localhost:8788
```

Use a current **Chrome or Edge on desktop** for the widest coverage. `localhost` counts as a secure context, so camera, screen and Bluetooth prompts work locally. Anywhere else, serve over HTTPS.

To deploy to Cloudflare Workers Static Assets, run `npx wrangler login` and then `npm run deploy`. Or publish the `public/` folder to any static host.

> [!WARNING]
> **Check the Worker name before you deploy.** `wrangler.jsonc` names the Worker `delete-your-dependencies`. If your Cloudflare account already has a Worker with that name, `npm run deploy` **replaces it without asking**. To deploy under a different name, change `"name"` in `wrangler.jsonc` first. The site will then be at `https://<name>.<your-subdomain>.workers.dev`.

## What's inside

Every demo runs on the user's device. Nothing is uploaded, and order data lives in this browser's `localStorage`.

### The counter: multi-tab sync without a server

**APIs:** BroadcastChannel · Web Locks · cross-document View Transitions · Navigation API · Clipboard

- **Try:** open the counter in two tabs, place an order in one, and watch it appear in the other.
- **Try:** open an order and press **Move to next stage**. Every open tab updates.
- **Try:** click an order number and watch it morph into the detail page heading. This is a real page navigation, not a SPA.
- **Watch:** the badge in the bottom-left corner. Only one tab holds the Web Lock and "polls". Close that tab and another one takes over.

### Screen portal: capture and crop your screen

**APIs:** Screen Capture (`getDisplayMedia`) · Canvas

- **Try:** choose a tab or window, drag a box over the preview, and save the crop as a PNG.

### Camera & codes: smile for a discount

**APIs:** `getUserMedia` · MediaPipe Face Landmarker (WASM, in a Web Worker) · FaceDetector · BarcodeDetector

- **Needs:** a network connection the first time. MediaPipe's engine and face model (about 17 MB) come from jsDelivr and Google's model storage, then run entirely on your device.

- **Try:** start the camera, hold still until the box is steady, then smile for one second to unlock `SMILE10`, and press **Order with discount**.
- **Try:** **Try native FaceDetector** shows what the built-in API can do. It finds faces but can't read expressions, which is why the smile check uses MediaPipe.
- **Try:** hold the loyalty QR code up to the camera and press **Scan live QR**, or upload the image instead.

### Real files: edit a file on disk

**APIs:** File System Access (`showOpenFilePicker`, `createWritable`)

- **Try:** **Download a sample**, open it with **Open a file**, edit it, then **Save changes**. The change is written back to the same file on disk.

### Private storage: a filesystem only your site can see

**APIs:** Origin Private File System (`navigator.storage.getDirectory()`)

- **Try:** **Write to OPFS**, reload the page, then **Read from OPFS**. **Delete note** removes it.

### Local AI: an LLM in the browser

**APIs:** Prompt API (`LanguageModel`), with text and image input

- **Try:** **Summarise locally** on the sample feedback. Then upload a photo and press **Ask about the image**.
- The model runs in the browser, and no AI endpoint is called. The first run may download the model.

### The extras: small APIs that remove whole libraries

**APIs:** Screen Wake Lock · Document Picture-in-Picture · EyeDropper · Web Share

- **Try:** **Keep awake** stops the screen from sleeping.
- **Try:** **Open floating queue** opens an always-on-top pickup queue. Change an order in another tab and it updates live.
- **Try:** **Pick a colour** picks a colour from anywhere on your screen.
- **Try:** **Share the shop** opens the operating system's share sheet.

### Pickup lamp: a Bluetooth bulb, controlled from a web page

**APIs:** Web Bluetooth (GATT) · BroadcastChannel · EyeDropper · Document PiP

- **Needs:** a MiPow Playbulb, or any bulb that takes `[white, r, g, b]` writes on characteristic `0xFFFC`.
- **Try:** **Connect lamp**, send colours, or pick one from the screen with the eyedropper. Choose **Pulse**, **Rainbow** or **Morse code** (it asks for a name, then flashes it) from the Effect menu.
- **Try:** **Colour menu** opens the colours and effects in a floating Document PiP window, so they stay in reach while you scroll.
- **Try:** mark an order _ready_ in another tab. The lamp turns green.
- The code panel shows the exact bytes written for each command.

### Bluetooth print: a receipt printer with no driver

**APIs:** Web Bluetooth · Canvas (image to 1-bit raster) · ESC/POS commands

- **Needs:** a BLE receipt printer that accepts ESC/POS. The default UUIDs are service `FF00` and characteristic `FF02`; change them to match your printer.
- **Try:** **Connect printer**, then **Print sample** for a logo and greeting. Supported browsers reconnect to a printer you've used before without asking again.

## Browser support

These APIs move quickly, so check before relying on one.

| Works broadly                                                                                                  | Chromium only                                               | Behind a flag, or rolling out                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BroadcastChannel, Web Locks, OPFS, Screen Capture, `getUserMedia`, View Transitions, Wake Lock, Navigation API | Web Bluetooth, File System Access, EyeDropper, Document PiP | FaceDetector (`chrome://flags/#enable-experimental-web-platform-features`), Prompt API (depends on version and device), BarcodeDetector (macOS, Android and ChromeOS only), Bluetooth `getDevices()` |

Web Share works best on mobile and in Safari. Desktop support varies by operating system.

## Project map

```
public/                      the whole site (deploy this folder)
  index.html, order.html     the counter and order detail pages
  lab-*.html                 one page per browser-lab demo
  js/runtime.js              localStorage order store (window.dailyGrindOrders)
  js/orders.js               counter: BroadcastChannel, Web Locks, live updates
  js/app.js                  entry point: loads only the current page's demo
  js/get-the-code.js         homepage "Get the code" QR, poppable via Document PiP
  js/labs/*.js               one module per lab demo (lamp.js, camera.js, …)
  js/face-detector.js        main-thread side of the face worker
  face-landmarker.worker.js  MediaPipe (from jsDelivr) running off the main thread
  images/                    logos, promo art and the sample loyalty QR
src/app.css                  Tailwind source → public/build/assets/app.css
```

After editing a page or `src/app.css`, run `npm run build` to rebuild the stylesheet. `dev` and `deploy` do this automatically.

## Licence

MIT, see [LICENSE](LICENSE). MediaPipe, loaded from a CDN by the camera demo, is Apache 2.0.
