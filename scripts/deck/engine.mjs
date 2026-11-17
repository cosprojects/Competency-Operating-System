/**
 * AXIONA deck engine — визуальная система презентаций.
 *
 * Источник правды по цвету/радиусам/типографике:
 *   apps/web/src/app/globals.css  +  docs/06-communication/COS-COM-006-Visual-Language.md
 * Иконки взяты из apps/web/src/components/icons.tsx (линейные, currentColor).
 * Логотипы — apps/web/public/brand/*.svg, шрифт — apps/web/public/fonts/Geist.
 *
 * Движок не знает контента: он даёт примитивы (шапка, стат, маршрут, таблица,
 * скриншот, портрет, карта), CSS на 1280×720 и режимы «листать / PDF / PNG».
 * Контент конкретной презентации лежит в scripts/deck/decks/*.mjs.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, "../..");

export const T = {
  ink: "#132238",
  inkStrong: "#111827",
  muted: "#5f6f85",
  line: "#e2e8f0",
  lineSoft: "#eef2f7",
  bg: "#f8fafc",
  card: "#ffffff",
  accent: "#4f46e5",
  accentDark: "#3730a3",
  accentSoft: "#eef2ff",
  accentSky: "#0ea5e9",
  dark: "#0f1724",
  tierFoundation: "#b45309",
  tierFoundationBg: "#fff7ed",
  tierCore: "#1d4ed8",
  tierCoreBg: "#eff6ff",
  tierOptional: "#64748b",
};

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// --------------------------------------------------------------------- assets
const cache = new Map();
export function asset(rel) {
  if (!cache.has(rel)) cache.set(rel, readFileSync(join(ROOT, rel), "utf8"));
  return cache.get(rel);
}

/** Вставляет реальный SVG-ассет из public/brand, без перерисовки. */
export function inlineBrand(file, { width, height, className = "", label = "" } = {}) {
  let svg = asset(join("apps/web/public/brand", file));
  svg = svg.replace(/<svg /, `<svg class="${className}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'} `);
  if (width) svg = svg.replace(/<svg([^>]*?) width="[^"]*"/, `<svg$1 width="${width}"`);
  if (height) svg = svg.replace(/<svg([^>]*?) height="[^"]*"/, `<svg$1 height="${height}"`);
  return svg;
}

export const logoMark = (opts = {}) =>
  inlineBrand(opts.white ? "logo-mark-white.svg" : "logo-mark.svg", { width: opts.width ?? 34, height: opts.height ?? 32, className: `logo-mark ${opts.className ?? ""}` });
export const logoWordmark = (opts = {}) =>
  inlineBrand(opts.white ? "logo-wordmark-dark.svg" : "logo-wordmark.svg", { width: opts.width ?? 107, height: opts.height ?? 18, className: `logo-word ${opts.className ?? ""}` });
// Шрифт встраиваем в HTML как data URI: при открытии файла с диска Chrome
// блокирует загрузку ttf по CORS (origin null), и deck молча уезжает на системный
// sans. Встроенный шрифт убирает эту зависимость и делает HTML самодостаточным.
const FONT_B64 = readFileSync(join(ROOT, "apps/web/public/fonts/Geist-VariableFont_wght.ttf")).toString("base64");
export const FONT_FACE = `@font-face {
  font-family: "Geist";
  src: url("data:font/ttf;base64,${FONT_B64}") format("truetype-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}`;

export const logoLockup = (opts = {}) =>
  `<span class="logo-lockup ${opts.className ?? ""}">${logoMark({ ...opts, width: opts.markWidth ?? 30, height: opts.markHeight ?? 28 })}${logoWordmark({ ...opts, width: opts.wordWidth ?? 96, height: opts.wordHeight ?? 16 })}</span>`;

/** Инлайнит ассет-карту (SVG с фиксированными width/height). */
export function inlineMap(file, className = "map") {
  let svg = asset(join("docs/08-business-plan/investor/deck-v2/assets", file));
  svg = svg.replace(/<svg /, `<svg class="${className}" data-map="${file}" aria-hidden="true" `);
  return svg;
}

// ---------------------------------------------------------------------- icons
// Линейные иконки: 24×24, stroke=currentColor. Часть путей — из icons.tsx проекта.
const ICONS = {
  map: `<path d="M12 4c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2ZM12 20c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2ZM20 20c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2ZM20 4c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2ZM5 12c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2ZM10 6v12M18 6v12M18 12H5.5"/>`,
  gap: `<circle cx="4.5" cy="12" r="2.2"/><circle cx="19.5" cy="12" r="2.2"/><path d="M7.4 12h2.1M14.5 12h2.1" stroke-dasharray="1 3.4"/>`,
  route: `<path d="M4 18c3.2-6.4 5.7-7.4 8.1-5.1 2.1 2 3.6 1.4 7.9-4.9"/><circle cx="4" cy="18" r="1.7"/><circle cx="20" cy="8" r="1.7"/>`,
  lesson: `<path d="M3.1 10.4 9.8 13.5a4.6 4.6 0 0 0 4.4 0l6.7-3.1c1.5-.7 1.5-3 0-3.7l-6.7-3.2a4.6 4.6 0 0 0-4.4 0L3.1 6.6c-1.5.7-1.5 3.1 0 3.8Z"/><path d="M2 8.5V14M19 11.5v5.1c0 1-.5 2-1.4 2.4C16.2 19.9 13.8 21 12 21s-4.2-1.1-5.6-1.9A2.8 2.8 0 0 1 5 16.6v-5.1"/>`,
  quiz: `<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.8 2.2c-.9.6-1.4 1.1-1.4 2.1"/><path d="M12 17h.01"/>`,
  evidence: `<circle cx="12" cy="12" r="9"/><path d="M7.5 12.2l3.1 3.1 5.9-6.6"/>`,
  progress: `<path d="M4 20V4M4 20h16M8 16v-4M12.5 16V8M17 16v-6"/>`,
  users: `<circle cx="9" cy="9" r="3"/><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8S14 16 14.6 19"/><circle cx="17" cy="10" r="2.2"/><path d="M15.5 14.6c2.4-.2 4.3 1.3 4.9 4.4"/>`,
  link: `<path d="M10 13.5a3.5 3.5 0 0 0 5 .4l2.5-2.5a3.5 3.5 0 0 0-5-5L11 8"/><path d="M14 10.5a3.5 3.5 0 0 0-5-.4l-2.5 2.5a3.5 3.5 0 0 0 5 5l1.5-1.6"/>`,
  star: `<path d="M12 3.2l2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.6-5 2.6 1-5.6-4.1-4 5.6-.8L12 3.2Z"/>`,
  box: `<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>`,
  eye: `<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>`,
  chart: `<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12.5 16V8M17 16v-6"/>`,
  arrow: `<path d="M4 12h16m-6 6 6-6-6-6"/>`,
  arrowLeft: `<path d="M20 12H4m6-6-6 6 6 6"/>`,
  home: `<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z"/>`,
  target: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>`,
  gapBridge: `<path d="M3 8h5M16 8h5M3 16h5M16 16h5"/><path d="M9.2 12h5.6" stroke-dasharray="1 3.4"/><path d="M9.2 12l1.4-1.4M9.2 12l1.4 1.4M14.8 12l-1.4-1.4M14.8 12l-1.4 1.4"/>`,
  shield: `<path d="M12 3 5 6v5.5c0 4.2 2.9 7.4 7 9.5 4.1-2.1 7-5.3 7-9.5V6l-7-3Z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.6"/>`,
  flag: `<path d="M5 21V4m0 0h11l-2 3.5L16 11H5"/>`,
  alert: `<path d="M12 3.6 2.9 20h18.2L12 3.6Z"/><path d="M12 9.4v4.6M12 17.1h.01"/>`,
  globe: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.4 4 5.4 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.4-4-9s1.4-6.6 4-9Z"/>`,
};

export function icon(name, { className = "", size = 24, label = "" } = {}) {
  const body = ICONS[name];
  if (!body) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="ic ${className}" data-icon="${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${body}</svg>`;
}

// ------------------------------------------------------------------ primitives
export const chip = (text, { tone = "accent", iconName, className = "" } = {}) =>
  `<span class="chip chip--${tone} ${className}" data-chip="${esc(text)}">${iconName ? icon(iconName, { size: 15 }) : ""}${text}</span>`;

export const tag = (text, { tone = "" } = {}) => `<span class="tag ${tone ? `tag--${tone}` : ""}">${text}</span>`;

export const stat = ({ value, unit, label, note, tone = "accent", className = "" }) => `
  <div class="stat stat--${tone} ${className}">
    <div class="stat__v">${value}${unit ? `<span class="stat__u">${unit}</span>` : ""}</div>
    <div class="stat__l">${label}</div>
    ${note ? `<div class="stat__n">${note}</div>` : ""}
  </div>`;

export const card = ({ iconName, eyebrow, title, text, className = "" }) => `
  <article class="card ${className}">
    ${iconName ? `<span class="card__ic">${icon(iconName, { size: 22 })}</span>` : ""}
    ${eyebrow ? `<div class="card__eyebrow">${eyebrow}</div>` : ""}
    ${title ? `<h3 class="card__t">${title}</h3>` : ""}
    ${text ? `<p class="card__x">${text}</p>` : ""}
  </article>`;

export const bullets = (items, { className = "", iconName } = {}) => `
  <ul class="bullets ${className}">
    ${items.map((it) => `<li>${iconName ? icon(iconName, { className: "bullets__ic", size: 18 }) : ""}<span>${it}</span></li>`).join("")}
  </ul>`;

/** Горизонтальный маршрут: станции на общей нити. */
export const route = (steps, { className = "", activeFrom = -1 } = {}) => `
  <ol class="route ${className}">
    ${steps
      .map(
        (s, i) => `<li class="station ${i >= activeFrom && activeFrom >= 0 ? "is-on" : ""}">
          <span class="station__dot">${icon(s.icon, { size: 24 })}</span>
          <span class="station__name">${s.name}</span>
          ${s.sub ? `<span class="station__sub">${s.sub}</span>` : ""}
        </li>`
      )
      .join("")}
  </ol>`;

export const screenshot = ({ src, alt, url = "app.axiona.world", className = "", slot = "" }) => `
  <figure class="shot ${className}">
    <div class="shot__bar"><span class="shot__dots" aria-hidden="true"></span><span class="shot__url">${esc(url)}</span></div>
    <div class="shot__crop"><img src="${esc(src)}" alt="${esc(alt)}" loading="eager" ${slot ? `data-shot-slot="${esc(slot)}"` : ""}/></div>
  </figure>`;

export const person = ({ initials, name, role, note, tone = "indigo" }) => `
  <article class="person person--${tone}" data-initials="${esc(initials)}">
    <div class="person__ava" aria-hidden="true">${initials}</div>
    <div class="person__body">
      <div class="person__name">${name}</div>
      <div class="person__role">${role}</div>
      ${note ? `<p class="person__note">${note}</p>` : ""}
    </div>
  </article>`;

export const rowsTable = ({ head, rows, className = "" }) => `
  <div class="tbl ${className}">
    ${head ? `<div class="tbl__head">${head.map((h, i) => `<span class="${i === head.length - 1 ? "is-end" : ""}">${h}</span>`).join("")}</div>` : ""}
    ${rows
      .map(
        (r) => `<div class="tbl__row ${r.className ?? ""}">
          <span class="tbl__c">${r.cells[0]}</span>
          <span class="tbl__c">${r.cells[1]}</span>
          ${r.cells[2] !== undefined ? `<span class="tbl__c is-end">${r.cells[2]}</span>` : ""}
        </div>`
      )
      .join("")}
  </div>`;

export const bars = (items, { className = "" } = {}) => {
  const max = Math.max(...items.map((i) => i.value));
  return `<div class="bars ${className}">${items
    .map(
      (i) => `<div class="bars__row">
        <span class="bars__label">${i.label}</span>
        <span class="bars__track"><span class="bars__fill" style="width:${Math.round((i.value / max) * 100)}%"></span></span>
        <span class="bars__val">${i.display}</span>
      </div>`
    )
    .join("")}</div>`;
};

/** Пончик use-of-funds. Сегменты — доли, легенда — подписи с суммами. */
export const donut = (segments, { centerTop, centerSub } = {}) => {
  const R = 78;
  const C = 2 * Math.PI * R;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  const rings = segments
    .map((s, i) => {
      const len = (s.value / total) * C;
      const off = (acc / total) * C;
      acc += s.value;
      const track = i === 0 ? 0 : 0;
      return `<circle class="donut__seg" cx="110" cy="110" r="${R}" fill="none" stroke="${s.color}" stroke-width="26"
        stroke-dasharray="${len - 2.5} ${C - len + 2.5}" stroke-dashoffset="${-off + track}" transform="rotate(-90 110 110)"/>`;
    })
    .join("");
  return `<div class="donut-wrap">
    <svg class="donut" viewBox="0 0 220 220" role="img" aria-label="Структура расходов">
      <circle cx="110" cy="110" r="${R}" fill="none" stroke="#eef2f7" stroke-width="26"/>
      ${rings}
      <text x="110" y="104" text-anchor="middle" class="donut__top">${centerTop ?? ""}</text>
      <text x="110" y="130" text-anchor="middle" class="donut__sub">${centerSub ?? ""}</text>
    </svg>
    <ul class="legend">
      ${segments.map((s) => `<li><span class="legend__sw" style="background:${s.color}"></span><span class="legend__t">${s.label}</span><span class="legend__v">${s.display}</span></li>`).join("")}
    </ul>
  </div>`;
};

// ------------------------------------------------------------------------ CSS
export const CSS = String.raw`
:root {
  --ink: #132238; --ink-strong: #111827; --muted: #5f6f85;
  --line: #e2e8f0; --line-soft: #eef2f7;
  --bg: #f8fafc; --card: #ffffff;
  --accent: #4f46e5; --accent-dark: #3730a3; --accent-soft: #eef2ff; --accent-sky: #0ea5e9;
  --dark: #0f1724;
  --r-12: 12px; --r-16: 16px; --r-24: 24px;
  --font: "Geist", "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  --shadow-soft: 0 4px 12px rgba(15, 23, 42, .04);
  --shadow-card: 0 10px 30px rgba(19, 34, 56, .07);
  --shadow-float: 0 22px 60px rgba(19, 34, 56, .16);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { color-scheme: light; }
body {
  font-family: var(--font);
  color: var(--ink);
  background: #e8edf4;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
#deck { display: flex; flex-direction: column; align-items: center; gap: 26px; padding: 26px; }
.slide {
  position: relative;
  width: 1280px; height: 720px;
  background: var(--bg);
  overflow: hidden;
  padding: 50px 62px 40px;
  display: flex; flex-direction: column;
  box-shadow: 0 18px 50px rgba(19, 34, 56, .14);
  flex: 0 0 auto;
}
.slide::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(circle at 1px 1px, #e8edf4 1.05px, transparent 0);
  background-size: 24px 24px;
}
.slide::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(900px 420px at 8% -6%, rgba(255,255,255,.95), rgba(255,255,255,0) 62%);
}
.slide--dark { background: var(--dark); color: #f8fafc; }
.slide--dark::before { background-image: radial-gradient(circle at 1px 1px, #25324a 1.05px, transparent 0); }
.slide--dark::after { background: radial-gradient(1000px 520px at 88% -10%, rgba(79,70,229,.28), rgba(15,23,36,0) 62%); }
.slide > * { position: relative; z-index: 1; }

/* ---------------------------------------------------------------- header */
.kicker { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--accent-dark); }
.kicker::before { content: ""; width: 22px; height: 1.5px; background: currentColor; opacity: .75; border-radius: 2px; }
.slide--dark .kicker { color: #8fb4ff; }
h2.title { font-size: 40px; line-height: 1.1; letter-spacing: -.032em; font-weight: 620; margin: 13px 0 0; max-width: 1120px; color: var(--ink-strong); }
.slide--dark h2.title { color: #fff; }
.lede { margin: 11px 0 0; font-size: 19px; line-height: 1.42; color: var(--muted); max-width: 940px; letter-spacing: -.005em; }
.slide--dark .lede { color: #b8c4d8; }
.content { flex: 1; min-height: 0; margin-top: 22px; display: flex; flex-direction: column; }
.hi { color: var(--accent); }
.slide--dark .hi { color: #9db8ff; }
.nowrap { white-space: nowrap; }

/* ----------------------------------------------------------------- footer */
.footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 24px; border-top: 1px solid var(--line-soft); padding-top: 10px; font-size: 10.5px; line-height: 1.3; color: var(--muted); letter-spacing: .015em; }
.slide--dark .footer { border-color: #223047; color: #7f8ca3; }
.footer__src { max-width: 840px; display: flex; align-items: center; gap: 8px; }
.footer__right { display: flex; align-items: center; gap: 10px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.footer .logo-mark { opacity: .8; }
.footer--bare { position: absolute; left: 62px; right: 62px; bottom: 40px; margin: 0; z-index: 2; }

/* ------------------------------------------------------------------- logo */
.logo-lockup { display: inline-flex; align-items: center; gap: 13px; }
.logo-mark { display: block; }
.logo-word { display: block; }
.cover-logo { display: flex; align-items: center; gap: 16px; }

/* ------------------------------------------------------------------ chips */
.chip { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; letter-spacing: .005em; color: var(--accent-dark); background: var(--accent-soft); border: 1px solid #e0e5ff; border-radius: 999px; padding: 6px 12px; white-space: nowrap; }
.chip .ic { opacity: .85; }
.chip--muted { color: var(--muted); background: #f1f5f9; border-color: var(--line); }
.chip--sky { color: #075985; background: #e0f2fe; border-color: #bae6fd; }
.chip--foundation { color: var(--tierFoundation); background: var(--tierFoundationBg); border-color: #fed7aa; }
.chip--dark { color: #c7d8ff; background: rgba(79,70,229,.18); border-color: rgba(143,180,255,.35); }
.tag { display: inline-flex; align-items: center; font-size: 11.5px; font-weight: 600; color: var(--muted); background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 6px 11px; white-space: nowrap; }
.tag--on { color: var(--accent-dark); background: var(--accent-soft); border-color: #dbe2ff; }
.slide--dark .tag { color: #c2cde0; background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.14); }
.slide--dark .tag--on { color: #dbe4ff; background: rgba(79,70,229,.28); border-color: rgba(143,180,255,.4); }

/* ------------------------------------------------------------------ stats */
.stat-grid { display: grid; gap: 14px; }
.stat { background: var(--card); border: 1px solid #e7ecf3; border-radius: var(--r-16); padding: 18px 20px 16px; box-shadow: var(--shadow-soft); display: flex; flex-direction: column; min-width: 0; }
.stat--flat { background: transparent; border-color: var(--line-soft); box-shadow: none; }
.stat--dark { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.1); box-shadow: none; }
.stat__v { font-size: 42px; line-height: 1; font-weight: 600; letter-spacing: -.045em; color: var(--ink-strong); font-variant-numeric: tabular-nums; white-space: nowrap; }
.stat--accent .stat__v { color: var(--accent-dark); }
.slide--dark .stat__v { color: #fff; }
.stat__u { font-size: .46em; font-weight: 550; letter-spacing: -.01em; margin-left: 3px; color: var(--muted); }
.stat__l { margin-top: 10px; font-size: 13.5px; line-height: 1.32; color: var(--muted); }
.stat__n { margin-top: 6px; font-size: 10.5px; line-height: 1.35; color: var(--muted); opacity: .8; }
.stat--big .stat__v { font-size: 64px; }
.stat--mid .stat__v { font-size: 36px; letter-spacing: -.03em; }
.stat--tall { min-height: 238px; justify-content: center; padding: 22px 22px 20px; }
.stat--tall .stat__v { font-size: 48px; }
.stat--tall .stat__l { font-size: 14.5px; }

/* ------------------------------------------------------------------ cards */
.card { background: var(--card); border: 1px solid #e7ecf3; border-radius: var(--r-16); padding: 18px 19px; box-shadow: var(--shadow-soft); display: flex; flex-direction: column; min-width: 0; }
.card--plain { box-shadow: none; background: transparent; border-color: var(--line-soft); }
.card__ic { width: 38px; height: 38px; border-radius: 11px; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; margin-bottom: 12px; }
.card__eyebrow { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--accent-dark); margin-bottom: 6px; }
.card__t { margin: 0 0 6px; font-size: 17px; line-height: 1.22; letter-spacing: -.015em; font-weight: 600; color: var(--ink-strong); }
.card__x { margin: 0; font-size: 14px; line-height: 1.45; color: var(--muted); }
.slide--dark .card { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.11); box-shadow: none; }
.slide--dark .card__t { color: #fff; }
.slide--dark .card__x { color: #aeb9cc; }
.slide--dark .card__eyebrow { color: #9db8ff; }
.slide--dark .card__ic { background: rgba(79,70,229,.22); color: #c7d8ff; }

/* ---------------------------------------------------------------- bullets */
.bullets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 15px; }
.bullets li { position: relative; padding-left: 22px; font-size: 17px; line-height: 1.42; color: #334155; letter-spacing: -.004em; }
.bullets li::before { content: ""; position: absolute; left: 3px; top: .58em; width: 7px; height: 7px; border-radius: 2px; background: var(--accent); opacity: .9; transform: rotate(45deg); }
.bullets b, .bullets strong { color: var(--ink-strong); font-weight: 600; }
.slide--dark .bullets li { color: #c3cee0; }
.slide--dark .bullets li::before { background: #8fb4ff; }
.bullets .bullets__ic { position: absolute; left: 0; top: .22em; color: var(--accent); }

/* ------------------------------------------------------------------ route */
.route { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(var(--stations, 6), 1fr); gap: 10px; position: relative; }
.route::before { content: ""; position: absolute; left: 7%; right: 7%; top: 29px; height: 1.5px; background: linear-gradient(90deg, #dfe5f2 0%, #c7d2fe 22%, var(--accent) 58%, var(--accent-sky) 100%); opacity: .85; }
.station { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
.station__dot { width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 1.5px solid #dbe3ef; color: var(--accent); box-shadow: 0 4px 12px rgba(19,34,56,.06); position: relative; z-index: 1; }
.station.is-on .station__dot { background: var(--accent); border-color: var(--accent); color: #fff; box-shadow: 0 8px 22px rgba(79,70,229,.35); }
.station__name { font-size: 13.5px; font-weight: 600; color: var(--ink-strong); letter-spacing: -.01em; margin-top: 2px; }
.station__sub { font-size: 11px; line-height: 1.35; color: var(--muted); max-width: 150px; }
.slide--dark .station__dot { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.14); color: #c7d8ff; }
.slide--dark .station__name { color: #fff; }
.slide--dark .station__sub { color: #94a3b8; }

/* --------------------------------------------------------------- timeline */
.timeline { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; position: relative; }
.timeline::before { content: ""; position: absolute; left: 0; right: 0; top: 31px; height: 1.5px; background: linear-gradient(90deg, #dfe5f2, #c7d2fe 55%, var(--accent)); }
.tcol { position: relative; display: flex; flex-direction: column; }
.tcol__dot { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid var(--accent); margin: 25px auto 0; position: relative; z-index: 1; box-shadow: 0 0 0 5px #f8fafc; }
.tcol.is-now .tcol__dot { background: var(--accent); }
.tcol__card { margin-top: 12px; background: var(--card); border: 1px solid #e7ecf3; border-radius: var(--r-16); padding: 20px 20px; box-shadow: var(--shadow-soft); flex: 1; }
.tcol__when { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--accent-dark); }
.tcol__title { font-size: 17px; font-weight: 600; color: var(--ink-strong); margin-top: 6px; line-height: 1.28; }
.tcol__x { margin: 9px 0 0; font-size: 13.5px; line-height: 1.45; color: var(--muted); }
.tcol__list { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.tcol__list li { position: relative; padding-left: 14px; font-size: 13.5px; line-height: 1.4; color: var(--muted); }
.tcol__list li::before { content: ""; position: absolute; left: 2px; top: .62em; width: 4px; height: 4px; border-radius: 1px; background: #a5b4fc; transform: rotate(45deg); }
.tcol__gates { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.tcol__gates .chip { font-size: 10.5px; padding: 4px 8px; }

/* ------------------------------------------------------------------ table */
.tbl { background: var(--card); border: 1px solid #e7ecf3; border-radius: var(--r-16); overflow: hidden; box-shadow: var(--shadow-soft); }
.tbl__head, .tbl__row { display: grid; grid-template-columns: 1.15fr 1.25fr 1fr; gap: 16px; padding: 18px 20px; align-items: baseline; }
.tbl__head { background: #fbfcfe; border-bottom: 1px solid var(--line-soft); font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: #8491a5; }
.tbl__row + .tbl__row { border-top: 1px solid var(--line-soft); }
.tbl__row:nth-child(even) { background: #fcfdff; }
.tbl__c { font-size: 14.5px; line-height: 1.35; color: #3b4a61; min-width: 0; }
.tbl__c b { color: var(--ink-strong); font-weight: 600; }
.tbl__c.is-end { color: var(--accent-dark); font-weight: 550; }
.tbl--2 .tbl__head, .tbl--2 .tbl__row { grid-template-columns: 1.5fr 1fr; }

/* -------------------------------------------------------------------- map */
.map { display: block; width: 100%; height: auto; }
.map-frame { position: relative; }
.map-frame .map-note { margin-top: 7px; font-size: 10px; line-height: 1.35; color: var(--muted); }

/* ------------------------------------------------------------------ shots */
.shot { margin: 0; background: #fff; border: 1px solid #e3e9f2; border-radius: 14px; overflow: hidden; box-shadow: var(--shadow-float); display: flex; flex-direction: column; min-height: 0; }
.shot__bar { height: 28px; flex: 0 0 28px; display: flex; align-items: center; gap: 7px; padding: 0 12px; background: #fbfcfe; border-bottom: 1px solid #eef2f7; }
.shot__dots { width: 7px; height: 7px; border-radius: 50%; background: #dbe2ec; box-shadow: 12px 0 0 #dbe2ec, 24px 0 0 #dbe2ec; margin-right: 24px; }
.shot__url { font-size: 10px; color: #7c8798; letter-spacing: .01em; }
.shot__crop { flex: 1; min-height: 0; overflow: hidden; }
.shot img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top center; }
.shot--small { border-radius: 12px; }
.shot--small .shot__bar { height: 24px; flex-basis: 24px; }
.shot--small .shot__url { font-size: 9px; }
.shot:not(.shot--big):not(.shot--small) { aspect-ratio: 1.42; }
.stack .shot--big { position: absolute; right: 0; top: 0; width: 600px; height: 404px; }
.stack .shot--small { position: absolute; left: 0; bottom: 0; width: 286px; height: 200px; z-index: 2; border-color: #dbe3ef; }

/* --------------------------------------------------------------- persons */
.persons { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.person { display: flex; gap: 16px; align-items: flex-start; background: var(--card); border: 1px solid #e7ecf3; border-radius: var(--r-16); padding: 18px 19px; box-shadow: var(--shadow-soft); }
.person__ava { width: 78px; height: 78px; flex: 0 0 78px; border-radius: 50%; display: grid; place-items: center; font-size: 25px; font-weight: 600; letter-spacing: -.02em; color: var(--accent-dark); background: radial-gradient(120% 120% at 25% 18%, #ffffff 0%, #e8ecff 52%, #dfe5ff 100%); border: 1px solid #dbe3f5; box-shadow: inset 0 1px 0 #fff, 0 6px 16px rgba(79,70,229,.10); }
.person--sky .person__ava { color: #075985; background: radial-gradient(120% 120% at 25% 18%, #ffffff 0%, #e6f6ff 52%, #d8f0fe 100%); border-color: #cfeafb; box-shadow: inset 0 1px 0 #fff, 0 6px 16px rgba(14,165,233,.10); }
.person__name { font-size: 17px; font-weight: 600; letter-spacing: -.015em; color: var(--ink-strong); }
.person__role { margin-top: 3px; font-size: 11.5px; font-weight: 600; color: var(--accent-dark); }
.person--sky .person__role { color: #0c6a91; }
.person__note { margin: 8px 0 0; font-size: 12.8px; line-height: 1.42; color: var(--muted); }

/* ---------------------------------------------------------------- donut */
.donut-wrap { display: grid; grid-template-columns: 232px 1fr; gap: 16px; align-items: center; }
.donut { width: 232px; height: 232px; display: block; }
.donut__top { font-family: var(--font); font-size: 30px; font-weight: 600; fill: var(--ink-strong); letter-spacing: -.04em; }
.donut__sub { font-family: var(--font); font-size: 10px; font-weight: 600; fill: var(--muted); letter-spacing: .12em; text-transform: uppercase; }
.legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.legend li { display: grid; grid-template-columns: 10px 1fr auto; gap: 9px; align-items: baseline; font-size: 11.5px; line-height: 1.3; color: var(--muted); }
.legend__sw { width: 9px; height: 9px; border-radius: 3px; transform: translateY(1px); }
.legend__t { color: #3b4a61; }
.legend__v { font-variant-numeric: tabular-nums; color: var(--ink-strong); font-weight: 600; font-size: 11px; white-space: nowrap; }

/* ------------------------------------------------------------- gap flow */
.gapflow { display: flex; flex-direction: column; gap: 0; }
.gapflow__item { display: flex; align-items: center; gap: 16px; background: #fff; border: 1px solid #e7ecf3; border-radius: 15px; padding: 22px 20px; box-shadow: var(--shadow-soft); }
.gapflow__ic { width: 52px; height: 52px; flex: 0 0 52px; border-radius: 14px; display: grid; place-items: center; background: #f1f5f9; color: var(--muted); }
.gapflow__body b { display: block; font-size: 16.5px; font-weight: 600; color: var(--ink-strong); letter-spacing: -.01em; }
.gapflow__body span { display: block; font-size: 13px; color: var(--muted); margin-top: 3px; }
.gapflow__item.is-q { border-style: dashed; border-color: #c7d2fe; background: linear-gradient(180deg, #fff, #f4f6ff); }
.gapflow__item.is-q .gapflow__ic { background: var(--accent-soft); color: var(--accent); }
.gapflow__item.is-q b { color: var(--accent-dark); }
.gapflow__link { height: 24px; margin-left: 44px; border-left: 1.5px dashed #c7d2fe; }

/* ------------------------------------------------------------------ steps */
.steps { display: flex; flex-direction: column; gap: 13px; }
.step { display: flex; gap: 13px; align-items: flex-start; }
.step__n { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 1px solid #dbe3ef; color: var(--accent); box-shadow: 0 4px 12px rgba(19,34,56,.05); }
.step__t { font-size: 15px; font-weight: 600; line-height: 1.3; color: var(--ink-strong); letter-spacing: -.01em; }
.step__x { font-size: 12.5px; line-height: 1.4; color: var(--muted); margin-top: 2px; }

/* -------------------------------------------------------------------- gtm */
.gtm { display: grid; grid-template-columns: 1fr 20px 1fr 20px 1fr; gap: 8px; align-items: stretch; }
.gtm__arrow { display: grid; place-items: center; color: #c7d2fe; }
.gtm__card { background: #fff; border: 1px solid #e7ecf3; border-radius: 16px; padding: 19px 20px; box-shadow: var(--shadow-soft); display: flex; flex-direction: column; min-height: 250px; }
.gtm__stage { font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--accent-dark); }
.gtm__title { font-size: 18px; font-weight: 600; letter-spacing: -.015em; color: var(--ink-strong); margin-top: 5px; }
.gtm__x { margin: 9px 0 0; font-size: 13px; line-height: 1.5; color: var(--muted); flex: 1; }
.gtm__check { margin-top: auto; padding-top: 10px; font-size: 11.5px; line-height: 1.4; color: var(--muted); display: flex; gap: 7px; align-items: flex-start; }
.gtm__check::before { content: ""; width: 6px; height: 6px; border-radius: 2px; background: var(--accent); opacity: .85; transform: rotate(45deg); margin-top: .45em; flex: 0 0 6px; }
.gtm__chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.gtm__chips .tag { font-size: 10.5px; padding: 4px 8px; }
.gtm__card.is-first { border-color: #c7d2fe; box-shadow: 0 10px 30px rgba(79,70,229,.10); }
.gtm__card.is-first .gtm__title { color: var(--accent-dark); }

/* --------------------------------------------------------------- use items */
.use { display: flex; flex-direction: column; gap: 9px; }
.use__row { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: baseline; padding-bottom: 11px; border-bottom: 1px solid var(--line-soft); }
.use__row:last-child { border-bottom: 0; padding-bottom: 0; }
.use__l { font-size: 13px; line-height: 1.35; color: #3b4a61; }
.use__l small { display: block; font-size: 10.5px; color: var(--muted); margin-top: 1px; }
.use__v { font-size: 13.5px; font-weight: 600; color: var(--ink-strong); font-variant-numeric: tabular-nums; white-space: nowrap; }

/* -------------------------------------------------------------- stack col */
.stackcol { display: flex; flex-direction: column; height: 100%; }
.stackcol > .card { margin-top: auto; }

/* ---------------------------------------------------------------- target */
.target { margin-top: 18px; }
.target__head { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; font-size: 12px; color: var(--muted); }
.target__k { font-weight: 600; color: #3b4a61; }
.target__v b { color: var(--ink-strong); font-weight: 600; }
.target__track { position: relative; height: 8px; border-radius: 999px; background: #eef2f7; margin-top: 11px; }
.target__fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #4f46e5, #0ea5e9); }
.target__mark { position: absolute; top: -4px; width: 2px; height: 16px; border-radius: 2px; background: #94a3b8; }

/* ----------------------------------------------------------------- gates */
.gates { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
.gates__item { display: flex; align-items: baseline; gap: 14px; background: #fff; border: 1px solid #e7ecf3; border-radius: 14px; padding: 13px 16px; box-shadow: var(--shadow-soft); }
.gates__k { flex: 0 0 auto; font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--accent-dark); }
.gates__v { font-size: 12.5px; line-height: 1.4; color: var(--muted); }

/* ------------------------------------------------------------------ glue */
.glue { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; background: #fff; border: 1px solid #e7ecf3; border-radius: 14px; padding: 13px 16px; box-shadow: var(--shadow-soft); }
.glue__k { font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--accent-dark); margin-right: 4px; }
.glue__arr { color: #c7d2fe; display: inline-flex; align-items: center; }

/* -------------------------------------------------------------- first1000 */
.first1000 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: #fff; border: 1px solid #e7ecf3; border-radius: 14px; padding: 13px 16px; box-shadow: var(--shadow-soft); }
.first1000__k { font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--accent-dark); margin-right: 4px; }
.first1000__s { font-size: 12.5px; font-weight: 600; color: var(--ink-strong); }
.first1000__arr { color: #c7d2fe; }
.first1000__n { margin-left: auto; font-size: 11px; color: var(--muted); }

/* --------------------------------------------------------------- takeaway */
.takeaway { margin-top: auto; display: flex; gap: 16px; align-items: flex-start; padding: 14px 0 10px; border-top: 1px solid var(--line-soft); }
.takeaway__k { min-width: 82px; font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--accent-dark); padding-top: 4px; }
.takeaway__t { font-size: 18px; line-height: 1.4; color: #334155; max-width: 1030px; letter-spacing: -.005em; }
.takeaway__t b { color: var(--ink-strong); font-weight: 600; }
.slide--dark .takeaway { border-color: #223047; }
.slide--dark .takeaway__t { color: #c3cee0; }

/* -------------------------------------------------------------- tranches */
.tranches { display: flex; gap: 10px; margin-top: 20px; }
.tranche { border: 1px solid #e7ecf3; border-radius: 14px; background: #fff; padding: 12px 16px; display: flex; align-items: baseline; gap: 10px; box-shadow: var(--shadow-soft); }
.tranche b { font-size: 14.5px; font-weight: 600; color: var(--ink-strong); letter-spacing: -.01em; white-space: nowrap; }
.tranche span { font-size: 12px; color: var(--muted); white-space: nowrap; }
.tranche--t1 { flex: 7; border-color: #c7d2fe; background: linear-gradient(90deg, #f5f7ff, #fff); }
.tranche--t2 { flex: 3; }

/* ------------------------------------------------------------- cover tweak */
.slide--bare { padding: 0; }
.cover, .close { position: absolute; inset: 0; padding: 46px 62px 40px; display: flex; flex-direction: column; }

/* ---------------------------------------------------------------- misc */
.principle { display: flex; gap: 12px; align-items: flex-start; }
.principle__ic { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 10px; display: grid; place-items: center; background: #fff; border: 1px solid var(--line); color: var(--accent); box-shadow: var(--shadow-soft); }
.principle__t { font-size: 14px; font-weight: 600; color: var(--ink-strong); }
.principle__x { margin-top: 3px; font-size: 12px; line-height: 1.4; color: var(--muted); }
.hr { height: 1px; background: var(--line-soft); border: 0; margin: 0; }
.note-line { font-size: 12px; line-height: 1.4; color: var(--muted); display: flex; align-items: center; gap: 8px; }
.note-line .ic { color: var(--accent); flex: 0 0 auto; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.spread { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.mt-8 { margin-top: 8px; } .mt-12 { margin-top: 12px; } .mt-16 { margin-top: 16px; } .mt-20 { margin-top: 20px; } .mt-24 { margin-top: 24px; }
.grow { flex: 1; min-height: 0; }
.muted { color: var(--muted); }
.bigline { font-size: 30px; line-height: 1.22; letter-spacing: -.025em; font-weight: 600; color: var(--ink-strong); }
.slide--dark .bigline { color: #fff; }

/* --------------------------------------------------------------- covers */
.cover { padding: 46px 62px 40px; }
.cover__top { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; }
.cover__meta { font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: #7f8ca3; font-weight: 600; }
.cover__map { position: absolute; right: -80px; bottom: -26px; width: 1080px; opacity: .52; z-index: 0; pointer-events: none; }
.cover__shade { position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background:
    linear-gradient(90deg, var(--dark) 0%, rgba(15,23,36,.97) 24%, rgba(15,23,36,.78) 44%, rgba(15,23,36,.28) 66%, rgba(15,23,36,0) 88%),
    linear-gradient(180deg, var(--dark) 0%, rgba(15,23,36,0) 16%, rgba(15,23,36,0) 64%, rgba(15,23,36,.95) 100%); }
.cover__body { position: relative; margin-top: 58px; max-width: 820px; z-index: 2; }
.cover h1 { margin: 20px 0 0; font-size: 53px; line-height: 1.05; letter-spacing: -.045em; font-weight: 600; color: #fff; max-width: 840px; }
.cover__lede { margin: 20px 0 0; font-size: 20px; line-height: 1.5; color: #b8c4d8; max-width: 620px; }
.cover__tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
.cover__people { margin-top: 34px; display: flex; gap: 30px; flex-wrap: wrap; }
.cover__person { font-size: 12.5px; color: #d7dfeb; line-height: 1.4; }
.cover__person b { font-weight: 600; color: #fff; }
.cover__person span { display: block; color: #8d9ab1; font-size: 11.5px; margin-top: 1px; }
.cover__contact { position: absolute; left: 62px; bottom: 74px; font-size: 12px; color: #b8c4d8; display: flex; gap: 18px; align-items: center; z-index: 2; }
.cover__contact b { color: #fff; font-weight: 600; }
.cover__route { margin-top: 30px; display: flex; align-items: center; gap: 10px; font-size: 11.5px; color: #8d9ab1; }
.cover__route .dash { flex: 1; height: 1px; background: linear-gradient(90deg, #8fb4ff, rgba(143,180,255,.15)); max-width: 150px; }
.close h2 { font-size: 46px; line-height: 1.08; max-width: 1020px; }
.close__theses { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 28px; max-width: 1040px; }
.close__ask { margin-top: 26px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.close__map { position: absolute; left: 0; right: 0; bottom: -30px; opacity: .55; z-index: 0; pointer-events: none; }
.close__map::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, var(--dark) 0%, rgba(15,23,36,.35) 45%, rgba(15,23,36,.9) 100%); }

/* ----------------------------------------------------------- present mode */
body.is-present { overflow: hidden; background: #0b1220; }
body.is-present #deck { position: fixed; inset: 0; display: block; padding: 0; }
body.is-present .slide { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(var(--deck-scale, 1)); display: none; box-shadow: 0 40px 120px rgba(0,0,0,.55); }
body.is-present .slide.is-active { display: flex; }
.hud { display: none; position: fixed; right: 18px; bottom: 14px; z-index: 60; font: 600 11px/1 var(--font); letter-spacing: .08em; color: #93a3bb; background: rgba(11,18,32,.72); border: 1px solid rgba(255,255,255,.12); border-radius: 999px; padding: 8px 12px; backdrop-filter: blur(8px); }
body.is-present .hud { display: flex; gap: 10px; align-items: center; }
.hud b { color: #e2e8f0; font-weight: 600; }
.notes-panel { display: none; position: fixed; left: 16px; right: 16px; bottom: 16px; z-index: 70; background: rgba(11,18,32,.94); color: #cbd5e1; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 16px 20px; font-size: 14px; line-height: 1.5; max-height: 34vh; overflow: auto; backdrop-filter: blur(10px); }
.notes-panel.is-open { display: block; }
.notes-panel__k { font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: #8fb4ff; font-weight: 700; margin-bottom: 6px; }
.notes-panel__t { color: #e2e8f0; }
.help { display: none; position: fixed; left: 18px; bottom: 14px; z-index: 60; font: 500 11px/1.4 var(--font); color: #7f8ca3; }
body.is-present .help { display: block; }

/* --------------------------------------------------------------- export */
html.is-export #deck { padding: 0; gap: 0; display: block; }
html.is-export .slide { box-shadow: none; }
html.is-export .hud, html.is-export .notes-panel, html.is-export .help { display: none !important; }

@media print {
  @page { size: 13.333in 7.5in; margin: 0; }
  html, body { background: #fff; }
  #deck { display: block; padding: 0; gap: 0; }
  .slide { box-shadow: none; margin: 0; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; }
  .slide:last-child { page-break-after: auto; break-after: auto; }
  body.is-present .slide { display: flex !important; position: static !important; transform: none !important; }
  .hud, .notes-panel, .help { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

// ------------------------------------------------------------------------- JS
const JS = String.raw`
(() => {
  const slides = [...document.querySelectorAll(".slide")];
  if (!slides.length) return;
  const q = new URLSearchParams(location.search);
  const exportN = Number(q.get("slide"));
  if (q.get("export") === "1" && exportN) {
    document.documentElement.classList.add("is-export");
    slides.forEach((s, i) => { if (i + 1 !== exportN) s.remove(); });
    return;
  }
  let index = 0;
  let active = false;
  const total = slides.length;
  const hud = document.querySelector(".hud");
  const notes = document.querySelector(".notes-panel");
  const count = hud?.querySelector("[data-hud-count]");
  const section = hud?.querySelector("[data-hud-section]");
  const scale = () => {
    const s = Math.min(innerWidth / 1280, innerHeight / 720);
    document.documentElement.style.setProperty("--deck-scale", String(s));
  };
  const show = (n) => {
    index = Math.max(0, Math.min(total - 1, n));
    slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
    if (count) count.textContent = String(index + 1).padStart(2, "0") + " / " + total;
    if (section) section.textContent = slides[index].dataset.section || "";
    if (notes) notes.querySelector("[data-notes-text]").textContent = slides[index].dataset.notes || "";
  };
  const toggleNotes = () => notes?.classList.toggle("is-open");
  const enter = () => {
    active = true;
    document.body.classList.add("is-present");
    document.documentElement.style.setProperty("--deck-scale", String(Math.min(innerWidth / 1280, innerHeight / 720)));
    show(index);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const exit = () => {
    active = false;
    document.body.classList.remove("is-present");
    document.exitFullscreen?.().catch(() => {});
  };
  addEventListener("resize", () => { if (active) scale(); });
  addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); if (!active) enter(); else show(index + 1); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); show(index - 1); }
    else if (k === "Home") { e.preventDefault(); show(0); }
    else if (k === "End") { e.preventDefault(); show(total - 1); }
    else if (k.toLowerCase() === "f") { e.preventDefault(); active ? exit() : enter(); }
    else if (k.toLowerCase() === "n") { e.preventDefault(); if (!active) enter(); toggleNotes(); }
    else if (k === "Escape" && active) { exit(); }
  });
  // Клик по слайду — только в режиме просмотра, чтобы не мешать выделять текст.
  addEventListener("click", (e) => {
    if (!active || !e.target.closest(".slide")) return;
    const r = e.target.closest(".slide").getBoundingClientRect();
    show(index + (e.clientX - r.left > r.width / 2 ? 1 : -1));
  });
  show(0);
  if (q.get("present") === "1") enter();
})();
`;


// --------------------------------------------------------------- layout audit
// Запускается только при ?audit=1 (build/audit.mjs): считает, сколько строк
// занимает заголовок, не вылезает ли контент на футер и не перекрываются ли блоки.
const AUDIT_JS = String.raw`
(async () => {
  if (new URLSearchParams(location.search).get("audit") !== "1") return;
  try { await document.fonts.ready; } catch {}
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const slides = [...document.querySelectorAll(".slide")];
  const rect = (el) => el.getBoundingClientRect();
  const data = slides.map((s, i) => {
    const sr = rect(s);
    const footer = s.querySelector(".footer");
    const fr = footer ? rect(footer) : null;
    const title = s.querySelector("h2.title, h1");
    let lines = 0;
    if (title) {
      const r = document.createRange();
      r.selectNodeContents(title);
      lines = [...r.getClientRects()].filter((x) => x.width > 2 && x.height > 2).length;
    }
    const content = s.querySelector(".content");
    let contentBottom = sr.top;
    if (content) for (const el of content.children) contentBottom = Math.max(contentBottom, rect(el).bottom);
    const overFooter = [];
    if (content) for (const el of content.querySelectorAll(".card, .stat, .shot, .map, .person, .tbl, .gtm__card, .tcol__card, .takeaway, .note-line, .map-note")) {
      const r = rect(el);
      if (r.width && fr && r.bottom > fr.top + 1) overFooter.push(el.className.split(" ")[0] + ":" + Math.round(r.bottom - fr.top));
    }
    const kids = content ? [...content.children] : [];
    const overlaps = [];
    for (let a = 0; a < kids.length; a++) for (let b = a + 1; b < kids.length; b++) {
      const ra = rect(kids[a]), rb = rect(kids[b]);
      const iw = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const ih = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (iw > 4 && ih > 4) overlaps.push((kids[a].className || kids[a].tagName) + " / " + (kids[b].className || kids[b].tagName));
    }
    const takeaway = content ? content.querySelector(":scope > .takeaway") : null;
    const takeawayTop = takeaway ? Math.round(rect(takeaway).top - sr.top) : null;
    let mainBottom = sr.top;
    if (content) for (const el of content.children) if (el !== takeaway) mainBottom = Math.max(mainBottom, rect(el).bottom);
    return {
      slide: i + 1,
      titleLines: lines,
      gapBeforeTakeaway: takeaway ? Math.round(rect(takeaway).top - mainBottom) : null,
      titleHeight: title ? Math.round(rect(title).height) : 0,
      contentBottom: Math.round(contentBottom - sr.top),
      footerTop: fr ? Math.round(fr.top - sr.top) : null,
      overflowBy: fr ? Math.max(0, Math.round(contentBottom - fr.top)) : 0,
      overlaps,
      overFooter: overFooter.slice(0, 6)
    };
  });
  const pre = document.createElement("pre");
  pre.id = "audit-data";
  pre.textContent = JSON.stringify({ slides: data });
  document.body.appendChild(pre);
})();
`;

// ------------------------------------------------------------------- shell
export function slideShell(slide, index, total) {
  const dark = slide.theme === "dark" ? " slide--dark" : "";
  const bare = slide.bare ? " slide--bare" : "";
  const cls = `slide${dark}${bare} ${slide.className ?? ""}`.trim();
  const notes = esc(slide.notes || "");
  const label = `Слайд ${index + 1} из ${total}${slide.section ? ` — ${slide.section}` : ""}`;
  const header = slide.bare
    ? ""
    : `<header>
        ${slide.kicker ? `<div class="kicker">${slide.kicker}</div>` : ""}
        ${slide.title ? `<h2 class="title">${slide.title}</h2>` : ""}
        ${slide.lede ? `<p class="lede">${slide.lede}</p>` : ""}
      </header>
      <div class="content">${slide.html ?? ""}</div>`;
  const footer = slide.bare ? (slide.footer ?? "") : `<footer class="footer">
      <div class="footer__src">${slide.footerSource ? `<span>${slide.footerSource}</span>` : ""}</div>
      <div class="footer__right">${logoMark({ width: 16, height: 15 })}<span>${String(index + 1).padStart(2, "0")} / ${total}</span></div>
    </footer>`;
  return `<section class="${cls}" data-index="${index}" data-section="${esc(slide.section || "")}" data-notes="${notes}" aria-label="${esc(label)}">
    ${slide.bare ? (slide.html ?? "") : `${header}${footer}`}
  </section>`;
}

export function renderPage({ title, lang = "ru", slides, meta = {} }) {
  const sections = slides.map((s, i) => slideShell(s, i, slides.length)).join("\n");
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(meta.description || "")}"/>
<link rel="icon" href="assets/logo-mark.svg"/>
<style>${FONT_FACE}
${CSS}</style>
</head>
<body data-total="${slides.length}">
<main id="deck">
${sections}
</main>
<div class="hud"><b data-hud-count>01 / ${slides.length}</b><span data-hud-section></span></div>
<div class="help">← → листать · F — полный экран · N — заметки · Esc — выйти</div>
<aside class="notes-panel" aria-live="polite"><div class="notes-panel__k">Speaker notes</div><div class="notes-panel__t" data-notes-text></div></aside>
<script>${JS}</script>
<script>${AUDIT_JS}</script>
</body>
</html>`;
}
