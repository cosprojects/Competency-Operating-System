import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

/** CSV-ячейка с защитой от формул и экранированием кавычек. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** CSV-файл с BOM, чтобы Excel открывал русский текст. */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export interface PdfSection {
  heading?: string;
  lines: string[];
}

const FONT_PATH = path.join(process.cwd(), "public/fonts/Geist-VariableFont_wght.ttf");
let fontBytesPromise: Promise<Buffer> | null = null;

async function geistFontBytes(): Promise<Buffer> {
  fontBytesPromise ??= readFile(FONT_PATH);
  return fontBytesPromise;
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && font.widthOfTextAtSize(`${text.slice(0, end)}…`, size) > maxWidth) end -= 1;
  return `${text.slice(0, end)}…`;
}

/**
 * PDF-отчёт из секций строк. Встроенный Geist поддерживает кириллицу,
 * шрифт подключается из public/fonts (см. outputFileTracingIncludes).
 */
export async function buildPdf({
  title,
  subtitle,
  sections,
}: {
  title: string;
  subtitle: string;
  sections: PdfSection[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await geistFontBytes(), { subset: true });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  const ink = rgb(0.07, 0.09, 0.12);
  const muted = rgb(0.37, 0.44, 0.52);
  const accent = rgb(0.31, 0.27, 0.9);

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText("AXIONA", { x: margin, y, size: 9, font, color: accent });
  y -= 26;
  page.drawText(fitText(title, font, 20, maxWidth), { x: margin, y, size: 20, font, color: ink });
  y -= 20;
  page.drawText(fitText(subtitle, font, 10, maxWidth), { x: margin, y, size: 10, font, color: muted });
  y -= 26;

  for (const section of sections) {
    if (y < margin + 80) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (section.heading) {
      page.drawText(fitText(section.heading, font, 12, maxWidth), {
        x: margin,
        y,
        size: 12,
        font,
        color: ink,
      });
      y -= 18;
    }
    for (const line of section.lines) {
      if (y < margin + 24) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(fitText(line, font, 9, maxWidth), { x: margin, y, size: 9, font, color: muted });
      y -= 13;
    }
    y -= 12;
  }

  return doc.save();
}

export function pdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export function isoDate(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "—";
}
