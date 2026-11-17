#!/usr/bin/env node
/**
 * AXIONA · AV storyboard — детерминированные ключевые кадры из дизайн-токенов.
 *
 * Собирает 8 кадров 16:9 в SVG строго по токенам `apps/web/src/app/globals.css`
 * (+ лого-знак из `apps/web/public/brand/logo-mark.svg`), затем снимает их в PNG
 * через headless Chrome и складывает контактный лист.
 *
 * Зачем: это «нулевая итерация» раскадровки — композиция, ритм и цвет проверяются
 * без трат на генерацию. Эти же SVG можно отдать как первый кадр в Kling/Seedance
 * или собрать из них аниматик.
 *
 * Usage:
 *   node scripts/av/storyboard.mjs [--out docs/design/av] [--no-png]
 *
 * Требует только Chrome (см. --chrome) и Node >= 20.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

// ---------------------------------------------------------------- design tokens
// Источник: apps/web/src/app/globals.css + docs/06-communication/COS-COM-006.
const T = {
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
  dot: "#e8edf4",
  shadow: "#cad4eb",
  tierFoundation: "#b45309",
  tierFoundationBg: "#fff7ed",
  tierCore: "#1d4ed8",
  tierCoreBg: "#eff6ff",
  tierOptional: "#64748b",
  tierOptionalBg: "#f8fafc",
  mark: "#090b0e",
};

const W = 1920;
const H = 1080;
const FONT = "'Geist','Inter',-apple-system,'Segoe UI',system-ui,sans-serif";

// ------------------------------------------------------------------ primitives
const shadow = (dy = 8, blur = 18, op = 0.5) =>
  `<filter id="sh" x="-30%" y="-30%" width="160%" height="180%">
     <feDropShadow dx="0" dy="${dy}" stdDeviation="${blur}" flood-color="${T.shadow}" flood-opacity="${op}"/>
   </filter>`;

const shadowNeedle = (dy = 3, blur = 6, op = 0.6) =>
  `<filter id="shN" x="-30%" y="-30%" width="160%" height="180%">
     <feDropShadow dx="0" dy="${dy}" stdDeviation="${blur}" flood-color="${T.shadow}" flood-opacity="${op}"/>
   </filter>`;

const defs = () => `
  <defs>
    ${shadow()}
    ${shadowNeedle()}
    <pattern id="dots" width="64" height="64" patternUnits="userSpaceOnUse">
      <circle cx="16" cy="18" r="2.1" fill="${T.dot}"/>
      <circle cx="48" cy="50" r="2.1" fill="${T.dot}"/>
    </pattern>
    <radialGradient id="daylight" cx="18%" cy="6%" r="86%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="progress" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${T.accentDark}"/>
      <stop offset="55%" stop-color="${T.accent}"/>
      <stop offset="100%" stop-color="${T.accentSky}"/>
    </linearGradient>
    <linearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${T.bg}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${T.bg}" stop-opacity="0.85"/>
    </linearGradient>
    <linearGradient id="fadeTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="blurFg" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="blurBg" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
    </filter>
  </defs>`;

const backdrop = (withGrain = true) => `
  <rect width="${W}" height="${H}" fill="${T.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#daylight)"/>
  ${withGrain ? `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.5"/>` : ""}`;

const tierStyle = (tier) =>
  ({
    foundation: [T.tierFoundationBg, T.tierFoundation],
    core: [T.tierCoreBg, T.tierCore],
    optional: [T.tierOptionalBg, T.tierOptional],
  }[tier] ?? null);

/** Карточка-узел: белая матовая, hairline, tier-чип, номерной бейдж. Без текста. */
function card({ x, y, w = 280, h = 168, active = false, tier = "core", r = 16, float = 1, dim = 1, label = true }) {
  const [bg, fg] = tierStyle(tier) ?? ["#fff", T.line];
  const chipW = Math.max(58, w * 0.24);
  const stroke = active ? T.accent : "#e7ecf3";
  const strokeW = active ? 2.2 : 1.5;
  return `
  <g opacity="${dim}" filter="url(#sh)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${T.card}" stroke="${stroke}" stroke-width="${strokeW}"/>
    ${
      label
        ? `<rect x="${x + 20}" y="${y + 20}" width="${chipW}" height="${20}" rx="10" fill="${bg}"/>
           <circle cx="${x + 31}" cy="${y + 30}" r="3" fill="${fg}"/>
           <rect x="${x + 40}" y="${y + 28}" width="${chipW - 26}" height="4.5" rx="2.2" fill="${fg}" opacity="0.55"/>
           <rect x="${x + 20}" y="${y + h * 0.44}" width="${w * 0.62}" height="${Math.max(9, h * 0.075)}" rx="4.5" fill="${T.ink}" opacity="0.72"/>
           <rect x="${x + 20}" y="${y + h * 0.44 + Math.max(16, h * 0.11)}" width="${w * 0.78}" height="${Math.max(6, h * 0.045)}" rx="3" fill="${T.ink}" opacity="0.16"/>
           <rect x="${x + 20}" y="${y + h * 0.44 + Math.max(16, h * 0.11) + Math.max(12, h * 0.08)}" width="${w * 0.52}" height="${Math.max(6, h * 0.045)}" rx="3" fill="${T.ink}" opacity="0.12"/>`
        : ""
    }
    <circle cx="${x + w - 30}" cy="${y + 30}" r="11" fill="#f4f7fb"/>
    <circle cx="${x + w - 30}" cy="${y + 30}" r="3.2" fill="${active ? T.accent : T.muted}" opacity="${active ? 0.9 : 0.35}"/>
  </g>`;
}

/** Связь между узлами: hairline, слегка провисающая. */
function edge(x1, y1, x2, y2, { active = false, bow = 0.12, dash = null } = {}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + Math.abs(x2 - x1) * bow;
  return `<path d="M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" fill="none"
     stroke="${active ? T.accent : "#d3dbe7"}" stroke-width="${active ? 2.4 : 1.6}"
     stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ""} opacity="${active ? 1 : 0.95}"/>`;
}

// --------------------------------------------------------------- logo (mark)
/** Курсор/точка выбора — тонкий индиговый маркер из интерфейса. */
const cursor = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" filter="url(#shN)">
    <circle r="13" fill="${T.accent}" opacity="0.14"/>
    <circle r="6" fill="${T.accent}"/>
    <circle r="2.4" fill="#ffffff"/>
  </g>`;

/** Реальный ассет из public/brand: вкладываем как вложенный <svg>, без перерисовки. */
function inlineBrand(file, { x, y, w, h, viewBox }) {
  const src = readFileSync(join(root, "apps/web/public/brand", file), "utf8");
  const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBox}"
    preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

// ------------------------------------------------------------------- scenarios
const FRAMES = [];

// S01 — один узел на пустой плоскости. Macro, push-in 8%.
FRAMES.push({
  id: "S01",
  code: "Один узел",
  time: "0:00.0–0:03.5",
  shot: "Macro · 100 mm · top-down · push-in 8%",
  title: "У профессии есть структура",
  action: "Камера медленно наезжает на единственную карточку. Вокруг — только точечная бумага.",
  framePrompt:
    "Overhead macro photograph of a single blank white matte card with rounded corners floating 2 mm above paper-white surface with a faint dot grid. Very wide empty negative space. One hairline grey thread stub leaves the right edge of the card and fades out after 90 px. Soft diffused daylight from upper left, soft blue-grey shadow. High-key, calm, quiet.",
  videoPrompt:
    "Static top-down shot. The camera slowly pushes in 8% over 4 seconds with an extremely smooth ease. The card stays perfectly still; only the shadow drifts a few pixels and the paper grain shimmers. No text, no people, no hands, no camera shake, no zoom pulse.",
  svg: () => `
    ${backdrop()}
    ${card({ x: 742, y: 428, w: 400, h: 232, tier: "foundation" })}
    ${edge(1142, 526, 1298, 512, { bow: -0.04, dash: "3 10" })}
    <circle cx="1330" cy="509" r="4" fill="${T.muted}" opacity="0.32"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#daylight)"/>`,
});

// S02 — связи появляются. 4 узла, нить тянется.
FRAMES.push({
  id: "S02",
  code: "Появляются связи",
  time: "0:03.5–0:07.0",
  shot: "Wide-top-down · 50 mm · static · rack to edges",
  title: "Знания. Навыки. Компетенции",
  action: "От активного узла прорастает нить и завязывается на соседнем. Ещё три карточки проявляются из пустоты.",
  framePrompt:
    "Overhead macro photograph of five white rounded cards on paper-white dot-grid surface. A thin indigo filament grows from the center card to the right card and knots at its corner. Other four cards are slightly further and less sharp. Soft daylight, calm composition, generous negative space.",
  videoPrompt:
    "Locked-off top-down shot. A thin indigo thread grows from the right edge of the central card and connects to the card on the right in 1.6 s, easing out. Then three outer cards fade in one by one with a 0.4 s stagger, each landing perfectly still. No text, no people, no camera move, no flicker.",
  svg: () => `
    ${backdrop()}
    ${edge(560, 330, 830, 500, { bow: 0.1, dash: "2 8" })}
    ${edge(1300, 356, 1046, 498, { bow: 0.1, dash: "2 8" })}
    ${edge(600, 760, 820, 646, { bow: -0.08, dash: "2 8" })}
    ${edge(1096, 560, 1290, 560, { active: true, bow: -0.03 })}
    ${card({ x: 420, y: 236, w: 230, h: 140, tier: "optional", dim: 0.92 })}
    ${card({ x: 1240, y: 274, w: 240, h: 140, tier: "core", dim: 0.92 })}
    ${card({ x: 420, y: 690, w: 220, h: 132, tier: "optional", dim: 0.88 })}
    ${card({ x: 800, y: 460, w: 296, h: 172, tier: "foundation", active: true })}
    ${card({ x: 1290, y: 486, w: 250, h: 150, tier: "core" })}
    ${cursor(1290, 560, 0.9)}`,
});

// S03 — карта складывается в три полосы. Crane up.
FRAMES.push({
  id: "S03",
  code: "Карта складывается",
  time: "0:07.0–0:12.0",
  shot: "Wide · 35 mm · crane up + pull-back 12%",
  title: "Увидеть профессию целиком",
  action: "Узлы выстраиваются в три горизонтальные полосы: фундаментальные, основные, дополнительные. Связи прошивают полосы.",
  framePrompt:
    "Overhead photograph of a structured grid of white rounded cards arranged in three horizontal bands on paper-white dot-grid surface, connected by thin grey hairlines. Card sizes and shadow depths are identical across the grid. Airy, ordered, editorial, lots of white space, no text.",
  videoPrompt:
    "Top-down. The camera rises 12% and pulls back slowly while cards gently slide into three aligned horizontal bands with a 0.5 s stagger; hairlines stretch and settle between them. All motion eases out, nothing overshoots. No text, no people, no shake.",
  svg: () => {
    const bands = [
      { y: 168, xs: [300, 610, 920, 1230, 1540], tier: "foundation", h: 132 },
      { y: 470, xs: [220, 500, 780, 1060, 1340, 1620], tier: "core", h: 132 },
      { y: 772, xs: [360, 650, 940, 1230], tier: "optional", h: 132 },
    ];
    const cards = bands
      .map(
        (b) =>
          `<rect x="${b.xs[0] - 40}" y="${b.y - 34}" width="${b.xs.at(-1) - b.xs[0] + 260}" height="4" rx="2" fill="${T.lineSoft}"/>` +
          b.xs.map((x) => card({ x, y: b.y, w: 240, h: b.h, tier: b.tier })).join("")
      )
      .join("");
    return `
    ${backdrop()}
    ${edge(420, 300, 780, 470, { bow: 0.06 })}
    ${edge(900, 300, 1060, 470, { bow: 0.05, active: true })}
    ${edge(1400, 300, 1340, 470, { bow: 0.05 })}
    ${edge(620, 602, 940, 772, { bow: 0.05 })}
    ${edge(1180, 602, 1230, 772, { bow: 0.05 })}
    ${cards}`;
  },
});

// S04 — внутри узла: слои. Eye-level, orbit 15°.
FRAMES.push({
  id: "S04",
  code: "Внутри узла",
  time: "0:12.0–0:16.0",
  shot: "Macro · 85 mm · eye-level · orbit 15° + tilt up",
  title: "Внутри — знания, навыки, материалы",
  action: "Одна карточка приподнимается и расходится на три тонких слоя. Тень углубляется, слои остаются матовыми.",
  framePrompt:
    "Macro photograph of a single white matte card lifted at a low angle, splitting into three thin floating layers like a pop-up book, each layer a clean white plane with a hairline edge. Soft daylight from upper left, deep but blue-grey shadow beneath, paper-white background, shallow depth of field with crisp top layer. No text.",
  videoPrompt:
    "Low-angle macro. The card lifts and separates into three parallel layers over 2.5 s; the camera orbits 15 degrees left and tilts up 5 degrees, keeping the top layer in focus. Shadows deepen softly. Layers settle without bounce. No text, no people, no morphing artifacts, no camera shake.",
  svg: () => `
    ${backdrop()}
    <rect x="0" y="0" width="${W}" height="300" fill="url(#fadeTop)"/>
    <g transform="translate(960 620) rotate(-5) translate(-390 -215)">
      <g filter="url(#sh)"><rect x="10" y="-96" width="780" height="440" rx="24" fill="#ffffff" stroke="#e7ecf3" stroke-width="1.5"/>
        <rect x="40" y="-64" width="120" height="26" rx="13" fill="${T.tierOptionalBg}"/><circle cx="58" cy="-51" r="3.6" fill="${T.tierOptional}"/></g>
      <g filter="url(#sh)"><rect x="0" y="-48" width="780" height="440" rx="24" fill="#ffffff" stroke="#e7ecf3" stroke-width="1.5"/>
        <rect x="40" y="-16" width="120" height="26" rx="13" fill="${T.tierCoreBg}"/><circle cx="58" cy="-3" r="3.6" fill="${T.tierCore}"/>
        <rect x="40" y="52" width="420" height="22" rx="8" fill="${T.ink}" opacity="0.55"/></g>
      <g filter="url(#sh)"><rect x="0" y="0" width="780" height="440" rx="24" fill="#ffffff" stroke="${T.accent}" stroke-width="2.4"/>
        <rect x="40" y="34" width="130" height="28" rx="14" fill="${T.tierFoundationBg}"/><circle cx="59" cy="48" r="4" fill="${T.tierFoundation}"/>
        <rect x="78" y="44" width="74" height="7" rx="3.5" fill="${T.tierFoundation}" opacity="0.55"/>
        <rect x="40" y="108" width="460" height="28" rx="9" fill="${T.ink}" opacity="0.78"/>
        <rect x="40" y="164" width="640" height="12" rx="6" fill="${T.ink}" opacity="0.16"/>
        <rect x="40" y="192" width="540" height="12" rx="6" fill="${T.ink}" opacity="0.12"/>
        <rect x="40" y="220" width="600" height="12" rx="6" fill="${T.ink}" opacity="0.1"/>
        <rect x="40" y="300" width="196" height="42" rx="12" fill="${T.accentSoft}"/>
        <rect x="64" y="317" width="148" height="9" rx="4.5" fill="${T.accent}" opacity="0.5"/>
        <circle cx="716" cy="52" r="15" fill="#f4f7fb"/><circle cx="716" cy="52" r="4" fill="${T.accent}"/></g>
    </g>`,
});

// S05 — связи и фокус. Rack focus + slow slide.
FRAMES.push({
  id: "S05",
  code: "Связи",
  time: "0:16.0–0:20.5",
  shot: "Medium · 50 mm · rack focus · slide 4%",
  title: "Связанное становится видимым",
  action: "Передний план уходит в мягкий расфокус, в фокусе остаётся путь из трёх узлов. Одна ветка подсвечивается индиго.",
  framePrompt:
    "Overhead photograph of a small graph of white rounded cards on paper-white dot-grid surface; foreground cards are softly out of focus, a chain of three cards in the middle plane is crisp, one branch between them highlighted in indigo. Very soft daylight, editorial calm, no text.",
  videoPrompt:
    "Top-down. Rack focus from the blurred foreground cards to the crisp chain of three cards in 1.4 s, then a 4% slide to the right. One indigo branch brightens like ink soaking into paper. No text, no people, no shake, no flicker.",
  svg: () => {
    const dims = [
      [230, 250, 250, 150, "optional"],
      [560, 170, 240, 145, "optional"],
      [1330, 210, 250, 150, "core"],
      [1600, 470, 230, 140, "optional"],
      [250, 720, 240, 145, "optional"],
      [1520, 830, 250, 150, "core"],
    ];
    return `
    ${backdrop()}
    <g filter="url(#blurFg)" opacity="0.75">
      ${edge(430, 350, 640, 800, { bow: 0.2 })}
      ${edge(1440, 700, 1620, 560, { bow: -0.1 })}
      ${dims.slice(0, 2).map(([x, y, w, h, t]) => card({ x, y, w, h, tier: t, dim: 0.85 })).join("")}
      ${card({ x: 560, y: 760, w: 300, h: 170, tier: "core", dim: 0.8 })}
    </g>
    ${edge(640, 560, 900, 560, { active: true, bow: -0.02 })}
    ${edge(1210, 560, 1420, 640, { active: true, bow: 0.06 })}
    ${card({ x: 620, y: 470, w: 300, h: 175, tier: "foundation" })}
    ${card({ x: 940, y: 480, w: 260, h: 160, tier: "core" })}
    ${edge(900, 290, 770, 480, { bow: 0.12, dash: "2 8" })}
    ${edge(1080, 640, 1010, 780, { bow: -0.06, dash: "2 8" })}
    ${dims.slice(2).map(([x, y, w, h, t]) => `<g filter="url(#blurBg)" opacity="0.8">${card({ x, y, w, h, tier: t })}</g>`).join("")}
    <rect x="0" y="620" width="${W}" height="460" fill="url(#fadeBottom)" opacity="0.5"/>`;
  },
});

// S06 — выбор и вход в интерфейс. Match cut.
FRAMES.push({
  id: "S06",
  code: "Выбор",
  time: "0:20.5–0:25.0",
  shot: "Screen / product UI · static + canvas pan",
  title: "Начать можно с любого места",
  action: "Край карточки совпадает с краем панели в интерфейсе. Курсор выбирает компетенцию, канвас подсвечивает связанные узлы.",
  framePrompt:
    "not generated — real product UI capture (Beta 1). Overlay plate for the match cut is generated separately.",
  videoPrompt:
    "Screen recording: the map canvas pans 120 px to the right and one competency card gets a selected state; connected nodes and edges highlight in indigo within 0.6 s. Cursor moves in a straight line, no wobble. No text invented, no zoom pulse.",
  svg: () => `
    ${backdrop()}
    <g filter="url(#sh)">
      <rect x="70" y="96" width="84" height="888" rx="24" fill="#ffffff" stroke="#eef2f7"/>
      <rect x="184" y="96" width="716" height="888" rx="24" fill="${T.bg}" stroke="#eef2f7"/>
      <rect x="930" y="96" width="920" height="888" rx="24" fill="#ffffff" stroke="#eef2f7"/>
    </g>
    ${[190, 280, 370, 460, 550, 790].map((y) => `<rect x="98" y="${y}" width="28" height="10" rx="5" fill="${T.muted}" opacity="0.35"/>`).join("")}
    <rect x="100" y="868" width="26" height="26" rx="8" fill="${T.accentSoft}"/>
    ${inlineBrand("logo-mark.svg", { x: 99, y: 140, w: 28, h: 26, viewBox: "0 0 34 32" })}
    <rect x="216" y="128" width="240" height="44" rx="12" fill="#ffffff" stroke="#eef2f7"/>
    <rect x="232" y="146" width="120" height="8" rx="4" fill="${T.ink}" opacity="0.55"/>
    <rect x="216" y="200" width="660" height="180" rx="16" fill="#ffffff" stroke="#eef2f7"/>
    <rect x="240" y="224" width="86" height="22" rx="11" fill="${T.accentSoft}"/>
    <rect x="254" y="232" width="58" height="6" rx="3" fill="${T.accent}" opacity="0.6"/>
    <rect x="240" y="268" width="300" height="16" rx="6" fill="${T.ink}" opacity="0.72"/>
    <rect x="240" y="300" width="470" height="9" rx="4.5" fill="${T.ink}" opacity="0.15"/>
    <rect x="240" y="322" width="380" height="9" rx="4.5" fill="${T.ink}" opacity="0.12"/>
    <rect x="240" y="336" width="600" height="10" rx="5" fill="${T.lineSoft}"/>
    <rect x="240" y="336" width="420" height="10" rx="5" fill="url(#progress)"/>
    <rect x="960" y="196" width="860" height="60" rx="16" fill="${T.bg}" stroke="#eef2f7"/>
    ${[1090, 1330, 1570].map((x, i) => card({ x, y: 300 + (i % 2) * 40, w: 210, h: 122, tier: ["foundation", "core", "optional"][i] })).join("")}
    ${[1090, 1330].map((x, i) => edge(x + 105, 422 + (i % 2) * 40, x + 345, 300 + 40)).join("")}
    <g filter="url(#sh)"><rect x="960" y="640" width="400" height="320" rx="16" fill="#ffffff" stroke="${T.accent}" stroke-width="2.2"/>
      <rect x="984" y="664" width="96" height="22" rx="11" fill="${T.tierFoundationBg}"/>
      <rect x="998" y="672" width="66" height="6" rx="3" fill="${T.tierFoundation}" opacity="0.55"/>
      <rect x="984" y="704" width="230" height="16" rx="6" fill="${T.ink}" opacity="0.72"/>
      <rect x="984" y="736" width="330" height="9" rx="4.5" fill="${T.ink}" opacity="0.15"/>
      <rect x="984" y="756" width="290" height="9" rx="4.5" fill="${T.ink}" opacity="0.12"/>
      <rect x="984" y="856" width="150" height="34" rx="10" fill="${T.accentSoft}"/></g>
    <rect x="1420" y="940" width="384" height="44" rx="14" fill="#ffffff" stroke="#eef2f7"/>
    ${cursor(1080, 420, 1.1)}`,
});

// S07 — вся карта целиком. Slow pan + pull back.
FRAMES.push({
  id: "S07",
  code: "Целиком",
  time: "0:25.0–0:29.0",
  shot: "Full canvas · product UI · pan + pull-back",
  title: "Картина складывается постепенно",
  action: "Продуктовый канвас отъезжает: видно всю карту профессии, связи читаются, зум-контролы внизу.",
  framePrompt:
    "not generated — real product UI capture at 100% zoom, screen recording.",
  videoPrompt:
    "Screen recording: the canvas zooms out from 100% to fit-all over 2.4 s with a smooth ease-in-out; all nodes and hairlines stay crisp, no motion blur, no text jitter. Final frame holds still for 0.6 s.",
  svg: () => {
    const nodes = [];
    const layout = [
      [230, 190], [470, 190], [710, 190], [950, 190], [1190, 190], [1430, 190],
      [290, 420], [530, 420], [770, 420], [1010, 420], [1250, 420],
      [360, 650], [600, 650], [840, 650], [1080, 650], [1320, 650], [1560, 420],
    ];
    layout.forEach(([x, y], i) => {
      const tier = i % 5 === 0 ? "foundation" : i % 3 === 0 ? "optional" : "core";
      nodes.push(card({ x, y, w: 206, h: 118, tier, r: 14 }));
    });
    return `
    ${backdrop()}
    <rect x="150" y="70" width="1620" height="940" rx="28" fill="${T.bg}" stroke="#eef2f7"/>
    ${edge(433, 249, 520, 420, { bow: 0.06 })}
    ${edge(673, 249, 660, 650, { bow: 0.08, active: true })}
    ${edge(913, 249, 1060, 420, { bow: 0.05 })}
    ${edge(1153, 249, 1319, 420, { bow: 0.05 })}
    ${edge(520, 479, 660, 650, { bow: 0.04 })}
    ${edge(820, 479, 900, 650, { bow: 0.04, active: true })}
    ${edge(1120, 479, 1140, 650, { bow: 0.04 })}
    ${edge(1400, 479, 1420, 650, { bow: 0.04 })}
    ${nodes.join("")}
    <g filter="url(#sh)"><rect x="820" y="880" width="330" height="76" rx="24" fill="#ffffff" stroke="#eef2f7"/>
      <rect x="852" y="906" width="24" height="24" rx="8" fill="${T.bg}"/>
      <rect x="902" y="910" width="70" height="16" rx="8" fill="${T.accent}" opacity="0.75"/>
      <rect x="992" y="906" width="24" height="24" rx="8" fill="${T.bg}"/>
      <rect x="1042" y="908" width="24" height="20" rx="6" fill="${T.accentSoft}"/>
      <rect x="1086" y="908" width="24" height="20" rx="6" fill="#ffffff" stroke="#eef2f7"/></g>`;
  },
});

// S08 — эндкард: знак + вордмарк.
FRAMES.push({
  id: "S08",
  code: "Эндкард",
  time: "0:29.0–0:33.0",
  shot: "Motion design endcard · static · 4 s",
  title: "AXIONA",
  action: "Три узла сходятся в знак, в центре загорается индиговое ядро, проявляется вордмарк и строка-подпись.",
  framePrompt:
    "Clean endcard on paper-white surface with faint dot grid: the AXIONA mark — three black circular nodes joined by thin arcs, an indigo dot at the centre — with generous empty space around it. Flat, no shadow, exact, print-like.",
  videoPrompt:
    "Motion design, not AI video: three nodes slide in from 40 px offsets and dock into the mark in 0.9 s; arc lines draw between them; the indigo nucleus fades up; wordmark rises 12 px with opacity. No camera move, no particles, no shine sweep.",
  svg: () => `
    ${backdrop()}
    ${inlineBrand("logo-mark.svg", { x: 596, y: 296, w: 196, h: 184, viewBox: "0 0 34 32" })}
    ${inlineBrand("logo-wordmark.svg", { x: 834, y: 352, w: 552, h: 93, viewBox: "0 0 107 18" })}
    <text x="836" y="492" font-family="${FONT}" font-size="29" font-weight="400" fill="${T.muted}">Карта компетенций, которая объясняет профессию</text>
    <rect x="836" y="530" width="436" height="3" rx="1.5" fill="${T.line}"/>`,
});

// -------------------------------------------------------------------- assemble
const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs()}${body}</svg>`;

const page = (svg, extraCss = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:${T.bg};}
    svg{display:block}${extraCss}
  </style></head><body>${svg}</body></html>`;

// Chrome: без пользовательского профиля headless падает на macOS.
const CHROME =
  process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function shot(htmlPath, pngPath, w, h) {
  const profile = join(tmpdir(), `axiona-av-chrome-${process.pid}`);
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--user-data-dir=${profile}`,
      `--window-size=${w},${h}`,
      `--virtual-time-budget=1200`,
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: "ignore" }
  );
  rmSync(profile, { recursive: true, force: true });
}

const contactSheet = (frames) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}
  body{margin:0;background:#ffffff;font-family:${FONT};color:${T.ink};padding:56px 64px}
  h1{margin:0;font-size:34px;font-weight:700;letter-spacing:-0.01em}
  .sub{margin-top:8px;color:${T.muted};font-size:16px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:28px;margin-top:36px}
  .tile{background:${T.bg};border:1px solid ${T.lineSoft};border-radius:${18}px;overflow:hidden}
  .tile img{width:100%;display:block;border-bottom:1px solid ${T.lineSoft}}
  .cap{padding:14px 16px 16px}
  .row{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
  .id{font-size:13px;font-weight:700;letter-spacing:.08em;color:${T.accentDark};text-transform:uppercase}
  .time{font-size:12px;color:${T.muted};font-variant-numeric:tabular-nums}
  .name{margin-top:6px;font-size:16px;font-weight:700}
  .shot{margin-top:4px;font-size:12px;color:${T.muted};line-height:1.45}
  .pal{margin-top:40px;display:flex;gap:14px;align-items:center;font-size:12px;color:${T.muted};flex-wrap:wrap}
  .sw{width:26px;height:26px;border-radius:8px;border:1px solid ${T.lineSoft}}
  .note{margin-top:18px;font-size:13px;color:${T.muted};max-width:1400px;line-height:1.6}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:${T.bg};
       border:1px solid ${T.lineSoft};border-radius:6px;padding:2px 6px}
</style></head><body>
  <h1>AXIONA · AV storyboard v1 — «Светлая структура»</h1>
  <div class="sub">8 ключевых кадров · 33 s · 16:9 · собрано из токенов <code>globals.css</code> · не AI-рендер, проверка композиции и ритма</div>
  <div class="grid">
    ${frames
      .map(
        (f) => `<div class="tile">
      <img src="./frames/${f.id.toLowerCase()}.png" alt="${f.id}">
      <div class="cap">
        <div class="row"><span class="id">${f.id}</span><span class="time">${f.time}</span></div>
        <div class="name">${f.code}</div>
        <div class="shot">${f.shot}</div>
      </div>
    </div>`
      )
      .join("")}
  </div>
  <div class="pal">
    <b style="color:${T.ink}">Токены:</b>
    <span class="sw" style="background:${T.bg}"></span>#F8FAFC bg
    <span class="sw" style="background:${T.card}"></span>#FFFFFF card
    <span class="sw" style="background:${T.ink}"></span>#132238 ink
    <span class="sw" style="background:${T.line}"></span>#E2E8F0 line
    <span class="sw" style="background:${T.accent}"></span>#4F46E5 accent
    <span class="sw" style="background:${T.accentSky}"></span>#0EA5E9 accent-sky
    <span class="sw" style="background:${T.tierFoundation}"></span>#B45309 foundation
    <span class="sw" style="background:${T.tierCore}"></span>#1D4ED8 core
    <span class="sw" style="background:${T.tierOptional}"></span>#64748B optional
  </div>
  <div class="note">Кадры проверяют только композицию, масштаб, количество объектов и цветовые пропорции.
  Серые полосы внутри карточек — плейсхолдеры текста: в AI-кадре их нет, текст накладывается в пост-слое.
  Текст, логотип и интерфейс в финале — детерминированный слой (Geist + <code>logo-mark.svg</code>), а не генерация.
  Источник: <code>docs/06-communication/COS-COM-011-Audiovisual-Prompt-Kit.md</code>.</div>
</body></html>`;

// ------------------------------------------------------------------------ main
const outArg = process.argv.indexOf("--out");
const outDir = outArg > -1 ? resolve(process.argv[outArg + 1]) : join(root, "docs/design/av");
const noPng = process.argv.includes("--no-png");

const framesDir = join(outDir, "frames");
mkdirSync(framesDir, { recursive: true });

const htmlDir = join(tmpdir(), `axiona-av-${process.pid}`);
mkdirSync(htmlDir, { recursive: true });

for (const f of FRAMES) {
  const svg = wrap(f.svg());
  writeFileSync(join(outDir, `${f.id.toLowerCase()}.svg`), svg);
  if (!noPng) {
    const htmlPath = join(htmlDir, `${f.id}.html`);
    writeFileSync(htmlPath, page(svg));
    shot(htmlPath, join(framesDir, `${f.id.toLowerCase()}.png`), W, H);
  }
}

if (!noPng) {
  // HTML кладём рядом с кадрами: относительные пути ./frames/*.png должны резолвиться.
  const sheetPath = join(outDir, "storyboard.html");
  writeFileSync(sheetPath, contactSheet(FRAMES));
  shot(sheetPath, join(outDir, "storyboard-contact-sheet.png"), 2600, 1420);
}
rmSync(htmlDir, { recursive: true, force: true });

// frames.json — машинная связка кадр → спека. Тексты промптов живут только в
// COS-COM-011 §4, чтобы не расходиться с документом; здесь — ссылка на раздел.
writeFileSync(
  join(outDir, "frames.json"),
  JSON.stringify(
    {
      spec: "COS-COM-011 Audiovisual Prompt Kit",
      doc: "docs/06-communication/COS-COM-011-Audiovisual-Prompt-Kit.md",
      generator: "scripts/av/storyboard.mjs",
      aspect: "16:9",
      size: [W, H],
      totalSeconds: 33,
      frames: FRAMES.map((f) => ({
        id: f.id,
        name: f.code,
        time: f.time,
        shot: f.shot,
        title: f.title,
        action: f.action,
        docRef: `COS-COM-011 §4 ${f.id}`,
        files: { svg: `${f.id.toLowerCase()}.svg`, png: `frames/${f.id.toLowerCase()}.png` },
      })),
    },
    null,
    2
  ) + "\n"
);

console.log(
  `storyboard: ${FRAMES.length} frames → ${outDir}${noPng ? " (svg only)" : " (+ png)"}`
);
