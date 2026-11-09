import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseNumber,
  ordered,
  analyze,
  exportNames,
  candidates,
} from "../src/model.js";
const page = (n) => ({
  number: n,
  reviewed: true,
  file: { type: "image/jpeg" },
});
test("ordena por número y no por nombre o entrada", () =>
  assert.deepEqual(
    ordered([15, 3, 8, 1, null].map(page)).map((p) => p.number),
    [1, 3, 8, 15, null],
  ));
test("rechaza numeración inválida sin inventar números", () => {
  for (const v of ["", 0, -1, "1.5", "abc", "1000000"])
    assert.equal(parseNumber(v), null);
  assert.equal(parseNumber("015"), 15);
});
test("detecta conflictos y saltos sin presumir comienzo en 1", () => {
  const a = analyze([15, 15, 18, null].map(page));
  assert.deepEqual(a.duplicates, [15]);
  assert.deepEqual(a.gaps, [[16, 17]]);
  assert.equal(a.missing, 1);
  assert.equal(analyze([page(18), page(15)]).unsorted, true);
});
test("ZIP conserva números, saltos y extensiones con nombres únicos", () =>
  assert.deepEqual(exportNames([1, 3, 3, null, null].map(page)), [
    "001.jpg",
    "003.jpg",
    "003_2.jpg",
    "sin-numero.jpg",
    "sin-numero_2.jpg",
  ]));
test("OCR conserva múltiples candidatos y rechaza cero", () =>
  assert.deepEqual(candidates("15 15 0 8"), [15, 8]));
