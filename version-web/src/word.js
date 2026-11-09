import { Document, Packer, Paragraph, ImageRun } from "docx";
import { canvasFor, blobOf, loadImage } from "./images.js";

export async function makeWord(pages, progress = () => {}) {
  const children = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let data, type, w, h;
    if (page.rotation || page.file.type === "image/webp") {
      const c = await canvasFor(page);
      w = c.width;
      h = c.height;
      data = await (await blobOf(c)).arrayBuffer();
      c.width = c.height = 1;
      type = "png";
    } else {
      const image = await loadImage(page.file);
      w = image.width;
      h = image.height;
      data = await page.file.arrayBuffer();
      type = page.file.type === "image/jpeg" ? "jpg" : "png";
    }
    const scale = Math.min(720 / w, 912 / h);
    children.push(
      new Paragraph({
        pageBreakBefore: i > 0,
        spacing: { before: 0, after: 0, line: 240 },
        children: [
          new ImageRun({
            data,
            type,
            transformation: {
              width: Math.floor(w * scale),
              height: Math.floor(h * scale),
            },
            altText: {
              title: `Página ${page.number ?? "sin número"}`,
              description: page.file.name,
              name: page.file.name,
            },
          }),
        ],
      }),
    );
    progress(i + 1, pages.length);
  }
  return Packer.toBlob(
    new Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 720, bottom: 720, left: 720, right: 720 },
            },
          },
          children,
        },
      ],
    }),
  );
}
