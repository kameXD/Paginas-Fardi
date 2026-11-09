// One public export interface; each format uses the same confirmed snapshot.
export { makeWord } from "./word.js";
export { makeZip } from "./zip.js";

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
