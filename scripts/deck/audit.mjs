#!/usr/bin/env node
/**
 * Layout audit: открывает готовый HTML в headless Chrome с ?audit=1 и печатает
 * строки заголовков, переполнение футера и пересечения блоков по каждому слайду.
 *
 *   node scripts/deck/audit.mjs [--json]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const html = join(root, "docs/08-business-plan/investor/deck-v2/AXIONA-Investor-Deck.html");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
function dump() {
  const profile = `/tmp/axiona-deck-audit-${process.pid}-${Date.now()}`;
  return execFileSync(
    chrome,
    ["--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--no-first-run", "--disable-crash-reporter", "--disable-breakpad", `--user-data-dir=${profile}`, "--virtual-time-budget=8000", "--dump-dom", `file://${html}?audit=1`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }
  );
}
let dom = "";
for (let attempt = 0; attempt < 4; attempt++) {
  try { dom = dump(); } catch {}
  if (dom.includes('id="audit-data"')) break;
  await new Promise((r) => setTimeout(r, 500));
}
const m = dom.match(/<pre id="audit-data">([\s\S]*?)<\/pre>/);
if (!m) {
  console.error("audit-data не найден — проверь AUDIT_JS");
  process.exit(1);
}
const data = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(data, null, 2));
} else {
  console.log("slide | titleH | lines | gap→takeaway | content→footer | overflow | overlaps | over footer");
  for (const s of data.slides) {
    const flag = s.overflowBy > 0 || s.overlaps.length ? " ✗" : "";
    console.log(
      `${String(s.slide).padStart(2, "0")}${flag} | ${s.titleHeight} | ${s.titleLines} | ${s.gapBeforeTakeaway ?? "—"} | ${s.contentBottom}→${s.footerTop} | ${s.overflowBy} | ${s.overlaps.join("; ") || "—"} | ${s.overFooter.join("; ") || "—"}`
    );
  }
}
