export const byId = (id) => document.getElementById(id);

export const message = (id, value) => {
  if (byId(id)) byId(id).textContent = value;
};

export const errorText = (error) =>
  error?.name === "NotAllowedError"
    ? "Permission was declined."
    : error?.message || String(error);
