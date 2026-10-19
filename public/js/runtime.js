/**
 * Local-only storage adapter for the static conference build.
 * Orders belong to this browser origin and are shared between its tabs.
 */
const STORAGE_KEY = "daily-grind-orders-v1";
const menuPrices = {
  "Flat White": 450,
  Cappuccino: 420,
  "Oat Latte": 490,
  Espresso: 300,
  "Matcha Latte": 520,
  "Long Black": 380,
};
const starterOrders = [
  {
    id: 147,
    customer: "Ava",
    drink: "Flat White",
    quantity: 1,
    notes: "Extra hot, please",
    status: "new",
    smile_discount: false,
  },
  {
    id: 148,
    customer: "Noah",
    drink: "Oat Latte",
    quantity: 2,
    notes: "One with cinnamon",
    status: "making",
    smile_discount: false,
  },
  {
    id: 149,
    customer: "Mia",
    drink: "Cappuccino",
    quantity: 1,
    notes: "Chocolate on top",
    status: "new",
    smile_discount: false,
  },
  {
    id: 150,
    customer: "Oliver",
    drink: "Espresso",
    quantity: 2,
    notes: "",
    status: "ready",
    smile_discount: false,
  },
];

function readOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(orders) ? orders : null;
  } catch {
    return null;
  }
}

function saveOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function allOrders() {
  let orders = readOrders();
  if (!orders) {
    orders = starterOrders.map((order) => ({
      ...order,
      unit_price_cents: menuPrices[order.drink],
      updated_at: new Date().toISOString(),
    }));
    saveOrders(orders);
  }
  return orders.sort((first, second) => second.id - first.id);
}

function orderSnapshot(order) {
  const unitPrice = order.unit_price_cents ?? menuPrices[order.drink] ?? 0;
  const subtotal = unitPrice * order.quantity;
  const discount = order.smile_discount ? Math.round(subtotal * 0.1) : 0;
  return {
    ...order,
    unit_price_cents: unitPrice,
    subtotal_cents: subtotal,
    discount_cents: discount,
    total_cents: subtotal - discount,
  };
}

window.dailyGrindOrders = {
  feed() {
    return allOrders().map((order) => ({
      ...orderSnapshot(order),
      url: `/order.html?id=${order.id}`,
    }));
  },
  snapshot(orderId) {
    const order = allOrders().find((item) => item.id === Number(orderId));
    return order ? orderSnapshot(order) : null;
  },
  update(orderId, changes) {
    const orders = allOrders();
    const index = orders.findIndex((order) => order.id === Number(orderId));
    if (index < 0) throw new Error("Order not found");
    orders[index] = {
      ...orders[index],
      ...changes,
      updated_at: new Date().toISOString(),
    };
    saveOrders(orders);
    return orderSnapshot(orders[index]);
  },
  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

function showOrder(order) {
  const root = document.querySelector("[data-order-id]");
  if (!root || !order) return;
  root.dataset.orderId = order.id;
  // view-transition-name is set by the inline script in order.html, before first render.
  const heading = document.querySelector("[data-order-transition]");
  if (heading) heading.textContent = `#${order.id}`;
  document.title = `Order #${order.id} · The Daily Grind`;
  document.querySelector("[data-customer]").textContent = order.customer;
  document.querySelector("[data-drink]").textContent =
    `${order.drink} × ${order.quantity}`;
  document.querySelector("[data-receipt-line]").textContent =
    `${order.drink} × ${order.quantity}`;
  document.querySelector("[data-notes]").textContent =
    order.notes || "Nothing to add. Just coffee.";
  document.querySelector("[data-status]").textContent =
    order.status.toUpperCase();
  document.querySelector("[data-status]").className =
    `status-badge status-${order.status} mt-2`;
  const statusButton = document.querySelector(".js-cycle-status");
  statusButton.dataset.status = order.status;
  const receipt = orderSnapshot(order);
  document.querySelector("[data-subtotal]").textContent = money(
    receipt.subtotal_cents,
  );
  document.getElementById("receipt-discount-row").hidden =
    !order.smile_discount;
  document.querySelector("[data-discount]").textContent =
    `−${money(receipt.discount_cents)}`;
  document.querySelector("[data-total]").textContent = money(
    receipt.total_cents,
  );
}

function money(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}

function bindStaticOrderForm() {
  const form = document.getElementById("order-form");
  if (!form) return;
  const discountField = form.elements.discount_code;
  if (
    new URLSearchParams(location.search).get("discount")?.toUpperCase() ===
    "SMILE10"
  ) {
    discountField.value = "SMILE10";
    discountField.dispatchEvent(new Event("input", { bubbles: true }));
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const discountCode = String(data.get("discount_code") || "")
      .trim()
      .toUpperCase();
    const feedback = document.getElementById("discount-feedback");
    if (discountCode && discountCode !== "SMILE10") {
      feedback.textContent = "Code not recognised.";
      feedback.className = "text-xs text-red-700";
      discountField.focus();
      return;
    }
    const orders = allOrders();
    const drink = String(data.get("drink"));
    const id = Math.max(146, ...orders.map((order) => order.id)) + 1;
    orders.unshift({
      id,
      customer: String(data.get("customer")).trim(),
      drink,
      quantity: Number(data.get("quantity")),
      notes: String(data.get("notes") || "").trim(),
      status: "new",
      smile_discount: discountCode === "SMILE10",
      unit_price_cents: menuPrices[drink],
      updated_at: new Date().toISOString(),
    });
    saveOrders(orders);
    location.assign(`/order.html?id=${id}&created=1`);
  });
}

function startStaticApp() {
  const page = document.body.dataset.page;
  const url = new URL(location.href);
  if (page === "orders") {
    document.getElementById("orders-list")?.replaceChildren();
    bindStaticOrderForm();
    document
      .getElementById("reset-demo-data")
      ?.addEventListener("click", () => {
        window.dailyGrindOrders.reset();
        location.reload();
      });
  }
  if (page === "order-detail") {
    const orderId =
      Number(url.searchParams.get("id")) ||
      Number(document.querySelector("[data-order-id]")?.dataset.orderId);
    const order = allOrders().find((item) => item.id === orderId);
    if (url.searchParams.has("created"))
      document.body.dataset.createdOrderId = String(orderId);
    if (order) showOrder(order);
  }
}

startStaticApp();
