#!/usr/bin/env node
/**
 * Figma parity — шаг 2: собрать из сцен один файл плагина.
 *
 * Читает scenes/*.json, прогоняет через shell.mjs (точечный канвас + nav-rail +
 * workspace-подложка), генерирует точечный PNG-тайл и пишет
 * plugin/code.js (сцены + рендерер одним файлом) и plugin/manifest.json.
 *
 * Usage: node scripts/web/figma-parity/build.mjs
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, deflateSync } from 'node:zlib';
import { buildShellScene, TOKENS } from './shell.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const scenesDir = join(here, 'scenes');
const pluginDir = join(here, 'plugin');
const routes = JSON.parse(readFileSync(join(here, 'routes.json'), 'utf8'));

function cliArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

// Figma запоминает путь к манифесту при добавлении плагина. По консоли он
// оказался .../scripts/web/figma-parity/AXIONA _ Web parity builder/manifest.json,
// а проект «New plugin…» создался на уровень выше. Держим оба места в синке.
const FIGMA_PLUGIN_ID = '1697629855476405298';
const CANONICAL_DIR = join(here, 'AXIONA _ Web parity builder');
const LEGACY_DIR = join(here, '../AXIONA _ Web parity builder');

function figmaPluginDirs() {
  const explicit = cliArg('figma-dir', process.env.FIGMA_PLUGIN_DIR ?? '');
  if (explicit) return [{ dir: explicit, create: false }];
  return [
    { dir: CANONICAL_DIR, create: true },
    { dir: LEGACY_DIR, create: false },
  ];
}

// ---------------------------------------------------- PNG-тайл точечного фона
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/** Рисует тайл с точкой в центре: supersampling ×4 для сглаженного края. */
function dotTilePng({ tileSize = 24, diameter = 1.5, color, background, scale = 4 }) {
  const size = tileSize * scale;
  const [br, bg, bb] = hexToRgb(background);
  const [dr, dg, db] = hexToRgb(color);
  const center = size / 2;
  const radius = (diameter * scale) / 2;
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter type: none
    for (let x = 0; x < size; x += 1) {
      let inside = 0;
      const samples = 4;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          const dx = px - center;
          const dy = py - center;
          if (dx * dx + dy * dy <= radius * radius) inside += 1;
        }
      }
      const alpha = inside / (samples * samples);
      const offset = 1 + x * 4;
      row[offset] = Math.round(dr * alpha + br * (1 - alpha));
      row[offset + 1] = Math.round(dg * alpha + bg * (1 - alpha));
      row[offset + 2] = Math.round(db * alpha + bb * (1 - alpha));
      row[offset + 3] = 255;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const tileScale = 4;
const tilePng = dotTilePng({
  tileSize: TOKENS.dot.tile,
  diameter: TOKENS.dot.diameter,
  color: TOKENS.dot.color,
  background: TOKENS.dot.background,
  scale: tileScale,
});

// ------------------------------------------------------------------- сцены
const problems = [];
const rawScenes = [];

const viewports = routes.viewports ?? [{ id: 'desktop' }];
for (const viewport of viewports) {
  for (const screen of routes.screens) {
    const allowed = screen.viewports ?? routes.defaultViewports ?? viewports.map((item) => item.id);
    if (!allowed.includes(viewport.id)) continue;
    const suffix = viewport.id === 'desktop' ? '' : `--${viewport.id}`;
    const fileBase = `${screen.slug}${suffix}`;
    const file = join(scenesDir, `${fileBase}.json`);
    let raw;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      problems.push(`нет сцены ${fileBase}: ${error.message}`);
      continue;
    }
    // Растровые экраны (канвас с панорамой) приходят картинкой, без узлов.
    if (!raw.raster && (!Array.isArray(raw.nodes) || !raw.nodes.length)) {
      problems.push(`${fileBase}: пустой список узлов`);
      continue;
    }
    raw.viewportId = viewport.id;
    raw.slug = fileBase;
    rawScenes.push(raw);
  }
}

if (problems.length) {
  console.error('Проблемы в сценах:');
  for (const problem of problems.slice(0, 20)) console.error('  - ' + problem);
  process.exit(1);
}

/** Убирает из бандла избыточное: построчные боксы, пустые pad/bw и копии SVG. */
function compactScenes(list) {
  const svgByContent = new Map();
  const assets = {};
  let counter = 0;
  for (const scene of list) {
    scene.nodes = scene.nodes.map((node) => {
      const out = { ...node };
      delete out.lines;
      if (Array.isArray(out.pad) && out.pad.every((value) => !value)) delete out.pad;
      if (Array.isArray(out.bw) && out.bw.every((value) => !value)) delete out.bw;
      if (out.svg) {
        let key = svgByContent.get(out.svg);
        if (!key) {
          key = `s${counter}`;
          counter += 1;
          svgByContent.set(out.svg, key);
          assets[key] = out.svg;
        }
        out.svgKey = key;
        delete out.svg;
      }
      return out;
    });
  }
  return assets;
}

const scenes = rawScenes.map((raw) => {
  const scene = buildShellScene(raw);
  // инварианты для рендерера: index === i, родитель раньше ребёнка
  scene.nodes.forEach((node, index) => {
    if (node.i !== index) problems.push(`${scene.slug}: сбит индекс узла ${index}`);
    if (node.p >= index) problems.push(`${scene.slug}: родитель позже ребёнка (${index})`);
    if (node.ck && !node.sig) problems.push(`${scene.slug}: компонент без sig`);
  });
  return scene;
});

if (problems.length) {
  console.error('Проблемы после оболочки:');
  for (const problem of problems.slice(0, 20)) console.error('  - ' + problem);
  process.exit(1);
}

const SVG_ASSETS = compactScenes(scenes);

const CONFIG = {
  pages: {
    parity: 'Beta-1 · Web parity',
    mobile: 'Beta-1 · Mobile parity',
    components: 'Beta-1 · Components',
  },
  components: routes.components ?? {},
  fontFamily: 'Geist',
  fontFallback: 'Inter',
  dotTile: { scale: tileScale, size: TOKENS.dot.tile * tileScale },
};

const renderer = readFileSync(join(here, 'renderer.js'), 'utf8');
const banner = `// СГЕНЕРИРОВАНО scripts/web/figma-parity/build.mjs — не редактировать руками.\n// ${scenes.length} экранов, ${new Date().toISOString()}\n`;

// Данные сцен сжимаем raw DEFLATE: JSON на сотни килобайт раздувает code.js, а
// Figma не даёт DecompressionStream — поэтому в бандле лежит свой inflate
// (inflate.js). Payload держим ASCII: не-ASCII символы экранируем в \uXXXX,
// чтобы декодировать байты без TextDecoder.
const payloadJson = JSON.stringify({ scenes, config: CONFIG, svg: SVG_ASSETS }).replace(
  /[\u007f-\uffff]/g,
  (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
);
const packed = deflateRawSync(Buffer.from(payloadJson, 'ascii'), { level: 9 }).toString('base64');
const inflateSource = readFileSync(join(here, 'inflate.js'), 'utf8');

const code = [
  banner,
  `const PACKED_BASE64 = ${JSON.stringify(packed)};`,
  `const DOT_TILE_BASE64 = ${JSON.stringify(tilePng.toString('base64'))};`,
  '',
  inflateSource,
  renderer,
].join('\n');

mkdirSync(pluginDir, { recursive: true });
writeFileSync(join(pluginDir, 'code.js'), code);

const manifest = {
  name: 'AXIONA — Web parity builder',
  id: 'axiona-web-parity-builder',
  api: '1.0.0',
  main: 'code.js',
  editorType: ['figma'],
  documentAccess: 'dynamic-page',
};
writeFileSync(join(pluginDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

/**
 * Синхронизирует бандл с проектом плагина Figma: code.js запускается напрямую,
 * code.ts держим с @ts-nocheck, чтобы `npm run build` не затёр сборку шаблоном.
 * Манифесту оставляем figma-id, остальное приводим к тому, что нужно сборщику.
 */
function syncToFigmaProject(bundle) {
  const synced = [];
  for (const { dir, create } of figmaPluginDirs()) {
    const manifestPath = join(dir, 'manifest.json');
    const hasManifest = existsSync(manifestPath);
    if (!hasManifest && !create) continue;
    mkdirSync(dir, { recursive: true });

    if (!hasManifest) {
      // Манифест по каноническому пути: тот же figma-id, что у зарегистрированного
      // плагина, иначе Figma не свяжет папку с плагином в меню Development.
      writeFileSync(
        manifestPath,
        `${JSON.stringify(
          {
            name: 'AXIONA — Web parity builder',
            id: FIGMA_PLUGIN_ID,
            api: '1.0.0',
            main: 'code.js',
            capabilities: [],
            enableProposedApi: false,
            documentAccess: 'dynamic-page',
            editorType: ['figma', 'figjam', 'slides', 'buzz'],
            networkAccess: { allowedDomains: ['none'] },
          },
          null,
          2,
        )}\n`,
      );
    } else {
      // Существующий манифест Figma не переписываем: сверяем только минимум.
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        let changed = false;
        if (manifest.main !== 'code.js') {
          manifest.main = 'code.js';
          changed = true;
        }
        if (manifest.documentAccess !== 'dynamic-page') {
          manifest.documentAccess = 'dynamic-page';
          changed = true;
        }
        if (changed) writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      } catch (error) {
        synced.push(`${dir} (манифест не обновлён: ${error.message})`);
        continue;
      }
    }

    writeFileSync(join(dir, 'code.js'), bundle);
    writeFileSync(
      join(dir, 'code.ts'),
      `// @ts-nocheck\n// СГЕНЕРИРОВАНО scripts/web/figma-parity/build.mjs — не редактировать руками.\n${bundle}`,
    );
    synced.push(dir);
  }
  return synced;
}

// ------------------------------------------------------------------- отчёт
console.log('Экраны:');
for (const scene of scenes) {
  const text = scene.nodes.filter((node) => node.tx).length;
  const components = scene.nodes.filter((node) => node.ck).length;
  console.log(
    `  ${scene.slug.padEnd(24)} ${String(scene.nodes.length).padStart(4)} узлов, ${String(text).padStart(4)} текстовых, ${String(components).padStart(2)} компонент  ${scene.doc.w}×${Math.round(scene.doc.h)}`,
  );
}

const componentKeys = new Map();
for (const scene of scenes) {
  for (const node of scene.nodes) {
    if (!node.ck) continue;
    if (!componentKeys.has(node.ck)) componentKeys.set(node.ck, new Set());
    componentKeys.get(node.ck).add(node.sig);
  }
}
console.log('\nКомпоненты (ключ → вариантов структуры):');
for (const [key, signatures] of componentKeys) console.log(`  ${key.padEnd(18)} ${signatures.size}`);

const totalNodes = scenes.reduce((sum, scene) => sum + scene.nodes.length, 0);
const sizeKb = (statSync(join(pluginDir, 'code.js')).size / 1024).toFixed(0);
const synced = syncToFigmaProject(code);
const rawJsonKb = (Buffer.byteLength(payloadJson) / 1024).toFixed(0);
const packedKb = (packed.length / 1024).toFixed(0);
const svgCount = Object.keys(SVG_ASSETS).length;
console.log(`Данные сцен: ${rawJsonKb} KB JSON → ${packedKb} KB deflate+base64`);
console.log(`\nВсего узлов: ${totalNodes}; уникальных SVG: ${svgCount}`);
console.log(`plugin/code.js — ${sizeKb} KB`);
if (synced.length) {
  console.log('\nПроект плагина Figma обновлён:');
  for (const dir of synced) console.log(`  - ${dir}`);
  console.log('Дальше: Figma → Plugins → Development → AXIONA — Web parity builder (переимпорт не нужен)');
} else {
  console.log(
    `\nДальше: Figma → Plugins → Development → Import plugin from manifest… → ${resolve(join(pluginDir, 'manifest.json'))}`,
  );
}
