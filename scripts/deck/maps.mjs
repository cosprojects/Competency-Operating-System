#!/usr/bin/env node
/**
 * AXIONA deck — абстрактные карты «Европа + СНГ» и «Казахстан» для слайдов.
 *
 * Карты собраны как точечная матрица (dot-matrix) из Natural Earth 110m
 * (`scripts/deck/data/ne-110m-trim.geojson`, страны обрезаны и округлены).
 * Никаких политических границ, флагов и заливок: только точки земли,
 * четыре узла (Минск · запуск, Алматы · первый рынок, Европа · English,
 * Москва · тест) и маршрут между ними. Это визуальный язык COS-COM-006:
 * структура важнее объекта, карта — не территория, а связи.
 *
 * Использование:
 *   node scripts/deck/maps.mjs [--out docs/08-business-plan/investor/deck-v2/assets]
 *
 * Генерирует:
 *   map-europe-cis.svg        — светлая версия, 1000×400
 *   map-europe-cis-dark.svg   — тёмная версия для титула/финала
 *   map-kazakhstan.svg        — крупный Казахстан, 860×520
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const outDir = resolve(root, arg("--out", "docs/08-business-plan/investor/deck-v2/assets"));

const T = {
  light: {
    bg: "#f8fafc",
    dot: "#c9d3e3",
    dotSoft: "#dde4ee",
    dotCis: "#b3c0d4",
    dotKz: "#a2afc3",
    ink: "#132238",
    muted: "#5f6f85",
    accent: "#4f46e5",
    accentDark: "#3730a3",
    accentSky: "#0ea5e9",
    halo: "#eef2ff",
    labelBg: "#ffffff",
  },
  dark: {
    bg: "#0f1724",
    dot: "#26334a",
    dotSoft: "#1d2839",
    dotCis: "#33425d",
    dotKz: "#405473",
    ink: "#f8fafc",
    muted: "#94a3b8",
    accent: "#8fb4ff",
    accentDark: "#c7d8ff",
    accentSky: "#7dd3fc",
    halo: "#1e2b44",
    labelBg: "#0f1724",
  },
};

const geo = JSON.parse(readFileSync(join(here, "data/ne-110m-trim.geojson"), "utf8"));

// Группы стран: подписи нужны только для контекста, не для политики.
const EUROPE = new Set([
  "Albania", "Andorra", "Austria", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia",
  "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
  "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg",
  "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland",
  "Portugal", "Romania", "San Marino", "Republic of Serbia", "Slovakia", "Slovenia", "Spain",
  "Sweden", "Switzerland", "Ukraine", "United Kingdom", "Vatican",
]);
const CIS = new Set([
  "Belarus", "Kazakhstan", "Uzbekistan", "Kyrgyzstan", "Tajikistan", "Turkmenistan",
  "Azerbaijan", "Armenia", "Georgia",
]);
const CONTEXT = new Set([
  "Russia", "Turkey", "Iran", "Iraq", "Syria", "Afghanistan", "China", "Mongolia", "Pakistan",
  "India", "Saudi Arabia", "Egypt", "Libya", "Algeria", "Morocco", "Tunisia",
]);

const RAD = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));

/** Меркатор + вписывание bbox в кадр. */
function makeProjection(bbox, w, h, pad) {
  const [lon0, lat0, lon1, lat1] = bbox;
  const x0 = lon0 * RAD, x1 = lon1 * RAD;
  const y0 = mercY(lat0), y1 = mercY(lat1);
  const s = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0));
  const ox = (w - (x1 - x0) * s) / 2 - x0 * s;
  const oy = (h - (y1 - y0) * s) / 2 + y1 * s; // y вниз
  return {
    project: (lon, lat) => [lon * RAD * s + ox, oy - mercY(lat) * s],
    unproject: (px, py) => {
      const lon = ((px - ox) / s) / RAD;
      const my = (oy - py) / s;
      const lat = (2 * Math.atan(Math.exp(my)) - Math.PI / 2) / RAD;
      return [lon, lat];
    },
  };
}

function onRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function onPolygon(pt, rings) {
  if (!onRing(pt, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (onRing(pt, rings[i])) return false;
  return true;
}

/** Возвращает функцию landKind(lon,lat) -> "europe"|"cis"|"kz"|"context"|null. */
function makeLand() {
  const polys = [];
  for (const f of geo.features) {
    const name = f.properties.name;
    const groups = [];
    if (EUROPE.has(name)) groups.push("europe");
    if (name === "Kazakhstan") groups.push("kz");
    if (CIS.has(name)) groups.push("cis");
    if (CONTEXT.has(name)) groups.push("context");
    if (!groups.length) continue;
    const g = f.geometry;
    const list = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const rings of list) {
      polys.push({ rings, groups, bbox: ringBbox(rings[0]) });
    }
  }
  return (lon, lat) => {
    const pt = [lon, lat];
    for (const p of polys) {
      if (lon < p.bbox[0] || lon > p.bbox[2] || lat < p.bbox[1] || lat > p.bbox[3]) continue;
      if (onPolygon(pt, p.rings)) {
        if (p.groups.includes("kz")) return "kz";
        if (p.groups.includes("europe")) return "europe";
        if (p.groups.includes("cis")) return "cis";
        if (p.groups.includes("context")) return "context";
      }
    }
    return null;
  };
}
function ringBbox(ring) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ring) {
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  return [a, b, c, d];
}

/** Точки земли: равномерная сетка в экранных координатах. */
function landDots(proj, w, h, bbox, step, land) {
  const dots = { europe: [], cis: [], kz: [], context: [] };
  for (let py = 0; py <= h; py += step) {
    for (let px = 0; px <= w; px += step) {
      const [lon, lat] = proj.unproject(px, py);
      if (lon < bbox[0] - 2 || lon > bbox[2] + 2 || lat < bbox[1] - 2 || lat > bbox[3] + 2) continue;
      const kind = land(lon, lat);
      if (kind) dots[kind].push([Math.round(px * 10) / 10, Math.round(py * 10) / 10]);
    }
  }
  return dots;
}

// Chrome не рисует subpath из одного moveto даже с round cap — даём ей нулевой отрезок.
const dotPath = (arr) => arr.map(([x, y]) => `M${x} ${y}h.01`).join("");
const label = (x, y, text, { size = 13, color, weight = 600, anchor = "start", dy = 0, bg } = {}) => {
  // Подпись кладём на «бумажную» плашку в цвет фона: точки карты не мешают читать.
  const w = text.length * size * 0.57 + 12;
  const h = size + 9;
  const tx = x;
  const ty = y + dy;
  const bx = anchor === "end" ? tx - w + 4 : anchor === "middle" ? tx - w / 2 : tx - 5;
  const by = ty - size * 0.86 - 3;
  return `<g>
    <rect x="${bx}" y="${by}" width="${w}" height="${h}" rx="5" fill="${bg ?? "#f8fafc"}" opacity="0.94"/>
    <text x="${tx}" y="${ty}" font-family="Geist, Inter, system-ui, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" ${anchor !== "start" ? `text-anchor="${anchor}"` : ""}>${text}</text>
  </g>`;
};

function node(x, y, { r = 5, color, halo, hollow = false }) {
  return `<g>
    <circle cx="${x}" cy="${y}" r="${r + 7}" fill="${halo}" opacity="0.9"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${hollow ? "none" : color}" stroke="${color}" stroke-width="${hollow ? 2 : 0}"/>
    <circle cx="${x}" cy="${y}" r="${Math.max(1.6, r * 0.32)}" fill="${hollow ? color : "#ffffff"}"/>
  </g>`;
}

const arc = (a, b, lift, color, { dash = "", width = 2 } = {}) => {
  const [x1, y1] = a, [x2, y2] = b;
  const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - lift;
  return `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
};

function buildMap({ theme, bbox, w, h, pad, step, dotsR, labels = [], routes = [], nodes = [], kzFocus = false }) {
  const c = T[theme];
  const proj = makeProjection(bbox, w, h, pad);
  const land = makeLand();
  const dots = landDots(proj, w, h, bbox, step, land);
  const P = (lon, lat) => proj.project(lon, lat);

  const dotLayers = [
    ["context", c.dotSoft, dotsR * 0.8],
    ["europe", c.dot, dotsR],
    ["cis", c.dotCis, dotsR],
    ["kz", c.dotKz, dotsR * 1.15],
  ].map(([kind, color, r]) =>
    dots[kind].length
      ? `<path d="${dotPath(dots[kind])}" fill="none" stroke="${color}" stroke-width="${r * 2}" stroke-linecap="round"/>`
      : ""
  ).join("");

  const routeSvg = routes.map((r) => {
    const a = P(...r.from), b = P(...r.to);
    return arc(a, b, r.lift ?? 60, r.color ?? c.accent, { dash: r.dash ?? "", width: r.width ?? 2 });
  }).join("");

  const nodeSvg = nodes.map((n) => {
    const [x, y] = P(n.lon, n.lat);
    return node(x, y, { r: n.r ?? 5, color: n.color ?? c.accent, halo: n.halo ?? c.halo, hollow: n.hollow });
  }).join("");

  const labelSvg = labels.map((l) => {
    const [x, y] = P(l.lon, l.lat);
    return label(x + (l.dx ?? 0), y + (l.dy ?? 0), l.text, {
      size: l.size ?? 13,
      color: l.color ?? c.muted,
      weight: l.weight ?? 600,
      anchor: l.anchor,
      bg: c.bg,
    });
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Абстрактная карта: Европа, СНГ и Казахстан">
  <rect width="${w}" height="${h}" fill="none"/>
  ${dotLayers}
  ${routeSvg}
  ${nodeSvg}
  ${labelSvg}
</svg>`;
}

// Точки маршрута. Координаты настоящие, границы — нет: это карта-схема.
const MINSK = [27.56, 53.9];
const ALMATY = [76.9, 43.24];
const BERLIN = [13.4, 52.52];
const MOSCOW = [37.62, 55.75];

const europeCis = (theme, { withLabels = true } = {}) => {
  const c = T[theme];
  return buildMap({
    theme,
    bbox: [-12, 33, 92, 62],
    w: 1000, h: 400, pad: 10, step: 5.2, dotsR: 1.55,
    routes: [
      { from: MINSK, to: ALMATY, lift: 78, color: c.accent, dash: "1 9", width: 2.4 },
      { from: ALMATY, to: BERLIN, lift: 158, color: c.accent, dash: "1 12", width: 1.8 },
    ],
    nodes: [
      { lon: MOSCOW[0], lat: MOSCOW[1], r: 4, color: c.muted, halo: c.bg, hollow: true },
      { lon: BERLIN[0], lat: BERLIN[1], r: 4, color: c.accent, halo: c.halo, hollow: true },
      { lon: ALMATY[0], lat: ALMATY[1], r: 5.5, color: c.accent },
      { lon: MINSK[0], lat: MINSK[1], r: 5.5, color: c.accent },
    ],
    labels: withLabels
      ? [
          { lon: MINSK[0] - 1.2, lat: MINSK[1] + 1.3, text: "Минск · запуск", color: c.ink, size: 13, dx: -9, dy: -8, anchor: "end" },
          { lon: ALMATY[0] + 1.4, lat: ALMATY[1] - 1.6, text: "Алматы · первый рынок", color: c.ink, size: 13, dx: 8, dy: 14 },
          { lon: BERLIN[0] - 1.4, lat: BERLIN[1] + 1.1, text: "Европа · English", color: c.ink, size: 13, dx: -14, dy: -8, anchor: "end" },
          { lon: MOSCOW[0] + 1.3, lat: MOSCOW[1] + 0.4, text: "РФ · тест", color: c.muted, size: 12, dx: 8, dy: 4 },
        ]
      : [],
  });
};

const kazakhstan = () => {
  const c = T.light;
  const ASTANA = [71.43, 51.13];
  return buildMap({
    theme: "light",
    bbox: [44, 39, 90, 57],
    w: 860, h: 520, pad: 26, step: 4.4, dotsR: 1.8,
    // Локальный маршрут: Алматы — Астана. Не границы, а присутствие.
    routes: [{ from: ALMATY, to: ASTANA, lift: 46, color: c.accent, dash: "1 9", width: 2 }],
    nodes: [
      { lon: ALMATY[0], lat: ALMATY[1], r: 5.4, color: c.accent },
      { lon: ASTANA[0], lat: ASTANA[1], r: 4, color: c.accent, halo: c.halo, hollow: true },
    ],
    labels: [
      { lon: ALMATY[0] + 1.2, lat: ALMATY[1] - 1.1, text: "Алматы", color: c.ink, size: 15, weight: 700, dx: 9, dy: 14 },
      { lon: ASTANA[0] + 1.2, lat: ASTANA[1] + 0.6, text: "Astana Hub", color: c.muted, size: 13, dx: 8, dy: -6 },
    ],
  });
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "map-europe-cis.svg"), europeCis("light"));
writeFileSync(join(outDir, "map-europe-cis-dark.svg"), europeCis("dark"));
writeFileSync(join(outDir, "map-europe-cis-dark-plain.svg"), europeCis("dark", { withLabels: false }));
writeFileSync(join(outDir, "map-kazakhstan.svg"), kazakhstan());
console.log("maps →", outDir);
console.log("map-europe-cis.svg", readFileSync(join(outDir, "map-europe-cis.svg"), "utf8").length, "bytes");
