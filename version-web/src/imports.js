import { thumbnail } from "./images.js";

/** Validate and decode a single original without retaining a full-size bitmap. */
export async function preparePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Formato no admitido. Usa JPG, PNG o WEBP.");
  }
  const page = {
    id: crypto.randomUUID(),
    file,
    number: null,
    reviewed: false,
    rotation: 0,
    region: null,
    candidates: [],
  };
  page.thumb = await thumbnail(page);
  return page;
}
