import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import JSZip from "jszip";

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ acceptDownloads: true });
const errors = [];
const remoteRequests = [];
page.on("request", (r) => {
  const u = new URL(r.url());
  if (
    ["http:", "https:"].includes(u.protocol) &&
    !["localhost", "127.0.0.1"].includes(u.hostname)
  )
    remoteRequests.push(r.url());
});
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.APP_URL || "http://localhost:5173");
  const photos = await page.evaluate(async () => {
    const result = [];
    for (const n of [15, 3, 8, 1]) {
      const c = document.createElement("canvas");
      c.width = 600;
      c.height = 800;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 600, 800);
      ctx.fillStyle = "black";
      ctx.font = "64px Arial";
      ctx.fillText(String(n), 480, 90);
      result.push({ name: `foto-${n}.png`, data: c.toDataURL().split(",")[1] });
    }
    return result;
  });
  await page.locator("#files").setInputFiles(
    photos.map((p) => ({
      name: p.name,
      mimeType: "image/png",
      buffer: Buffer.from(p.data, "base64"),
    })),
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".card").length === 4,
  );
  await page.locator(".thumb").first().click();
  const canvas = page.locator("#regionCanvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.01);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.99, box.y + box.height * 0.16);
  await page.mouse.up();
  await page.locator("#applyAll").click();
  await page.locator("#close").click();
  assert.equal(
    await page.getByText("Región personalizada", { exact: true }).count(),
    4,
  );
  await page.locator("#recognize").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#status").textContent.startsWith("Finalizado"),
    { timeout: 120000 },
  );
  console.log(
    "OCR:",
    await page.locator("#status").textContent(),
    await page.locator(".badge").allTextContents(),
  );
  const detected = await page
    .locator(".card input[type=number]")
    .evaluateAll((es) => es.map((e) => e.value));
  assert.ok(detected.includes("15"));
  assert.ok(detected.includes("3"));
  assert.ok(detected.includes("8"));
  for (const card of await page.locator(".card").all()) {
    const name = await card.locator(".filename").textContent();
    const input = card.locator("input[type=number]");
    await input.fill(name.match(/\d+/)[0]);
    await input.dispatchEvent("change");
  }
  await page.locator("#sort").click();
  for (const cb of await page.locator(".card input[type=checkbox]").all())
    await cb.check();
  // Correct a number, reveal duplicate, then restore and reveal gaps.
  await page.locator(".card input[type=number]").nth(1).fill("1");
  await page.locator(".card input[type=number]").nth(1).dispatchEvent("change");
  assert.match(await page.locator("#issues").textContent(), /Duplicados: 1/);
  await page.locator(".card input[type=number]").nth(1).fill("3");
  await page.locator(".card input[type=number]").nth(1).dispatchEvent("change");
  await page.locator(".card input[type=checkbox]").nth(1).check();
  assert.match(await page.locator("#issues").textContent(), /2/);
  page.on("dialog", (d) => d.accept());
  await page.locator("#confirm").click();
  assert.equal(await page.locator("#word").isEnabled(), true);
  let pending = page.waitForEvent("download");
  await page.locator("#zip").click();
  let dl = await pending;
  let zip = await JSZip.loadAsync(
    await (await import("node:fs/promises")).readFile(await dl.path()),
  );
  assert.deepEqual(Object.keys(zip.files), [
    "001.png",
    "003.png",
    "008.png",
    "015.png",
  ]);
  for (const p of photos) {
    const n = p.name.match(/\d+/)[0].padStart(3, "0");
    assert.deepEqual(
      await zip.file(`${n}.png`).async("nodebuffer"),
      Buffer.from(p.data, "base64"),
    );
  }
  pending = page.waitForEvent("download");
  await page.locator("#word").click();
  dl = await pending;
  zip = await JSZip.loadAsync(
    await (await import("node:fs/promises")).readFile(await dl.path()),
  );
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /w:w="12240" w:h="15840"/);
  assert.equal((xml.match(/<w:drawing>/g) || []).length, 4);
  assert.equal((xml.match(/<w:pageBreakBefore\/>/g) || []).length, 3);
  assert.equal(
    Object.keys(zip.files).filter((n) => /^word\/media\/[^/]+$/.test(n)).length,
    4,
  );
  await page.locator(".card input[type=number]").first().fill("2");
  await page
    .locator(".card input[type=number]")
    .first()
    .dispatchEvent("change");
  assert.equal(await page.locator("#word").isDisabled(), true);
  // Adding and deleting preserves prior corrections.
  await page.locator("#files").setInputFiles({
    name: "extra.png",
    mimeType: "image/png",
    buffer: Buffer.from(photos[0].data, "base64"),
  });
  await page.waitForFunction(
    () => document.querySelectorAll(".card").length === 5,
  );
  assert.equal(
    await page.locator(".card input[type=number]").first().inputValue(),
    "2",
  );
  await page
    .getByRole("button", { name: "Eliminar extra.png", exact: true })
    .click();
  assert.equal(await page.locator(".card").count(), 4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/hojas-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(remoteRequests, []);
  console.log(
    "PASS: importación, regiones, OCR impreso, correcciones, duplicados, saltos, Word, ZIP original, confirmación, agregar/eliminar y móvil.",
  );
  // Deliberately hand-drawn synthetic strokes; diagnostic, not real handwriting accuracy.
  const diagnostic = process.env.SKIP_DIAGNOSTIC
    ? "Omitido en producción: módulo fuente no publicado"
    : await page.evaluate(async () => {
        const { createRecognizer } = await import("/src/ocr.js");
        const c = document.createElement("canvas");
        c.width = 400;
        c.height = 200;
        const x = c.getContext("2d");
        x.fillStyle = "white";
        x.fillRect(0, 0, 400, 200);
        x.strokeStyle = "black";
        x.lineWidth = 8;
        x.lineCap = "round";
        x.beginPath();
        x.moveTo(170, 65);
        x.lineTo(191, 44);
        x.lineTo(187, 155);
        x.moveTo(221, 45);
        x.lineTo(275, 47);
        x.moveTo(224, 45);
        x.lineTo(220, 94);
        x.bezierCurveTo(290, 67, 298, 171, 220, 149);
        x.stroke();
        const file = new File(
          [await new Promise((r) => c.toBlob(r))],
          "trazos.png",
          { type: "image/png" },
        );
        const engine = await createRecognizer();
        try {
          return await engine.recognize(
            { file, rotation: 0, region: { x: 0, y: 0, w: 1, h: 1 } },
            {
              contrast: 1,
              brightness: 0,
              sharpen: false,
              rotations: false,
              zone: "full",
            },
            () => false,
          );
        } finally {
          await engine.terminate();
        }
      });
  console.log(
    "OCR trazos sintéticos (esperado 15):",
    JSON.stringify(diagnostic),
  );
} finally {
  await browser.close();
}
