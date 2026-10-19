// The extras: Wake Lock, Document PiP, EyeDropper, Web Share and the Navigation API.
import { byId, message, errorText } from "./shared.js";

let wakeLock;
let pipWindow;
let pipInterval;
let pipChannel;
const renderPipQueue = (feed) => {
  if (!pipWindow || pipWindow.closed) return;
  const doc = pipWindow.document;
  const list = doc.getElementById("pip-orders");
  list.replaceChildren();
  const active = feed.filter((order) => order.status !== "ready").length;
  doc.getElementById("pip-count").textContent =
    `${active} in progress · ${feed.filter((order) => order.status === "ready").length} ready`;
  for (const order of feed.slice(0, 10)) {
    const row = doc.createElement("div");
    row.className = `order order-${order.status}`;
    const details = doc.createElement("div");
    const title = doc.createElement("strong");
    title.textContent = `#${order.id} · ${order.drink} × ${order.quantity}`;
    const customer = doc.createElement("small");
    customer.textContent = `for ${order.customer}`;
    const badge = doc.createElement("span");
    badge.className = `badge badge-${order.status}`;
    badge.textContent = order.status;
    details.append(title, customer);
    row.append(details, badge);
    list.append(row);
  }
  if (!feed.length) list.textContent = "No orders yet.";
  doc.getElementById("pip-updated").textContent =
    `Updated ${new Date().toLocaleTimeString()}`;
};
const refreshPipQueue = () => {
  if (!pipWindow || pipWindow.closed) return;
  try {
    renderPipQueue(window.dailyGrindOrders.feed());
  } catch (error) {
    pipWindow.document.getElementById("pip-updated").textContent =
      errorText(error);
  }
};
const stopPipUpdates = () => {
  clearInterval(pipInterval);
  pipChannel?.close();
  pipInterval = pipChannel = pipWindow = null;
  message("pip-status", "Window closed.");
};
byId("wake-toggle").addEventListener("click", async () => {
  try {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
      byId("wake-toggle").textContent = "Keep awake";
      message("wake-status", "Released");
    } else {
      if (!navigator.wakeLock) {
        message("wake-status", "Screen Wake Lock unavailable here.");
        return;
      }
      wakeLock = await navigator.wakeLock.request("screen");
      byId("wake-toggle").textContent = "Release wake lock";
      message("wake-status", "Screen wake lock active");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
        byId("wake-toggle").textContent = "Keep awake";
        message("wake-status", "Released by browser");
      });
    }
  } catch (error) {
    message("wake-status", errorText(error));
  }
});
byId("pip-open").addEventListener("click", async () => {
  if (!window.documentPictureInPicture) {
    message("pip-status", "Document PiP unavailable here.");
    return;
  }
  if (pipWindow && !pipWindow.closed) {
    pipWindow.focus();
    return;
  }
  try {
    const pip = await documentPictureInPicture.requestWindow({
      width: 390,
      height: 440,
    });
    pipWindow = pip;
    pip.document.head.innerHTML = `<meta name="viewport" content="width=device-width, initial-scale=1"><title>The Daily Grind · pickup queue</title><style>
              * { box-sizing: border-box; }
              body { margin: 0; height: 100vh; display: flex; flex-direction: column; background: #faf1df; color: #123a2a; font: 14px/1.4 system-ui, sans-serif; }
              header { padding: 18px 20px 14px; border-bottom: 1px solid #d9e0d9; }
              .eyebrow { color: #7c877e; font-size: 10px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
              h1 { margin: 6px 0 2px; font-size: 25px; letter-spacing: -.05em; }
              #pip-count { color: #66746b; font-size: 12px; }
              #pip-orders { flex: 1; overflow: auto; padding: 12px; }
              .order { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; border: 1px solid #dde3dc; border-radius: 10px; background: #fff; padding: 11px 12px; }
              .order-ready { background: #f0f7f0; border-color: #b9d4be; }
              strong, small { display: block; }
              strong { font-size: 13px; font-weight: 650; }
              small { margin-top: 2px; color: #66746b; font-size: 12px; }
              .badge { flex: none; border-radius: 5px; padding: 4px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
              .badge-new { background: #f2e5e0; color: #86544c; }
              .badge-making { background: #f2ecda; color: #816a3d; }
              .badge-ready { background: #dceee0; color: #3d6b52; }
              footer { border-top: 1px solid #d9e0d9; padding: 10px 20px; color: #66746b; font-size: 11px; }
          </style>`;
    pip.document.body.innerHTML =
      '<header><div class="eyebrow">THE DAILY GRIND</div><h1>Live pickup queue</h1><div id="pip-count">Loading orders…</div></header><main id="pip-orders"></main><footer id="pip-updated">Connecting to the counter…</footer>';
    pip.addEventListener("pagehide", stopPipUpdates, { once: true });
    if ("BroadcastChannel" in window) {
      pipChannel = new BroadcastChannel("daily-grind-orders");
      pipChannel.addEventListener("message", ({ data }) => {
        if (
          ![
            "order-created",
            "order-updated",
            "order-ready",
            "orders-feed",
          ].includes(data.type)
        )
          return;
        if (data.type !== "orders-feed")
          console.info(
            `[Daily Grind · PiP queue] ← RECEIVED on daily-grind-orders: ${data.type} · order #${data.id}`,
          );
        refreshPipQueue();
      });
    }
    pipInterval = setInterval(refreshPipQueue, 3000);
    refreshPipQueue();
    message("pip-status", "Live floating queue opened.");
  } catch (error) {
    message("pip-status", errorText(error));
  }
});
window.addEventListener("pagehide", stopPipUpdates, { once: true });
byId("eye-open").addEventListener("click", async () => {
  if (!window.EyeDropper) {
    message("eye-status", "EyeDropper unavailable here.");
    return;
  }
  try {
    const { sRGBHex } = await new EyeDropper().open();
    byId("eye-swatch").style.background = sRGBHex;
    message("eye-status", sRGBHex);
  } catch (error) {
    message("eye-status", errorText(error));
  }
});
byId("share-open").addEventListener("click", async () => {
  if (!navigator.share) {
    message("share-status", "Native sharing unavailable here.");
    return;
  }
  try {
    await navigator.share({
      title: "The Daily Grind",
      text: "Smile for 10% off ☕",
      url: location.origin,
    });
    message("share-status", "Shared.");
  } catch (error) {
    message("share-status", errorText(error));
  }
});

const navigationStatus = byId("navigation-status");
if (navigationStatus && window.navigation) {
  const showPreviousNavigation = () => {
    const destination = sessionStorage.getItem("daily-grind-last-navigation");
    if (destination)
      navigationStatus.textContent = `Last Navigation API destination: ${destination}.`;
  };

  showPreviousNavigation();
  window.addEventListener("pageshow", showPreviousNavigation);

  window.navigation.addEventListener("navigate", (event) => {
    const destination = new URL(event.destination.url).pathname;
    sessionStorage.setItem("daily-grind-last-navigation", destination);
    navigationStatus.textContent = `Navigating to ${destination} with the Navigation API.`;
  });
} else if (navigationStatus) {
  navigationStatus.textContent =
    "Navigation API is unavailable in this browser.";
}
