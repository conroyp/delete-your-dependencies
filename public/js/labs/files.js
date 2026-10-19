// Real files: open, edit and save a file on disk with the File System Access API.
import { byId, message, errorText } from "./shared.js";

let handle;
const editor = byId("file-editor");
byId("file-open").addEventListener("click", async () => {
  if (!window.showOpenFilePicker) {
    message(
      "file-status",
      "Direct file access is unavailable here. Try a current Chromium browser over HTTPS.",
    );
    return;
  }
  try {
    [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: "Text files",
          accept: { "text/plain": [".txt", ".md", ".json"] },
        },
      ],
    });
    const file = await handle.getFile();
    editor.value = await file.text();
    byId("file-name").textContent = file.name;
    byId("file-save").disabled = false;
    message(
      "file-status",
      `Opened ${file.name}. Edit it, then save back to the same file.`,
    );
  } catch (error) {
    message("file-status", errorText(error));
  }
});
byId("file-save").addEventListener("click", async () => {
  try {
    const writable = await handle.createWritable();
    await writable.write(editor.value);
    await writable.close();
    message("file-status", `Saved ${handle.name} back to disk.`);
  } catch (error) {
    message("file-status", errorText(error));
  }
});
byId("file-download").addEventListener("click", () => {
  const blob = new Blob(
    ["# The Daily Grind menu\n\nFlat White: lovely\nOat Latte: also lovely\n"],
    { type: "text/markdown" },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "daily-grind-menu.md";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  message(
    "file-status",
    "Sample downloaded. Open that file to try editing it in place.",
  );
});
