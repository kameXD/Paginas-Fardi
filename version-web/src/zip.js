import JSZip from "jszip";
import { exportNames } from "./model.js";

export async function makeZip(pages, progress = () => {}) {
  const zip = new JSZip();
  const names = exportNames(pages);
  for (let i = 0; i < pages.length; i++) {
    zip.file(names[i], await pages[i].file.arrayBuffer());
    progress(i + 1, pages.length);
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
