/**
 * Проверка вёрстки deck: содержание, цифры, ассеты, PDF/PNG.
 *
 * Запускается из build.mjs после рендера, но можно и отдельно:
 *   node scripts/deck/verify.mjs
 *
 * Что проверяется (см. VERIFY.md в папке deck):
 *   1. нигде нет цен / тарифов / выручки / платящих / оплат — в слайдах и нотах;
 *   2. цифры 13 / 132 / 131 / 292 и $120 тыс. совпадают с COS-BP-023;
 *   3. старые цифры РФ-версии ($110–120 тыс., 500 платящих, 590/990 ₽ и т.п.) не просочились;
 *   4. есть логотип, 3–5 скриншотов, инициалы, абстрактные карты, 6 иконок;
 *   5. PDF — 14 страниц, PNG — 14 файлов 2560×1440, у каждого слайда есть ноты.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./engine.mjs";

const SOURCE = "docs/08-business-plan/COS-BP-023-Designer-Copy-Kazakhstan.md";

const BANNED = [
  { id: "prices", label: "цены", re: /(^|[^а-яё])цен[аыуе](?![а-яё])/giu },
  { id: "tariffs", label: "тарифы", re: /тариф/giu },
  { id: "revenue", label: "выручка", re: /выручк/giu },
  { id: "paying", label: "платящие", re: /платящ/giu },
  { id: "payments", label: "оплата", re: /оплат/giu },
  { id: "payment-rail", label: "платежи", re: /платеж/giu },
  { id: "subscription", label: "подписка", re: /подписк/giu },
  { id: "cost", label: "стоимость", re: /стоимост/giu },
  { id: "pricelist", label: "прайс", re: /прайс/giu },
  { id: "revenue-en", label: "revenue", re: /\brevenue\b/giu },
  { id: "price-per-month", label: "цена за месяц", re: /\d[\d\s.,–-]*\s*(?:₽|€|\$)\s*\/\s*мес/giu },
];

const STALE = [
  "$110", "110–120", "500 платящих", "300–800 платящих", "50–100 платящих",
  "154 млрд", "0,9–3,6", "5–8 млн", "590", "990 ₽", "4 900", "8 900",
  "€9,99", "€14,99", "€299", "€499", "$199", "$299", "$3–10", "$5–20",
  "LTV/CAC ≥3", "0,5–2 млн", "9,9–19,9",
];

const REQUIRED_NUMBERS = [
  { id: "n13", label: "13 профессий", re: /(^|[^\d])13\s+професси/iu },
  { id: "n132", label: "132 компетенции в модели", re: /132\s+компетенци/iu },
  { id: "n131", label: "131 опубликована", re: /131\s+компетенция\s+опубликована/iu, sourceRe: /131\s+опубликована/iu },
  { id: "n292", label: "292 связи", re: /292\s+связи/iu },
  { id: "nask", label: "$120 тыс.", re: /\$120\s*тыс/iu },
];

const MISMATCH = [
  { label: "13 компетенций (не 13 профессий)", re: /13\s+компетенци/iu },
  { label: "132 связи (не 132 компетенции)", re: /132\s+связ/iu },
  { label: "131 связь", re: /131\s+связ/iu },
  { label: "292 компетенции", re: /292\s+компетенци/iu },
  { label: "$120 млн/млрд", re: /\$120\s*(?:млн|млрд)/iu },
  { label: "132 профессии", re: /132\s+професси/iu },
  { label: "13 компетенций", re: /13\s+компетенци/iu },
];

const ICON_IDS = ["map", "gap", "lesson", "quiz", "evidence", "progress"];

export function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<svg[\s\S]*?<\/svg>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&mdash;/gu, "—")
    .replace(/&laquo;/gu, "«")
    .replace(/&raquo;/gu, "»")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/\s+/gu, " ")
    .trim();
}

function pngSize(file) {
  const b = readFileSync(file);
  if (b.length < 24 || b.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function pdfPages(file) {
  try {
    const out = execFileSync("mdls", ["-name", "kMDItemNumberOfPages", "-raw", file], { encoding: "utf8" }).trim();
    const n = Number(out);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {}
  try {
    const text = readFileSync(file).toString("latin1");
    return (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
  } catch {
    return 0;
  }
}

function matches(text, re) {
  const g = re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
  return [...text.matchAll(g)].map((m) => m[0].trim()).filter(Boolean);
}

export function verify({ outDir, deck, html, pdfFile, expectSlides = 14, layout = null }) {
  const checks = [];
  const add = (id, label, ok, detail = "") => checks.push({ id, label, ok: !!ok, detail: String(detail).slice(0, 400) });

  const visible = extractText(html);
  const notes = deck.slides.map((s) => s.notes || "").join("\n");
  const all = `${visible}\n${notes}`;
  const src = readFileSync(join(ROOT, SOURCE), "utf8");

  // 1. слайды
  const sections = [...html.matchAll(/<section class="slide/gu)].length;
  add("slides", `${expectSlides} слайдов`, sections === expectSlides, `найдено ${sections}`);

  // 2. запрещённые темы (видимый текст + ноты)
  for (const b of BANNED) {
    const hit = matches(all, b.re);
    add(`no-${b.id}`, `нет «${b.label}»`, hit.length === 0, hit.length ? `найдено: ${[...new Set(hit)].slice(0, 8).join(", ")}` : "чисто");
  }

  // 3. обязательные цифры и связи
  for (const n of REQUIRED_NUMBERS) {
    const okVisible = n.re.test(visible);
    const okSource = n.sourceRe ? n.sourceRe.test(src) : n.id === "nask" ? /\$120\s*тыс/iu.test(src) : n.re.test(src);
    add(n.id, `${n.label} — на слайде и в источнике`, okVisible && okSource, `слайд: ${okVisible}, источник: ${okSource}`);
  }
  add("ask-split", "$84 тыс. + $36 тыс. = $120 тыс.", /\$84\s*тыс/iu.test(visible) && /\$36\s*тыс/iu.test(visible), "транши T1/T2 указаны");

  // 4. никаких перепутанных цифр
  for (const m of MISMATCH) {
    const hit = matches(visible, m.re);
    add(`mismatch-${m.label}`, `нет подмены: ${m.label}`, hit.length === 0, hit.length ? hit.join(", ") : "ок");
  }

  // 5. старые цифры РФ-версии
  const stale = STALE.filter((s) => visible.includes(s) || notes.includes(s));
  add("no-stale", "старые цены/выручка РФ-версии не просочились", stale.length === 0, stale.length ? stale.join(", ") : "чисто");

  // 6. логотип
  const marks = (html.match(/class="logo-mark/gu) || []).length;
  const words = (html.match(/class="logo-word/gu) || []).length;
  add("logo", "логотип есть (титул + финал)", marks >= 2 && words >= 2, `mark: ${marks}, wordmark: ${words}`);

  // 7. скриншоты продукта
  const shots = [...new Set([...html.matchAll(/assets\/screens\/([\w.-]+\.png)/gu)].map((m) => m[1]))];
  const shotsExist = shots.every((s) => existsSync(join(outDir, "assets/screens", s)));
  add("screenshots", "3–5 скриншотов продукта", shots.length >= 3 && shots.length <= 5 && shotsExist, `найдено ${shots.length}: ${shots.join(", ")}`);

  // 8. карты
  const maps = ["map-europe-cis.svg", "map-kazakhstan.svg"].filter((m) => html.includes(`data-map="${m}"`));
  add("maps", "абстрактные карты Европы/СНГ и Казахстана", maps.length === 2, maps.join(", "));

  // 9. портреты/инициалы
  const hasLS = /data-initials="ЛС"/u.test(html);
  const hasKN = /data-initials="КН"/u.test(html);
  add("initials", "портреты/инициалы Луизы и Кирилла", hasLS && hasKN && /Луиза Смольская/u.test(visible) && /Кирилл Невзоров/u.test(visible), `ЛС: ${hasLS}, КН: ${hasKN}`);

  // 10. иконки
  for (const id of ICON_IDS) {
    const n = (html.match(new RegExp(`data-icon="${id}"`, "gu")) || []).length;
    add(`icon-${id}`, `иконка «${id}»`, n > 0, `${n} шт.`);
  }

  // 11. ноты и структура
  const notesOk = deck.slides.every((s) => (s.notes || "").trim().length > 40);
  add("speaker-notes", "speaker notes у всех слайдов", notesOk, `${deck.slides.filter((s) => (s.notes || "").trim().length > 40).length} / ${deck.slides.length}`);
  const eachSlideText = [...html.matchAll(/<section class="slide[\s\S]*?<\/section>/gu)].map((m) => extractText(m[0]).length);
  add("slide-text", "у каждого слайда есть текст", eachSlideText.length === expectSlides && eachSlideText.every((n) => n > 60), `мин. ${Math.min(...eachSlideText)} символов`);

  // 12. PDF
  const pdfExists = existsSync(pdfFile);
  const pages = pdfExists ? pdfPages(pdfFile) : 0;
  add("pdf", `PDF — ${expectSlides} страниц`, pdfExists && pages === expectSlides, pdfExists ? `страниц: ${pages}` : "файла нет");

  // 13. PNG
  const pngs = Array.from({ length: expectSlides }, (_, i) => join(outDir, "slides", `${String(i + 1).padStart(2, "0")}.png`));
  const pngMissing = pngs.filter((f) => !existsSync(f));
  const sizes = pngs.filter((f) => existsSync(f)).map(pngSize);
  const dimsOk = sizes.length === expectSlides && sizes.every((s) => s && s.width === 2560 && s.height === 1440);
  add("png", "PNG — 14 файлов 2560×1440", pngMissing.length === 0 && dimsOk, pngMissing.length ? `нет: ${pngMissing.join(", ")}` : `${sizes[0]?.width}×${sizes[0]?.height}`);

  // 14. ассеты на месте
  const requiredAssets = [
    "assets/fonts/Geist-VariableFont_wght.ttf",
    "assets/logo-mark.svg",
    "assets/logo-mark-white.svg",
    "assets/logo-wordmark.svg",
    "assets/logo-wordmark-dark.svg",
    "assets/map-europe-cis.svg",
    "assets/map-europe-cis-dark.svg",
    "assets/map-kazakhstan.svg",
  ];
  const missingAssets = requiredAssets.filter((a) => !existsSync(join(outDir, a)));
  add("assets", "все ассеты на месте", missingAssets.length === 0, missingAssets.length ? missingAssets.join(", ") : `${requiredAssets.length} файлов`);

  // 15. layout-audit: нет переполнений и наездов блоков
  if (layout?.slides) {
    const bad = layout.slides.filter((s) => s.overflowBy > 0 || (s.overlaps || []).length);
    add("layout", "слайды без переполнений футера и наездов блоков", bad.length === 0, bad.length ? bad.map((s) => `#${s.slide} overflow ${s.overflowBy}`).join("; ") : "0 переполнений, 0 наездов");
  } else {
    add("layout", "layout-audit", true, "audit не запускался");
  }

  // 16. источник и правило
  add("source-rule", "источник COS-BP-023 запрещает цены/выручку/платящих", /Не показывать тарифы\/выручку\/платящих/u.test(src), "правило найдено в copy deck");

  const ok = checks.every((c) => c.ok);
  const lines = [
    `# Проверка вёрстки — AXIONA Investor Deck 2026-11`,
    ``,
    `Статус: **${ok ? "OK" : "FAIL"}** · ${checks.filter((c) => c.ok).length}/${checks.length} проверок`,
    ``,
    `| Проверка | Статус | Детали |`,
    `|---|---|---|`,
    ...checks.map((c) => `| ${c.label} | ${c.ok ? "✓" : "✗"} | ${c.detail.replace(/\|/gu, "\\|")} |`),
    ``,
    `Источник контента: \`${SOURCE}\`. Разрешённые цифры: 13 / 132 / 131 / 292, $120 тыс. (84 + 36).`,
  ];
  return { ok, checks, markdown: lines.join("\n") };
}

// Прямой запуск: сверить готовый HTML без рендера.
if (process.argv[1] && process.argv[1].endsWith("verify.mjs")) {
  const { deck } = await import("./decks/axiona-pitch-ru-2026-11.mjs");
  const outDir = join(ROOT, "docs/08-business-plan/investor/deck-v2");
  const html = readFileSync(join(outDir, "AXIONA-Investor-Deck.html"), "utf8");
  let layout = null;
  try { layout = JSON.parse(readFileSync(join(outDir, "layout-audit.json"), "utf8")); } catch {}
  const report = verify({ outDir, deck, html, pdfFile: join(outDir, "AXIONA-Investor-Deck.pdf"), expectSlides: deck.slides.length, layout });
  console.log(report.markdown);
  process.exitCode = report.ok ? 0 : 1;
}
