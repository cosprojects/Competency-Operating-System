#!/usr/bin/env node
/**
 * AXIONA deck build — HTML, PDF, PNG каждого слайда, contact sheet, проверки.
 *
 * Usage:
 *   node scripts/deck/build.mjs [--deck axiona-pitch-ru-2026-11] [--no-render]
 *
 * Вход: scripts/deck/decks/<deck>.mjs (контент + композиция)
 * Выход: docs/08-business-plan/investor/deck-v2/
 *   AXIONA-Investor-Deck.html      — листаемая презентация (← →, F, N)
 *   AXIONA-Investor-Deck.pdf       — 14 страниц 16:9
 *   slides/01.png … 14.png         — 2560×1440
 *   AXIONA-Investor-Deck-contact-sheet.png
 *   SPEAKER-NOTES.md, verify.json, VERIFY.md
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deck as defaultDeck } from "./decks/axiona-pitch-ru-2026-11.mjs";
import { renderPage, ROOT, esc } from "./engine.mjs";
import { verify } from "./verify.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const FLAG = (name) => process.argv.includes(name);

const deckName = arg("--deck", "axiona-pitch-ru-2026-11");
const deck = deckName === "axiona-pitch-ru-2026-11" ? defaultDeck : (await import(`./decks/${deckName}.mjs`)).deck;
const OUT = resolve(ROOT, "docs/08-business-plan/investor/deck-v2");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = "/tmp/axiona-deck-chrome";
const htmlFile = join(OUT, "AXIONA-Investor-Deck.html");
const pdfFile = join(OUT, "AXIONA-Investor-Deck.pdf");
const total = deck.slides.length;

// ------------------------------------------------------------------- assets
function ensureDirs() {
  for (const p of ["assets", "assets/screens", "assets/fonts", "slides"]) mkdirSync(join(OUT, p), { recursive: true });
}
function copyAssets() {
  const brand = ["logo-mark.svg", "logo-mark-white.svg", "logo-wordmark.svg", "logo-wordmark-dark.svg"];
  for (const f of brand) copyFileSync(join(ROOT, "apps/web/public/brand", f), join(OUT, "assets", f));
  copyFileSync(join(ROOT, "apps/web/public/fonts/Geist-VariableFont_wght.ttf"), join(OUT, "assets/fonts/Geist-VariableFont_wght.ttf"));
  const screens = [
    ["docs/design/screens/35-profession-star.png", "profession-map.png"],
    ["docs/design/screens/27-saved-simplified.png", "saved.png"],
    ["docs/design/screens/19-material-confirm-new.png", "competency.png"],
  ];
  for (const [from, to] of screens) copyFileSync(join(ROOT, from), join(OUT, "assets/screens", to));
}
function runMaps() {
  execFileSync(process.execPath, [join(here, "maps.mjs"), "--out", join(OUT, "assets")], { stdio: "inherit" });
}

// ------------------------------------------------------------------ rendering
function chrome(args) {
  execFileSync(CHROME, ["--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--no-first-run", "--disable-sync", "--disable-crash-reporter", "--disable-breakpad", `--user-data-dir=${PROFILE}`, ...args], { stdio: "pipe", timeout: 120000 });
}
function renderPdf() {
  chrome([
    "--print-to-pdf=" + pdfFile,
    "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=10000",
    "file://" + htmlFile,
  ]);
}
function renderSlidePng(i) {
  const file = join(OUT, "slides", `${String(i).padStart(2, "0")}.png`);
  chrome([
    "--screenshot=" + file,
    "--window-size=1280,720",
    "--force-device-scale-factor=2",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=6000",
    `file://${htmlFile}?export=1&slide=${i}`,
  ]);
  return file;
}

// -------------------------------------------------------------- contact sheet
function contactSheetHtml() {
  const items = deck.slides
    .map((s, i) => {
      const n = String(i + 1).padStart(2, "0");
      return `<figure>
        <img src="slides/${n}.png" alt="Слайд ${n}: ${esc(s.section || "")}">
        <figcaption><b>${n}</b><span>${esc(s.section || "")}</span><em>${esc(s.time || "")}</em></figcaption>
      </figure>`;
    })
    .join("\n");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#f1f5f9;font-family:"Geist",-apple-system,"Segoe UI",sans-serif;color:#132238;padding:36px}
    h1{font-size:30px;font-weight:600;letter-spacing:-.03em}
    .sub{margin-top:6px;font-size:14px;color:#5f6f85}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:26px}
    figure{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(19,34,56,.07)}
    img{display:block;width:100%;height:auto;border-bottom:1px solid #eef2f7}
    figcaption{display:flex;align-items:baseline;gap:8px;padding:9px 12px;font-size:11px;color:#5f6f85}
    figcaption b{font-size:12px;color:#3730a3;letter-spacing:.06em}
    figcaption em{margin-left:auto;font-style:normal;font-variant-numeric:tabular-nums;color:#8491a5}
    .foot{margin-top:22px;font-size:11.5px;color:#64748b}
  </style></head><body>
    <h1>AXIONA · Investor deck 2026-11 — «Светлая структура»</h1>
    <div class="sub">14 слайдов · 16:9 · 1280×720 · собрано из токенов globals.css · Казахстан first · без цен, выручки и платящих</div>
    <div class="grid">${items}</div>
    <div class="foot">Контент: COS-BP-023 · цифры: 13 / 132 / 131 / 292 · ask $120 тыс. · визуальный язык: COS-COM-006, COS-COM-011</div>
  </body></html>`;
}
function renderContactSheet() {
  const file = join(OUT, "contact-sheet.html");
  writeFileSync(file, contactSheetHtml());
  chrome([
    "--screenshot=" + join(OUT, "AXIONA-Investor-Deck-contact-sheet.png"),
    "--window-size=2640,1900",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=12000",
    "file://" + file,
  ]);
}

// -------------------------------------------------------------- speaker notes
function renderNotes() {
  const lines = [
    `# AXIONA — speaker notes · investor deck 2026-11`,
    ``,
    `> ${total} слайдов, 10–12 минут. Ноты — не текст на слайде: это то, что говорится вслух.`,
    `> Контент: COS-BP-023. Цифры: 13 / 132 / 131 / 292, $120 тыс.`,
    ``,
  ];
  deck.slides.forEach((s, i) => {
    lines.push(`## ${String(i + 1).padStart(2, "0")} · ${s.section} — ${s.time}`);
    lines.push("");
    lines.push(s.notes || "—");
    lines.push("");
  });
  writeFileSync(join(OUT, "SPEAKER-NOTES.md"), lines.join("\n"));
}

// ------------------------------------------------------------------ audit
function runLayoutAudit() {
  try {
    const raw = execFileSync(process.execPath, [join(here, "audit.mjs"), "--json"], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const data = JSON.parse(raw);
    writeFileSync(join(OUT, "layout-audit.json"), JSON.stringify(data, null, 2));
    return data;
  } catch (e) {
    console.warn(`layout audit skipped: ${String(e.message).split("\n")[0]}`);
    return null;
  }
}

// ---------------------------------------------------------------------- main
async function main() {
  ensureDirs();
  runMaps();
  copyAssets();

  const html = renderPage({
    title: deck.title,
    lang: deck.lang,
    meta: deck.meta,
    slides: deck.slides,
  });
  writeFileSync(htmlFile, html);
  console.log(`html  → ${htmlFile.replace(ROOT + "/", "")} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);

  if (!FLAG("--no-render")) {
    rmSync(PROFILE, { recursive: true, force: true });
    renderPdf();
    console.log(`pdf   → ${pdfFile.replace(ROOT + "/", "")} (${(readFileSync(pdfFile).length / 1024).toFixed(0)} KB)`);
    for (let i = 1; i <= total; i++) {
      const f = renderSlidePng(i);
      process.stdout.write(`png ${String(i).padStart(2, "0")} → ${f.replace(OUT + "/", "")}\n`);
    }
    renderContactSheet();
    console.log(`sheet → AXIONA-Investor-Deck-contact-sheet.png`);
  }
  renderNotes();
  console.log(`notes → SPEAKER-NOTES.md`);

  const layout = FLAG("--no-render") ? null : runLayoutAudit();
  const report = verify({ outDir: OUT, deck, html, pdfFile, expectSlides: total, layout });
  writeFileSync(join(OUT, "verify.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(OUT, "VERIFY.md"), report.markdown);
  console.log(`\nverify: ${report.ok ? "OK" : "FAIL"} · ${report.checks.filter((c) => c.ok).length}/${report.checks.length} checks`);
  for (const c of report.checks.filter((c) => !c.ok)) console.log(`  ✗ ${c.id}: ${c.detail}`);
  if (!report.ok) process.exitCode = 1;
}
main();
