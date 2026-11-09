import "./style.css";
import { parseNumber, ordered, analyze } from "./model.js";
import { thumbnail, canvasFor } from "./images.js";
import { preparePhoto } from "./imports.js";
import { createRecognizer } from "./ocr.js";
import { makeWord, makeZip, download } from "./exports.js";
const $ = (id) => document.getElementById(id);
let pages = [],
  busy = false,
  stop = false,
  confirmed = false,
  active = null,
  selection = null,
  displayCanvas = null,
  start = null;
const text = (tag, value, cls) => {
  const el = document.createElement(tag);
  el.textContent = value;
  if (cls) el.className = cls;
  return el;
};
function invalidate() {
  confirmed = false;
  $("confirmed").textContent = "El orden aún no está confirmado.";
}
function issues() {
  const a = analyze(pages);
  return [
    a.missing ? `${a.missing} sin número` : null,
    a.pending ? `${a.pending} pendientes de revisión` : null,
    a.duplicates.length ? `Duplicados: ${a.duplicates.join(", ")}` : null,
    a.gaps.length
      ? `Posibles páginas faltantes: ${a.gaps.map(([s, e]) => (s === e ? s : `${s}–${e}`)).join(", ")}`
      : null,
    a.unsorted ? "El orden manual contradice la numeración ascendente" : null,
  ].filter(Boolean);
}
function render() {
  const root = $("cards");
  root.replaceChildren();
  $("count").textContent = `${pages.length} fotografías`;
  $("empty").hidden = pages.length > 0;
  for (const [index, page] of pages.entries()) {
    const card = text("article", "", "card");
    const thumb = text("button", "", "thumb");
    thumb.setAttribute("aria-label", `Ampliar ${page.file.name}`);
    const img = document.createElement("img");
    img.src = page.thumb;
    img.alt = page.file.name;
    thumb.append(img);
    thumb.onclick = () => openReview(page);
    const body = text("div", "", "card-body");
    body.append(text("div", page.file.name, "filename"));
    const info = page.error
      ? `Error: ${page.error}`
      : page.candidates?.length
        ? `OCR: ${page.candidates.map((c) => `${c.number} (${Math.round(c.confidence)} %)`).join(", ")} · revisar`
        : "Sin candidato OCR";
    body.append(text("p", info, "badge"));
    const label = text("label", "Página ");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "999999";
    input.step = "1";
    input.value = page.number ?? "";
    input.setAttribute("aria-label", `Número de ${page.file.name}`);
    input.onchange = () => {
      page.number = parseNumber(input.value);
      page.reviewed = false;
      invalidate();
      render();
    };
    label.append(input);
    body.append(label);
    const review = text("label", " Revisada ");
    const checked = document.createElement("input");
    checked.type = "checkbox";
    checked.checked = page.reviewed;
    checked.onchange = () => {
      page.reviewed = checked.checked;
      invalidate();
      render();
    };
    review.prepend(checked);
    body.append(review);
    if (page.region) body.append(text("small", "Región personalizada"));
    const actions = text("div", "", "actions");
    for (const [title, fn] of [
      ["↑", () => move(index, -1)],
      ["↓", () => move(index, 1)],
      [
        "Eliminar",
        () => {
          URL.revokeObjectURL(page.thumb);
          pages = pages.filter((p) => p !== page);
          invalidate();
          render();
        },
      ],
    ]) {
      const b = text("button", title);
      b.setAttribute("aria-label", `${title} ${page.file.name}`);
      b.onclick = fn;
      actions.append(b);
    }
    body.append(actions);
    card.append(thumb, body);
    root.append(card);
  }
  const warnings = issues();
  $("issues").replaceChildren(...warnings.map((s) => text("p", s, "warning")));
  $("sequence").textContent = pages.length
    ? pages.map((p) => p.number ?? "?").join(" → ")
    : "Sin páginas.";
  lock();
}
function move(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= pages.length) return;
  [pages[i], pages[j]] = [pages[j], pages[i]];
  invalidate();
  render();
}
function lock() {
  for (const el of document.querySelectorAll(
    "#cards input,#cards button,#sort,#confirm,#files,#recognize,#zone,#contrast,#brightness,#rotations,#sharpen",
  ))
    el.disabled =
      busy || ((el.id === "confirm" || el.id === "recognize") && !pages.length);
  $("word").disabled = $("zip").disabled = busy || !confirmed;
  $("stop").disabled = !busy || !recognizing;
}
let recognizing = false;
async function importFiles(files) {
  if (busy) return;
  busy = true;
  lock();
  const failures = [];
  let imported = 0;
  try {
    for (const file of files) {
      $("status").textContent = `Importando ${++imported} de ${files.length}…`;
      try {
        const page = await preparePhoto(file);
        pages.push(page);
        invalidate();
      } catch {
        failures.push(file.name);
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    $("status").textContent =
      `${pages.length} fotografías disponibles.${failures.length ? ` Archivos inválidos o ilegibles: ${failures.join(", ")}.` : ""}`;
  } finally {
    busy = false;
    render();
    $("files").value = "";
  }
}
$("files").onchange = (e) => importFiles(e.target.files);
$("drop").ondragover = (e) => {
  e.preventDefault();
  $("drop").classList.add("over");
};
$("drop").ondragleave = () => $("drop").classList.remove("over");
$("drop").ondrop = (e) => {
  e.preventDefault();
  $("drop").classList.remove("over");
  importFiles(e.dataTransfer.files);
};
$("sort").onclick = () => {
  pages = ordered(pages);
  invalidate();
  render();
};
$("recognize").onclick = async () => {
  if (busy || !pages.length) return;
  busy = recognizing = true;
  stop = false;
  invalidate();
  lock();
  let engine,
    done = 0;
  const targets = pages.filter((p) => !p.reviewed);
  $("progress").max = targets.length || 1;
  $("progress").value = 0;
  try {
    if (!targets.length) {
      $("status").textContent =
        "Todas las fotografías están revisadas. Desmarca las que quieras reconocer otra vez.";
      return;
    }
    $("status").textContent = "Preparando motor OCR local…";
    engine = await createRecognizer();
    const options = {
      zone: $("zone").value,
      contrast: Number($("contrast").value),
      brightness: Number($("brightness").value),
      sharpen: $("sharpen").checked,
      rotations: $("rotations").checked,
    };
    for (const page of targets) {
      if (stop) break;
      $("status").textContent =
        `Procesando ${done + 1} de ${targets.length}: ${page.file.name}`;
      try {
        const result = await engine.recognize(page, options, () => stop);
        if (stop) break;
        page.candidates = result;
        page.number = result.length === 1 ? result[0].number : null;
        page.error = null;
        page.reviewed = false;
      } catch (e) {
        page.error = e.message;
        page.number = null;
      }
      done++;
      $("progress").value = done;
      render();
      await new Promise((r) => setTimeout(r, 0));
    }
    pages = ordered(pages);
    $("status").textContent =
      `${stop ? "Detenido" : "Finalizado"}: ${done} de ${targets.length} procesadas. Revisa los candidatos.`;
  } catch (e) {
    $("status").textContent = `No se pudo iniciar el OCR: ${e.message}`;
  } finally {
    await engine?.terminate();
    busy = recognizing = false;
    render();
  }
};
$("stop").onclick = () => {
  stop = true;
  $("status").textContent = "Deteniendo al finalizar el recorte OCR actual…";
  $("stop").disabled = true;
};
$("confirm").onclick = () => {
  if (!pages.length || busy) return;
  const warnings = issues();
  if (
    window.confirm(
      `Confirma este orden: ${pages.map((p) => p.number ?? "?").join(" → ")}\n${warnings.length ? "\nAdvertencias:\n" + warnings.join("\n") + "\n\n¿Continuar con estos conflictos?" : "\n¿Es correcto? Puedes volver a revisar antes de descargar."}`,
    )
  ) {
    confirmed = true;
    $("confirmed").textContent =
      "Orden confirmado. Cualquier cambio requerirá una nueva confirmación.";
    lock();
  }
};
async function exportFile(kind) {
  if (busy || !confirmed) return;
  busy = true;
  lock();
  const snapshot = pages.map((p) => ({ ...p }));
  try {
    const progress = (n, total) =>
      ($("exportStatus").textContent = `Preparando ${n} de ${total}…`);
    const blob = await (kind === "word"
      ? makeWord(snapshot, progress)
      : makeZip(snapshot, progress));
    download(
      blob,
      kind === "word" ? "hojas-en-orden.docx" : "fotografias-ordenadas.zip",
    );
    $("exportStatus").textContent =
      "Archivo generado. Revisa tu carpeta de descargas.";
  } catch (e) {
    $("exportStatus").textContent =
      `No se pudo exportar: ${e.message}. Prueba con menos fotografías si falta memoria.`;
  } finally {
    busy = false;
    lock();
  }
}
$("word").onclick = () => exportFile("word");
$("zip").onclick = () => exportFile("zip");
$("theme").onclick = () => document.body.classList.toggle("dark");
function paint() {
  if (!displayCanvas) return;
  const c = $("regionCanvas");
  c.width = displayCanvas.width;
  c.height = displayCanvas.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(displayCanvas, 0, 0);
  if (selection) {
    ctx.strokeStyle = "#ef6300";
    ctx.lineWidth = 4;
    ctx.fillStyle = "#ffb34d44";
    ctx.fillRect(
      selection.x * c.width,
      selection.y * c.height,
      selection.w * c.width,
      selection.h * c.height,
    );
    ctx.strokeRect(
      selection.x * c.width,
      selection.y * c.height,
      selection.w * c.width,
      selection.h * c.height,
    );
  }
}
async function openReview(page) {
  if (busy) return;
  active = page;
  $("zoom").value = "1";
  c.style.maxWidth = "100%";
  c.style.width = "auto";
  selection = page.region ? { ...page.region } : null;
  try {
    displayCanvas = await canvasFor(page, 1400);
    paint();
    $("regionStatus").textContent = selection
      ? "Región existente. Puedes dibujar otra."
      : "Sin región seleccionada.";
    $("review").showModal();
  } catch (e) {
    $("status").textContent = e.message;
  }
}
const c = $("regionCanvas");
const point = (e) => {
  const r = c.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
  };
};
c.onpointerdown = (e) => {
  start = point(e);
  c.setPointerCapture(e.pointerId);
};
c.onpointermove = (e) => {
  if (!start) return;
  const end = point(e);
  selection = {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
  paint();
};
c.onpointerup = () => {
  start = null;
  if (selection && (selection.w < 0.01 || selection.h < 0.01)) selection = null;
  paint();
};
c.onpointercancel = () => {
  start = null;
};
$("zoom").oninput = () => {
  c.style.maxWidth = "none";
  c.style.width = `${displayCanvas.width * Number($("zoom").value)}px`;
};
$("close").onclick = () => $("review").close();
$("review").onclose = () => {
  displayCanvas = null;
  active = null;
  c.width = c.height = 1;
};
function apply(all) {
  if (!selection) {
    $("regionStatus").textContent =
      "Dibuja primero un rectángulo sobre el número.";
    return;
  }
  for (const page of all ? pages : [active]) {
    page.region = { ...selection };
    page.reviewed = false;
  }
  invalidate();
  $("zone").value = "custom";
  $("regionStatus").textContent = all
    ? "Región aplicada a todas las fotografías."
    : "Región aplicada a esta fotografía.";
  render();
}
$("applyRegion").onclick = () => apply(false);
$("applyAll").onclick = () => apply(true);
$("clearRegion").onclick = () => {
  active.region = null;
  selection = null;
  active.reviewed = false;
  invalidate();
  paint();
  render();
  $("regionStatus").textContent = "Región eliminada para esta fotografía.";
};
$("rotate").onclick = async () => {
  const b = $("rotate");
  b.disabled = true;
  try {
    active.rotation = (active.rotation + 90) % 360;
    active.region = null;
    selection = null;
    active.reviewed = false;
    URL.revokeObjectURL(active.thumb);
    active.thumb = await thumbnail(active);
    displayCanvas = await canvasFor(active, 1400);
    invalidate();
    paint();
    render();
    $("regionStatus").textContent =
      "Imagen girada. Selecciona de nuevo la región.";
  } catch (e) {
    $("regionStatus").textContent = e.message;
  } finally {
    b.disabled = false;
  }
};
render();
