import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
try {
  await page.goto("http://localhost:5173");
  await page
    .locator("#files")
    .setInputFiles([
      {
        name: "roto.png",
        mimeType: "image/png",
        buffer: Buffer.from("invalid"),
      },
    ]);
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("inválidos"),
  );
  assert.equal(await page.locator(".card").count(), 0);
  const results = await page.evaluate(async () => {
    const { makeWord, makeZip } = await import("/src/exports.js");
    const { canvasFor } = await import("/src/images.js");
    const { default: JSZip } = await import(
      "/node_modules/.vite/deps/jszip.js"
    );
    const items = [];
    for (const type of ["image/jpeg", "image/webp"]) {
      const c = document.createElement("canvas");
      c.width = 120;
      c.height = 240;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 120, 240);
      ctx.fillStyle = "black";
      ctx.fillText("8", 50, 30);
      const file = new File(
        [await new Promise((r) => c.toBlob(r, type))],
        "foto." + type.split("/")[1],
        { type },
      );
      items.push({ number: 8, file, rotation: 90, region: null });
    }
    const c = await canvasFor(items[0]);
    const zip = await JSZip.loadAsync(
      await (await makeZip(items)).arrayBuffer(),
    );
    const names = Object.keys(zip.files);
    const originals = [];
    for (let i = 0; i < items.length; i++) {
      const a = new Uint8Array(await items[i].file.arrayBuffer());
      const b = await zip.file(names[i]).async("uint8array");
      originals.push(a.length === b.length && a.every((v, j) => v === b[j]));
    }
    const word = await JSZip.loadAsync(
      await (await makeWord(items)).arrayBuffer(),
    );
    const xml = await word.file("word/document.xml").async("string");
    const jpeg = Array.from(new Uint8Array(await items[0].file.arrayBuffer()));
    return {
      w: c.width,
      h: c.height,
      names,
      originals,
      drawings: (xml.match(/<w:drawing>/g) || []).length,
      media: Object.keys(word.files).filter((n) =>
        /^word\/media\/[^/]+$/.test(n),
      ),
      jpeg,
    };
  });
  assert.equal(results.w, 240);
  assert.equal(results.h, 120);
  assert.deepEqual(results.names, ["008.jpg", "008_2.webp"]);
  assert.deepEqual(results.originals, [true, true]);
  assert.equal(results.drawings, 2);
  assert.ok(results.media.every((n) => n.endsWith(".png")));
  await page
    .locator("#files")
    .setInputFiles({
      name: "rotacion.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(results.jpeg),
    });
  await page.waitForFunction(
    () => document.querySelectorAll(".card").length === 1,
  );
  await page.locator(".thumb").click();
  await page.locator("#rotate").click();
  await page.waitForFunction(() => !document.querySelector("#rotate").disabled);
  await page.locator("#close").click();
  await page.locator("#recognize").click();
  await page.locator("#stop").click();
  await page.waitForFunction(
    () => document.querySelector("#status").textContent.startsWith("Detenido"),
    { timeout: 120000 },
  );
  assert.equal(await page.locator("#recognize").isEnabled(), true);
  assert.equal(await page.locator(".card input[type=number]").inputValue(), "");
  console.log(
    "PASS: archivo dañado, JPEG/WEBP, giros, ZIP intacto y duplicados, conversión Word, detener y recuperar interfaz.",
  );
} finally {
  await browser.close();
}
