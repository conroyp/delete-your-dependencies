const page = document.body.dataset.page;
if (page === "orders" || page === "order-detail") {
  const money = (cents) => `€${(cents / 100).toFixed(2)}`;
  if (page === "orders") {
    const form = document.getElementById("order-form");
    const prices = JSON.parse(form.dataset.prices);
    const drink = form.elements.drink;
    const quantity = form.elements.quantity;
    const code = form.elements.discount_code;
    const updatePrice = () => {
      const count = Math.min(
        9,
        Math.max(1, Number.parseInt(quantity.value, 10) || 1),
      );
      const subtotal = prices[drink.value] * count;
      const typedCode = code.value.trim().toUpperCase();
      const validCode = typedCode === form.dataset.smileCode;
      const discount = validCode ? Math.round(subtotal * 0.1) : 0;
      document.getElementById("order-subtotal").textContent = money(subtotal);
      document.getElementById("order-discount-row").hidden = !validCode;
      document.getElementById("order-discount").textContent =
        `−${money(discount)}`;
      document.getElementById("order-total").textContent = money(
        subtotal - discount,
      );
      document.getElementById("order-submit-total").textContent = money(
        subtotal - discount,
      );
      const feedback = document.getElementById("discount-feedback");
      feedback.textContent = validCode
        ? "✓ Smile code applied"
        : typedCode
          ? "Code not recognised."
          : "Smile for 10% off, then enter your code here.";
      feedback.className = `text-xs ${validCode ? "text-green-800" : typedCode ? "text-red-700" : "text-ink/60"}`;
    };
    [drink, quantity, code].forEach((input) =>
      input.addEventListener("input", updatePrice),
    );
    updatePrice();
  }
  const channel =
    "BroadcastChannel" in window
      ? new BroadcastChannel("daily-grind-orders")
      : null;
  const pollerTabId = crypto.randomUUID();
  const pollerDock = document.createElement("aside");
  pollerDock.className = "poller-dock fixed bottom-4 left-4 z-50";
  pollerDock.innerHTML = `
    <button data-poller-toggle class="flex items-center gap-2 rounded-full border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink shadow-[0_6px_20px_rgba(31,45,38,.12)] transition hover:bg-mint" type="button" aria-expanded="false">
      <span data-poller-dot class="size-2 rounded-full bg-ink/30"></span>
      <span data-poller-short>Listening</span>
    </button>
    <section data-poller-panel class="relative mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-ink/15 bg-white p-4 shadow-[0_12px_36px_rgba(31,45,38,.18)]" hidden>
      <div class="flex items-start justify-between gap-4">
        <p data-poller-label class="text-xs font-black uppercase tracking-wide">Poller status</p>
      </div>
      <button data-poller-close class="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full text-lg leading-none text-ink/55 transition hover:bg-ink/5 hover:text-ink" type="button" aria-label="Close poller details" title="Close">×</button>
      <p data-poller-detail class="mt-2 text-xs text-ink/60">Waiting for the poller lock.</p>
      <button data-force-update class="secondary-btn mt-3" type="button" hidden>Force background data change</button>
    </section>
  `;
  document.body.append(pollerDock);
  const pollerToggle = pollerDock.querySelector("[data-poller-toggle]");
  const pollerPanel = pollerDock.querySelector("[data-poller-panel]");
  const pollerShort = pollerDock.querySelector("[data-poller-short]");
  const pollerDot = pollerDock.querySelector("[data-poller-dot]");
  const pollerLabel = pollerDock.querySelector("[data-poller-label]");
  const pollerDetail = pollerDock.querySelector("[data-poller-detail]");
  const forceUpdateButton = pollerDock.querySelector("[data-force-update]");
  const pollerClose = pollerDock.querySelector("[data-poller-close]");
  const setPollerExpanded = (expanded) => {
    const update = () => {
      pollerToggle.hidden = expanded;
      pollerPanel.hidden = !expanded;
      pollerToggle.setAttribute("aria-expanded", String(expanded));
    };
    if (document.startViewTransition && !document.activeViewTransition) {
      try {
        document.startViewTransition(update);
        return;
      } catch {
        // Fall back to an immediate update when the browser cannot start a transition.
      }
    }
    update();
  };
  pollerToggle.addEventListener("click", () => setPollerExpanded(true));
  pollerClose.addEventListener("click", () => setPollerExpanded(false));
  const pollerTransitionStyle = document.createElement("style");
  pollerTransitionStyle.textContent = `
    .poller-dock { view-transition-name: poller-status; }
    ::view-transition-old(poller-status), ::view-transition-new(poller-status) { animation-duration: 180ms; }
    @media (prefers-reduced-motion: reduce) { ::view-transition-old(poller-status), ::view-transition-new(poller-status) { animation-duration: 1ms; } }
  `;
  document.head.append(pollerTransitionStyle);
  function setPollerOwner(isOwner, detail, ownerName = "another tab") {
    pollerLabel.textContent = isOwner
      ? "This tab owns the poller"
      : `Poller owned by ${ownerName}`;
    pollerDetail.textContent = detail;
    pollerDot.className = `size-2 rounded-full ${isOwner ? "bg-green-700" : "bg-ink/30"}`;
    pollerShort.textContent = isOwner ? "Polling" : "Listening";
    forceUpdateButton.hidden = !isOwner;
  }
  const statuses = ["new", "making", "ready"];
  const tabName =
    page === "orders"
      ? "counter"
      : `order #${document.querySelector("[data-order-id]").dataset.orderId}`;
  const describeMessage = (data) => {
    return `${data.type} · order #${data.id}${data.status ? ` · ${data.status}` : ""}`;
  };
  const sendMessage = (data) => {
    if (!channel) return;
    channel.postMessage(data);
    if (data.type !== "orders-feed")
      console.info(
        `[Daily Grind · ${tabName}] → SENT on daily-grind-orders: ${describeMessage(data)}`,
      );
  };
  if (document.body.dataset.createdOrderId) {
    sendMessage({
      type: "order-created",
      id: Number(document.body.dataset.createdOrderId),
      status: "new",
    });
  }
  const toast = (message) => {
    const element = document.getElementById("toast");
    element.textContent = message;
    element.hidden = false;
    clearTimeout(window.dailyGrindToastTimer);
    window.dailyGrindToastTimer = setTimeout(() => {
      element.hidden = true;
    }, 3500);
  };
  const statusBadge = (element, status) => {
    element.textContent = status.toUpperCase();
    element.className = `status-badge status-${status}${page === "order-detail" ? " mt-2" : ""}`;
  };
  function saveOrder(orderId, payload) {
    const order = window.dailyGrindOrders.update(orderId, payload);
    sendMessage({
      type: "order-updated",
      id: order.id,
      status: order.status,
      order,
    });
    if (payload.status === "ready")
      sendMessage({ type: "order-ready", id: order.id });
    return order;
  }
  function renderDetail(order) {
    document.querySelector("[data-customer]").textContent = order.customer;
    document.querySelector("[data-drink]").textContent =
      `${order.drink} × ${order.quantity}`;
    document.querySelector("[data-notes]").textContent =
      order.notes || "Nothing to add. Just coffee.";
    if (document.getElementById("save-order-details")?.hidden !== false) {
      document.querySelector("[data-customer-input]").value = order.customer;
      document.querySelector("[data-notes-input]").value = order.notes || "";
    }
    statusBadge(document.querySelector("[data-status]"), order.status);
    document.querySelector(".js-cycle-status").dataset.status = order.status;
    document.querySelector("[data-subtotal]").textContent = money(
      order.subtotal_cents,
    );
    document.getElementById("receipt-discount-row").hidden =
      !order.smile_discount;
    document.querySelector("[data-discount]").textContent =
      `−${money(order.discount_cents)}`;
    document.querySelector("[data-total]").textContent = money(
      order.total_cents,
    );
  }
  function refreshDetail() {
    const root = document.querySelector("[data-order-id]");
    const order = window.dailyGrindOrders.snapshot(root.dataset.orderId);
    if (!order) throw new Error("Could not refresh this order");
    renderDetail(order);
    document.getElementById("sync-status").textContent =
      `Updated from browser storage at ${new Date().toLocaleTimeString()}`;
  }
  function renderListFeed(feed) {
    let active = 0;
    for (const item of feed) {
      if (item.status !== "ready") active++;
      let row = document.querySelector(
        `.order-row[data-order-id="${item.id}"]`,
      );
      if (!row) row = createOrderRow(item);
      updateOrderRow(row, item);
      statusBadge(row.querySelector("[data-status]"), item.status);
      row.querySelector(".js-cycle-status").dataset.status = item.status;
      row.dataset.updatedAt = item.updated_at;
      // The feed is newest first, so appending in order keeps the list sorted.
      document.getElementById("orders-list").appendChild(row);
    }
    document.getElementById("live-count").textContent = active;
  }
  function createOrderRow(item) {
    const row = document.createElement("div");
    row.className =
      "order-row group grid gap-3 px-6 py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center";
    row.dataset.orderId = item.id;
    row.dataset.updatedAt = item.updated_at || "";

    const number = document.createElement("a");
    number.href = item.url;
    number.className =
      "order-number flex size-14 items-center justify-center rounded-2xl border border-ink/15 bg-yellow font-black transition group-hover:bg-mint";
    number.style.viewTransitionName = `order-${item.id}`;
    number.textContent = item.id;

    const details = document.createElement("div");
    const title = document.createElement("a");
    title.href = item.url;
    title.className = "order-title text-xl font-black hover:underline";
    const customer = document.createElement("p");
    customer.className = "order-customer text-sm text-ink/60";
    const total = document.createElement("p");
    total.className = "order-total mt-1 text-sm font-semibold";
    details.append(title, customer, total);

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-2";
    const badge = document.createElement("span");
    badge.dataset.status = "";
    statusBadge(badge, item.status);
    const button = document.createElement("button");
    button.className = "action-btn js-cycle-status";
    button.dataset.status = item.status;
    button.setAttribute("aria-label", `Change status for order ${item.id}`);
    button.textContent = "Next →";
    bindCycleButton(button);
    actions.append(badge, button);
    row.append(number, details, actions);
    return row;
  }
  function updateOrderRow(row, item) {
    const title = row.querySelector(".order-title");
    title.replaceChildren(document.createTextNode(`${item.drink} `));
    const quantity = document.createElement("span");
    quantity.className = "text-base text-ink/45";
    quantity.textContent = `× ${item.quantity}`;
    title.append(quantity);

    row.querySelector(".order-customer").textContent =
      `for ${item.customer}${item.notes ? ` · ${item.notes}` : ""}`;

    const total = row.querySelector(".order-total");
    total.replaceChildren(document.createTextNode(money(item.total_cents)));
    if (item.smile_discount) {
      const discount = document.createElement("span");
      discount.className = "text-green-800";
      discount.textContent = " · smile discount";
      total.append(discount);
    }
  }
  async function fetchFeed() {
    const feed = window.dailyGrindOrders.feed();
    if (page === "orders") renderListFeed(feed);
    sendMessage({ type: "orders-feed", feed });
    pollerDetail.textContent = `Last feed broadcast ${new Date().toLocaleTimeString()}`;
  }
  forceUpdateButton.addEventListener("click", async () => {
    const saveButtonLabel = forceUpdateButton.textContent;
    forceUpdateButton.disabled = true;
    forceUpdateButton.textContent = "Updating…";
    try {
      const feed = window.dailyGrindOrders.feed();
      const order = feed.find((item) => item.status !== "ready") ?? feed[0];
      if (!order) throw new Error("No order is available to update.");
      const note = `Background update at ${new Date().toLocaleTimeString()}`;
      const originalCustomer = order.customer.replace(/^(?:✨😵‍💫\s*)+/, "");
      saveOrder(order.id, {
        customer: `✨😵‍💫 ${originalCustomer}`,
        notes: note,
      });
      await fetchFeed();
      toast(
        `Background data changed for order #${order.id}; this poller broadcast the feed.`,
      );
    } catch (error) {
      toast(error.message);
    } finally {
      forceUpdateButton.disabled = false;
      forceUpdateButton.textContent = saveButtonLabel;
    }
  });
  function bindCycleButton(button) {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const next =
        statuses[
          (statuses.indexOf(button.dataset.status) + 1) % statuses.length
        ];
      button.disabled = true;
      try {
        const id =
          page === "order-detail"
            ? Number(document.querySelector("[data-order-id]").dataset.orderId)
            : Number(button.closest(".order-row").dataset.orderId);
        const order = saveOrder(id, { status: next });
        if (page === "order-detail") renderDetail(order);
        else {
          statusBadge(
            button.closest(".order-row").querySelector("[data-status]"),
            order.status,
          );
          button.dataset.status = order.status;
        }
        toast(`Order #${id} is ${next}. Other tabs have been notified.`);
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }
  document.querySelectorAll(".js-cycle-status").forEach(bindCycleButton);
  if (page === "order-detail") {
    const root = document.querySelector("[data-order-id]");
    const editButton = document.getElementById("edit-order");
    const saveButton = document.getElementById("save-order-details");
    const editStatus = document.getElementById("order-edit-status");
    const cancelEdit = document.getElementById("cancel-order-edit");
    const customerDisplay = document.querySelector("[data-customer]");
    const customerInput = document.querySelector("[data-customer-input]");
    const notesDisplay = document.querySelector("[data-notes]");
    const notesInput = document.querySelector("[data-notes-input]");
    const setEditing = (editing) => {
      customerDisplay.hidden = editing;
      customerInput.hidden = !editing;
      notesDisplay.hidden = editing;
      notesInput.hidden = !editing;
      editButton.hidden = editing;
      saveButton.hidden = !editing;
      cancelEdit.hidden = !editing;
      if (editing) customerInput.focus();
    };

    editButton.addEventListener("click", () => {
      customerInput.value = customerDisplay.textContent;
      notesInput.value =
        notesDisplay.textContent === "Nothing to add. Just coffee."
          ? ""
          : notesDisplay.textContent;
      editStatus.textContent = "";
      setEditing(true);
    });

    cancelEdit.addEventListener("click", () => {
      setEditing(false);
      editStatus.textContent = "";
    });

    saveButton.addEventListener("click", async () => {
      const customer = customerInput.value.trim();
      if (!customer) {
        editStatus.textContent = "Enter a customer name before saving.";
        customerInput.focus();
        return;
      }

      saveButton.disabled = true;
      editStatus.textContent = "Saving order details…";
      try {
        const order = saveOrder(Number(root.dataset.orderId), {
          customer,
          notes: notesInput.value.trim(),
        });
        renderDetail(order);
        setEditing(false);
        editStatus.textContent = "Saved.";
        document.getElementById("sync-status").textContent =
          "Saved. Other open order pages are updating.";
        toast(`Order #${order.id} details saved.`);
      } catch (error) {
        editStatus.textContent = error.message;
      } finally {
        saveButton.disabled = false;
      }
    });

    document
      .getElementById("copy-order-link")
      .addEventListener("click", async () => {
        await navigator.clipboard.writeText(location.href);
        toast("Order link copied.");
      });
    document
      .getElementById("copy-pickup-code")
      .addEventListener("click", async () => {
        await navigator.clipboard.writeText(`GRIND-${root.dataset.orderId}`);
        toast(`Pickup code GRIND-${root.dataset.orderId} copied.`);
      });
  }
  channel?.addEventListener("message", async ({ data }) => {
    if (data.type === "poller-owner") {
      setPollerOwner(
        data.tabId === pollerTabId,
        data.tabId === pollerTabId
          ? "Polling every 2 seconds and sharing each feed over BroadcastChannel."
          : `${data.tabName} is polling every 2 seconds and sharing the feed.`,
        data.tabName,
      );
      return;
    }
    if (data.type === "poller-released") {
      setPollerOwner(
        false,
        "The poller lock was released; waiting for the next owner.",
      );
      return;
    }
    if (data.type !== "orders-feed")
      console.info(
        `[Daily Grind · ${tabName}] ← RECEIVED on daily-grind-orders: ${describeMessage(data)}`,
      );
    if (data.type === "order-updated" || data.type === "order-created") {
      if (
        page === "order-detail" &&
        Number(data.id) ===
          Number(document.querySelector("[data-order-id]").dataset.orderId)
      ) {
        try {
          if (data.order) {
            renderDetail(data.order);
            document.getElementById("sync-status").textContent =
              `Received the order update at ${new Date().toLocaleTimeString()}`;
          } else {
            refreshDetail();
          }
          toast(`Order #${data.id} changed in another tab.`);
        } catch (error) {
          toast(error.message);
        }
      } else if (page === "orders") {
        try {
          await fetchFeed();
        } catch (error) {
          toast(error.message);
        }
      }
    }
    if (data.type === "orders-feed" && page === "orders")
      renderListFeed(data.feed);
  });
  if (page === "orders") fetchFeed().catch(() => {});
  // Hold one browser lock across the polling loop. Another tab takes over when this one closes.
  if (navigator.locks && channel) {
    let stop;
    const stopped = new Promise((resolve) => {
      stop = resolve;
    });
    window.addEventListener("pagehide", () => stop(), { once: true });
    document.getElementById("poll-status").textContent =
      "Waiting for the poller lock in this browser…";
    setPollerOwner(false, "Waiting for this tab to receive the Web Lock.");
    navigator.locks
      .request("daily-grind-orders-poller", async () => {
        setPollerOwner(
          true,
          "Polling every 2 seconds and sharing each feed over BroadcastChannel.",
        );
        document.getElementById("poll-status").textContent =
          "This tab holds the Web Lock and polls for orders.";
        const announceOwnership = () =>
          channel.postMessage({
            type: "poller-owner",
            tabId: pollerTabId,
            tabName: tabName === "counter" ? "the counter tab" : tabName,
          });
        announceOwnership();
        const timer = setInterval(() => {
          announceOwnership();
          fetchFeed().catch(() => {});
        }, 2000);
        await fetchFeed().catch(() => {});
        await stopped;
        clearInterval(timer);
        channel.postMessage({ type: "poller-released", tabId: pollerTabId });
        setPollerOwner(false, "This tab released the Web Lock.");
      })
      .catch(() => {});
  } else {
    setPollerOwner(
      true,
      "Web Locks unavailable; this tab polls every 2 seconds.",
    );
    forceUpdateButton.hidden = false;
    document.getElementById("poll-status").textContent =
      "Web Locks or BroadcastChannel unavailable here.";
    if (page === "orders") {
      fetchFeed().catch(() => {});
      setInterval(() => fetchFeed().catch(() => {}), 2000);
    }
  }
}
