// Pure numbering rules shared by UI, exports and tests. Missing numbers stay null.
export function parseNumber(value) {
  const s = String(value).trim();
  return /^\d{1,6}$/.test(s) && Number(s) > 0 ? Number(s) : null;
}
export function ordered(items) {
  return [...items].sort(
    (a, b) => (a.number ?? Infinity) - (b.number ?? Infinity),
  );
}
export function analyze(items) {
  const counts = new Map();
  for (const p of items)
    if (p.number !== null)
      counts.set(p.number, (counts.get(p.number) || 0) + 1);
  const nums = [...counts.keys()].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < nums.length; i++)
    if (nums[i] > nums[i - 1] + 1) gaps.push([nums[i - 1] + 1, nums[i] - 1]);
  return {
    duplicates: [...counts].filter(([, n]) => n > 1).map(([n]) => n),
    missing: items.filter((p) => p.number === null).length,
    pending: items.filter((p) => !p.reviewed).length,
    gaps,
    unsorted: items.some(
      (p, i) =>
        i > 0 && (items[i - 1].number ?? Infinity) > (p.number ?? Infinity),
    ),
  };
}
export function exportNames(items) {
  const used = new Map();
  return items.map((p) => {
    const base =
      p.number === null ? "sin-numero" : String(p.number).padStart(3, "0");
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[p.file.type];
    return `${base}${n > 1 ? `_${n}` : ""}.${ext}`;
  });
}
export function candidates(text) {
  return [
    ...new Set(
      (text.match(/\b\d{1,6}\b/g) || [])
        .map(parseNumber)
        .filter((n) => n !== null),
    ),
  ];
}
