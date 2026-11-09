export async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo abrir la imagen."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function canvasFor(page, max = Infinity) {
  const img = await loadImage(page.file);
  const rotated = page.rotation % 180 !== 0;
  const w = rotated ? img.height : img.width,
    h = rotated ? img.width : img.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d");
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((page.rotation * Math.PI) / 180);
  ctx.drawImage(
    img,
    (-img.width * scale) / 2,
    (-img.height * scale) / 2,
    img.width * scale,
    img.height * scale,
  );
  return c;
}
export async function thumbnail(page) {
  const c = await canvasFor(page, 350);
  return new Promise((r) =>
    c.toBlob((b) => r(URL.createObjectURL(b)), "image/jpeg", 0.8),
  );
}
export function crop(source, region, contrast, brightness, sharpen) {
  const c = document.createElement("canvas");
  const sw = source.width * region.w,
    sh = source.height * region.h;
  const factor = Math.min(3, 1400 / Math.max(sw, sh));
  c.width = Math.max(1, Math.round(sw * factor));
  c.height = Math.max(1, Math.round(sh * factor));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(
    source,
    source.width * region.x,
    source.height * region.y,
    sw,
    sh,
    0,
    0,
    c.width,
    c.height,
  );
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const gray = new Uint8ClampedArray(c.width * c.height);
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] =
      (data.data[j] * 0.299 +
        data.data[j + 1] * 0.587 +
        data.data[j + 2] * 0.114 -
        128) *
        contrast +
      128 +
      brightness;
  }
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = y * c.width + x;
      let v = gray[i];
      if (sharpen && x > 0 && y > 0 && x < c.width - 1 && y < c.height - 1)
        v =
          5 * v -
          gray[i - 1] -
          gray[i + 1] -
          gray[i - c.width] -
          gray[i + c.width];
      data.data.set([v, v, v, 255], i * 4);
    }
  ctx.putImageData(data, 0, 0);
  return c;
}
export function blobOf(canvas, type = "image/png") {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("No se pudo convertir la imagen")),
      type,
    ),
  );
}
