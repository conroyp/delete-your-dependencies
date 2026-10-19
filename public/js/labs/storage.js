// Private storage: read and write a note in the Origin Private File System.
import { byId, message, errorText } from "./shared.js";

const getFile = async (create) => {
  const root = await navigator.storage.getDirectory();
  return root.getFileHandle("coffee-note.txt", { create });
};
byId("opfs-write").addEventListener("click", async () => {
  try {
    const file = await getFile(true);
    const writable = await file.createWritable();
    await writable.write(byId("opfs-note").value);
    await writable.close();
    message(
      "opfs-status",
      "Written to the origin private filesystem. Reload, then click Read.",
    );
  } catch (error) {
    message("opfs-status", errorText(error));
  }
});
byId("opfs-read").addEventListener("click", async () => {
  try {
    byId("opfs-note").value = await (
      await getFile(false)
    )
      .getFile()
      .then((file) => file.text());
    message("opfs-status", "Read the note from OPFS.");
  } catch (error) {
    message(
      "opfs-status",
      error?.name === "NotFoundError" ? "No saved note yet." : errorText(error),
    );
  }
});
byId("opfs-delete").addEventListener("click", async () => {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry("coffee-note.txt");
    byId("opfs-note").value = "";
    message("opfs-status", "Private note deleted.");
  } catch (error) {
    message("opfs-status", errorText(error));
  }
});
