// Serve production beneath a repository-like subpath to exercise Pages URLs.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("dist");
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!path.startsWith("/Paginas-Fardi/")) throw new Error("Ruta inválida");
    const file = resolve(
      root,
      path.slice("/Paginas-Fardi/".length) || "index.html",
    );
    if (!file.startsWith(root + "/")) throw new Error("Ruta inválida");
    const body = await readFile(file);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".wasm": "application/wasm",
        ".gz": "application/gzip",
      }[extname(file)] || "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("No encontrado");
  }
}).listen(5180, "127.0.0.1", () =>
  console.log("Servidor de prueba de subruta iniciado en puerto 5180"),
);
