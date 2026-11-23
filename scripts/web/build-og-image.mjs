#!/usr/bin/env node
/**
 * build-og-image.mjs — собрать картинку для соцсетей и мессенджеров (Open Graph).
 *
 * Зачем: без `og:image` ссылка на AXIONA в Telegram, WhatsApp и соцсетях
 * разворачивается серой плашкой без превью. Картинка одна на сайт: страницы
 * профессий используют её же, пока не появятся персональные (это отдельная
 * задача — динамические OG на ImageResponse).
 *
 * Как: рендерим HTML в headless Chrome и снимаем скриншот 1200×630 — так
 * картинка совпадает с продуктовой типографикой (Geist, бумажный фон с точками)
 * без отдельного редактора и без зашитых в код шрифтов.
 *
 * Числа в карточке берутся из собранной модели (content/generated/beta-1.json),
 * а не вписаны руками: после новой сборки релиза достаточно перегенерировать.
 *
 * Запуск: npm run og:build
 * Требует: Chrome (переменная CHROME_BIN, иначе стандартный путь macOS).
 */
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WEB = join(ROOT, "apps/web");
const PUBLIC = join(WEB, "public");
const CONTENT = join(WEB, "src/content/generated/beta-1.json");
const OUT_DIR = join(PUBLIC, "images/og");
const OUT_FILE = join(OUT_DIR, "axiona-1200x630.png");
const BUILD_DIR = join(ROOT, ".og-build");
const HTML_FILE = join(BUILD_DIR, "og.html");

const CHROME =
  process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const WIDTH = 1200;
const HEIGHT = 630;

function fail(message) {
  console.error(`og:build — ${message}`);
  process.exit(1);
}

/** Реальные счётчики модели: без выдуманных чисел в карточке. */
function readStats() {
  let content;
  try {
    content = JSON.parse(readFileSync(CONTENT, "utf8"));
  } catch (error) {
    fail(`не читается модель ${CONTENT}: ${error instanceof Error ? error.message : error}`);
  }
  const professions = Array.isArray(content.professions) ? content.professions : [];
  const competencies = new Set();
  const sources = new Set();
  for (const profession of professions) {
    for (const section of profession.sections ?? []) {
      for (const competency of section.competencies ?? []) {
        competencies.add(competency.id);
        for (const source of competency.sources ?? []) sources.add(source.id);
      }
    }
  }
  if (professions.length === 0) fail("в модели нет профессий — пересобери release:build");
  return { professions: professions.length, competencies: competencies.size, sources: sources.size };
}

/** Пробелы в разрядах: 1 436 читается, 1436 — нет. */
function formatNumber(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function buildHtml(stats) {
  const fontUrl = pathToFileURL(join(PUBLIC, "fonts/Geist-VariableFont_wght.ttf")).href;
  const brandUrl = pathToFileURL(join(PUBLIC, "brand/Brand.svg")).href;

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: "Geist";
    src: url("${fontUrl}") format("truetype");
    font-weight: 100 900;
    font-style: normal;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    font-family: "Geist", system-ui, sans-serif;
    color: #132238;
    background-color: #f8fafc;
    background-image:
      radial-gradient(circle at 2px 2px, #eaeff6 2px, transparent 2px),
      radial-gradient(circle at 19px 36px, #eaeff6 2px, transparent 2px);
    background-size: 34px 34px;
    position: relative;
    overflow: hidden;
  }
  /* Мягкое индиго-свечение в правом верхнем углу: глубина без картинки. */
  .glow {
    position: absolute;
    top: -220px;
    right: -160px;
    width: 720px;
    height: 720px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(79, 70, 229, 0.14), rgba(79, 70, 229, 0) 62%);
  }
  .glow-sky {
    position: absolute;
    bottom: -260px;
    left: -180px;
    width: 620px;
    height: 620px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.12), rgba(14, 165, 233, 0) 64%);
  }
  .frame {
    position: relative;
    height: 100%;
    padding: 64px 72px 60px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .brand { width: 168px; height: 35px; display: block; }
  .headline {
    margin: 0;
    font-size: 64px;
    line-height: 1.06;
    font-weight: 600;
    letter-spacing: -0.025em;
    max-width: 660px;
  }
  .headline .accent { color: #4f46e5; }
  .lead {
    margin: 22px 0 0;
    font-size: 25px;
    line-height: 1.45;
    font-weight: 400;
    color: #5f6f85;
    max-width: 560px;
  }
  .foot { display: flex; align-items: center; gap: 16px; }
  .pill {
    display: inline-flex;
    align-items: center;
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    background: #eef2ff;
    color: #3730a3;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .domain { font-size: 19px; font-weight: 500; color: #5f6f85; letter-spacing: 0.01em; }
  /* Статистика: карточка справа, числа из модели. */
  .stats {
    position: absolute;
    right: 72px;
    bottom: 64px;
    width: 372px;
    padding: 30px 34px 26px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #e2e8f0;
    border-radius: 26px;
    box-shadow: 0 24px 48px -28px rgba(19, 34, 56, 0.35);
  }
  .stat { display: flex; align-items: baseline; gap: 14px; padding: 9px 0; }
  .stat + .stat { border-top: 1px solid #eef2f7; }
  .stat-value {
    font-size: 40px;
    line-height: 1;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #132238;
    font-variant-numeric: tabular-nums;
    min-width: 96px;
  }
  .stat-label { font-size: 17px; line-height: 1.3; color: #5f6f85; }
</style>
</head>
<body>
  <div class="glow"></div>
  <div class="glow-sky"></div>
  <div class="frame">
    <img class="brand" src="${brandUrl}" alt="AXIONA">
    <div>
      <h1 class="headline">Карта компетенций <span class="accent">дизайнера</span></h1>
      <p class="lead">Из чего состоит профессия: компетенции, знания, навыки и материалы к каждому.</p>
    </div>
    <div class="foot">
      <span class="pill">Beta 1</span>
      <span class="domain">app.axiona.world</span>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><span class="stat-value">${stats.professions}</span><span class="stat-label">профессий<br>дизайнера</span></div>
    <div class="stat"><span class="stat-value">${formatNumber(stats.competencies)}</span><span class="stat-label">компетенций<br>в карте</span></div>
    <div class="stat"><span class="stat-value">${formatNumber(stats.sources)}</span><span class="stat-label">источников<br>материалов</span></div>
  </div>
</body>
</html>
`;
}

async function main() {
  const stats = readStats();
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(BUILD_DIR, { recursive: true });
  rmSync(join(BUILD_DIR, "profile"), { recursive: true, force: true });
  writeFileSync(HTML_FILE, buildHtml(stats), "utf8");

  try {
    await run(CHROME, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-crash-reporter",
      "--disable-breakpad",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--force-device-scale-factor=1",
      `--user-data-dir=${join(BUILD_DIR, "profile")}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      "--virtual-time-budget=3000",
      `--screenshot=${OUT_FILE}`,
      pathToFileURL(HTML_FILE).href,
    ]);
  } catch (error) {
    fail(
      `Chrome не отрендерил карточку. Проверь путь к Chrome (CHROME_BIN). ${
        error instanceof Error ? error.message.split("\n")[0] : error
      }`,
    );
  }

  const size = statSync(OUT_FILE).size;
  rmSync(join(BUILD_DIR, "profile"), { recursive: true, force: true });
  console.log(
    `og:build — ${OUT_FILE} (${WIDTH}×${HEIGHT}, ${(size / 1024).toFixed(0)} КБ); ` +
      `профессий ${stats.professions}, компетенций ${stats.competencies}, источников ${stats.sources}`,
  );
}

await main();
