// Pops the repo QR code into an always-on-top window, so it can sit over
// slides or another demo while people scan it.
const button = document.getElementById("code-qr-pip");
const qr = document.getElementById("code-qr");
let pipWindow = null;

button.hidden = !window.documentPictureInPicture;
button.addEventListener("click", async () => {
  if (pipWindow) {
    pipWindow.focus();
    return;
  }
  try {
    pipWindow = await documentPictureInPicture.requestWindow({
      width: 340,
      height: 420,
    });
    const doc = pipWindow.document;
    doc.title = "Get the code · The Daily Grind";
    const style = doc.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      body { margin: 0; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 16px; background: #faf1df; color: #123a2a; font: 600 14px/1.3 system-ui, sans-serif; text-align: center; }
      h1 { margin: 0; font-size: clamp(22px, 9vw, 40px); letter-spacing: -.04em; }
      img { width: auto; height: auto; max-width: 100%; min-height: 0; flex: 1; aspect-ratio: 1; border-radius: 12px; }
      p { margin: 0; color: #66746b; font-size: 12px; font-weight: 400; }
    `;
    doc.head.append(style);
    const heading = doc.createElement("h1");
    heading.textContent = "Get the code";
    const image = doc.createElement("img");
    // The PiP document has no URL of its own, so resolve against this page.
    image.src = qr.src;
    image.alt = qr.alt;
    const url = doc.createElement("p");
    url.textContent = "github.com/conroyp/delete-your-dependencies";
    doc.body.append(heading, image, url);
    pipWindow.addEventListener(
      "pagehide",
      () => {
        pipWindow = null;
      },
      { once: true },
    );
  } catch (error) {
    pipWindow = null;
    console.warn("[Daily Grind] Could not open the QR window", error);
  }
});
