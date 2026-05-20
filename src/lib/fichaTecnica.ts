import fs from "fs/promises";
import path from "path";
import pdf from "pdf-parse";

let cached: { key: string; text: string } | null = null;

async function readPdfText(pdfPath: string) {
  const buf = await fs.readFile(pdfPath);
  const data = await pdf(buf);
  return String(data.text ?? "");
}

export async function getFichaTecnicaText() {
  const p =
    (process.env.FICHA_TECNICA_PATH && String(process.env.FICHA_TECNICA_PATH).trim()) ||
    path.join(process.cwd(), "FICHA TECNICA  C1.pdf");

  if (cached?.key === p) return cached.text;

  const text = await readPdfText(p);
  const clean = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
  cached = { key: p, text: clean };
  return clean;
}

