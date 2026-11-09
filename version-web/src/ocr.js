import { createWorker, PSM } from "tesseract.js";
import { canvasFor, crop } from "./images.js";
import { candidates } from "./model.js";
// Single worker and sequential crops limit decoded-image and WASM memory.
export async function createRecognizer() {
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, location.href).href;
  const worker = await createWorker("eng", 1, {
    workerPath: base + "worker.min.js",
    corePath: base,
    langPath: base,
    gzip: true,
    workerBlobURL: false,
  });
  await worker.setParameters({
    tessedit_char_whitelist: "0123456789",
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
  });
  return {
    async recognize(page, options, stopped) {
      const rotations = options.rotations ? [0, 90, 180, 270] : [0];
      const found = new Map();
      for (const rotation of rotations) {
        if (stopped()) break;
        const canvas = await canvasFor(
          { ...page, rotation: (page.rotation + rotation) % 360 },
          2200,
        );
        const regions = page.region
          ? [page.region]
          : options.zone === "full"
            ? [{ x: 0, y: 0, w: 1, h: 1 }]
            : [
                { x: 0, y: 0, w: 0.5, h: 0.2 },
                { x: 0.5, y: 0, w: 0.5, h: 0.2 },
                { x: 0, y: 0.8, w: 0.5, h: 0.2 },
                { x: 0.5, y: 0.8, w: 0.5, h: 0.2 },
              ];
        if (options.zone === "custom" && !page.region)
          throw new Error("Selecciona una región para esta fotografía.");
        for (const region of regions) {
          if (stopped()) break;
          const image = crop(
            canvas,
            region,
            options.contrast,
            options.brightness,
            options.sharpen,
          );
          await worker.setParameters({
            tessedit_pageseg_mode: page.region
              ? PSM.SINGLE_WORD
              : PSM.SPARSE_TEXT,
          });
          const { data } = await worker.recognize(image);
          for (const number of candidates(data.text)) {
            const confidence = Number.isFinite(data.confidence)
              ? data.confidence
              : 0;
            const prev = found.get(number);
            if (!prev || prev.confidence < confidence)
              found.set(number, { number, confidence, rotation });
          }
          image.width = image.height = 1;
        }
        canvas.width = canvas.height = 1;
      }
      return [...found.values()].sort((a, b) => b.confidence - a.confidence);
    },
    terminate: () => worker.terminate(),
  };
}
