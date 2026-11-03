#!/usr/bin/env node
/**
 * Figma compare — визуальное сравнение вёрстки с макетом Figma.
 *
 * Снимает элемент страницы через Chrome DevTools Protocol (без npm-зависимостей:
 * global fetch + global WebSocket в Node >= 22), приводит макет к размеру снимка,
 * считает попиксельный diff и складывает артефакты в --out.
 *
 * Usage:
 *   node scripts/web/figma-compare.mjs \
 *     --url http://127.0.0.1:3101/professions/uxui \
 *     --selector ".profession-summary" \
 *     --design /tmp/design-sidebar.png \
 *     --out /tmp/compare-out \
 *     --cdp 9223 --width 1440 --height 1000 --scale 2 --threshold 24
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------- arguments
class ArgError extends Error {}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = process.argv[i + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new ArgError(`--${name}: пропущено значение`);
  }
  return value;
}

function intArg(name, fallback, { min = -Infinity, max = Infinity } = {}) {
  const raw = arg(name, String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ArgError(`--${name}: ожидается целое ${min}..${max}, получено «${raw}»`);
  }
  return value;
}

function numArg(name, fallback, { min = -Infinity, max = Infinity } = {}) {
  const raw = arg(name, String(fallback));
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ArgError(`--${name}: ожидается число ${min}..${max}, получено «${raw}»`);
  }
  return value;
}

const USAGE = `Figma-сравнение вёрстки: снимок элемента через CDP + diff с PNG макета.

Usage:
  node scripts/web/figma-compare.mjs --url <url> --selector <css> --design <png|webp> [options]

Обязательные:
  --url <url>            адрес страницы, например http://127.0.0.1:3101/professions/uxui
  --selector <css>       CSS-селектор элемента, например ".profession-summary"
  --design <path>        макет: PNG или webp (webp конвертируется через sips)

Опции:
  --out <dir>            каталог артефактов (по умолчанию scripts/web/figma-parity/compare/latest)
  --cdp <port>           порт Chrome с --remote-debugging-port (по умолчанию 9222)
  --width <px>           ширина вьюпорта (по умолчанию 1440)
  --height <px>          высота вьюпорта (по умолчанию 1000)
  --scale <n>            deviceScaleFactor (по умолчанию 2)
  --threshold <0..255>   порог различия по каналу (по умолчанию 24)
  --help                 показать эту справку и выйти

Артефакты: web.png, design.png, diff.png, side-by-side.png, report.json.
Коды выхода: 0 — успех, 1 — ошибка запуска/съёмки/декодирования, 2 — неверные аргументы.
`;

function printHelp() {
  // Справка печатается без лишнего шума и завершает работу успешно.
  process.stdout.write(USAGE);
  process.exit(0);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) printHelp();

// Неизвестные флаги — почти всегда опечатка, лучше упасть сразу.
const KNOWN = new Set(['url', 'selector', 'design', 'out', 'cdp', 'width', 'height', 'scale', 'threshold', 'help']);
for (const token of process.argv.slice(2)) {
  if (token.startsWith('--') && !KNOWN.has(token.slice(2))) {
    throw new ArgError(`неизвестный флаг ${token} (--help покажет справку)`);
  }
}

let config;
try {
  const url = arg('url', undefined);
  const selector = arg('selector', undefined);
  const design = arg('design', undefined);
  if (!url) throw new ArgError('--url обязателен');
  if (!selector) throw new ArgError('--selector обязателен');
  if (!design) throw new ArgError('--design обязателен');
  if (!/^https?:\/\//i.test(url)) throw new ArgError(`--url: ожидается http(s), получено «${url}»`);

  config = {
    url,
    selector,
    design: resolve(design),
    out: resolve(arg('out', join(here, 'figma-parity', 'compare', 'latest'))),
    cdp: intArg('cdp', 9222, { min: 1, max: 65535 }),
    width: intArg('width', 1440, { min: 1, max: 20000 }),
    height: intArg('height', 1000, { min: 1, max: 20000 }),
    scale: numArg('scale', 2, { min: 0.1, max: 8 }),
    threshold: intArg('threshold', 24, { min: 0, max: 255 }),
  };
} catch (error) {
  if (error instanceof ArgError) {
    process.stderr.write(`figma-compare: ${error.message}\n\n${USAGE}`);
    process.exit(2);
  }
  throw error;
}

const { url: URL_, selector: SELECTOR, design: DESIGN, out: OUT, cdp: CDP_PORT } = config;
const { width: VIEW_W, height: VIEW_H, scale: SCALE, threshold: THRESHOLD } = config;

mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ CDP client
/**
 * Браузерный WebSocket + плоские сессии: каждая команда/событие адресуются
 * sessionId, поэтому один сокет обслуживает и браузер, и страницу.
 */
async function connectCdp(port) {
  let version;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    version = await res.json();
  } catch (error) {
    throw new Error(
      `не удалось подключиться к Chrome на порту ${port} (${error.message}). ` +
        `Запустите: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ` +
        `--headless=new --disable-gpu --remote-debugging-port=${port} about:blank`,
    );
  }
  const wsUrl = version.webSocketDebuggerUrl;
  if (!wsUrl) throw new Error(`в /json/version нет webSocketDebuggerUrl (порт ${port})`);

  const ws = new WebSocket(wsUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = () => fail(new Error(`WebSocket ${wsUrl} не открылся`));
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: ok, reject: fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(`${msg.method ?? ''} ${JSON.stringify(msg.error)}`)) : ok(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params, msg.sessionId);
    }
  };

  function send(method, params = {}, sessionId) {
    const id = nextId++;
    return new Promise((ok, fail) => {
      pending.set(id, { resolve: ok, reject: fail });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  function once(method, timeoutMs = 45000, sessionId) {
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => fail(new Error(`timeout ${method}`)), timeoutMs);
      const fn = (params, eventSession) => {
        if (sessionId && eventSession && eventSession !== sessionId) return;
        clearTimeout(timer);
        listeners.set(method, (listeners.get(method) ?? []).filter((f) => f !== fn));
        ok(params);
      };
      listeners.set(method, [...(listeners.get(method) ?? []), fn]);
    });
  }

  return {
    send,
    once,
    close: () => {
      try {
        ws.close();
      } catch {
        /* сокет уже закрыт */
      }
    },
  };
}

// ------------------------------------------------------------------ PNG codec
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4, 8), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Минимальный PNG-энкодер: RGBA8, filter 0, deflateSync. */
function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: none
    raw.set(data.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

const COLOR_CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** PNG-декодер: bit depth 8, color type 0/2/4/6, interlace 0. */
function decodePng(buffer) {
  const bad = (why) => new Error(`PNG не поддержан: ${why}`);
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error('файл не является PNG (нет сигнатуры)');
  }
  let pos = 8;
  let header;
  const idat = [];
  while (pos + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    if (pos + 12 + length > buffer.length) throw new Error(`PNG повреждён: чанк ${type} выходит за файл`);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (!header) throw new Error('PNG повреждён: нет IHDR');
  const { width, height, bitDepth, colorType, interlace } = header;
  if (header.compression !== 0) throw bad(`compression=${header.compression}`);
  if (header.filter !== 0) throw bad(`filter=${header.filter}`);
  if (bitDepth !== 8) throw bad(`bit depth ${bitDepth} (поддерживается только 8)`);
  const channels = COLOR_CHANNELS[colorType];
  if (!channels) {
    throw bad(`color type ${colorType} (поддерживаются 0, 2, 4, 6; для палитры пересохраните PNG)`);
  }
  if (interlace !== 0) throw bad(`interlace ${interlace} (поддерживается только 0)`);
  if (!idat.length) throw new Error('PNG повреждён: нет IDAT');

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = width * bpp;
  const expected = (stride + 1) * height;
  if (raw.length < expected) throw new Error(`PNG повреждён: распаковано ${raw.length} < ${expected} байт`);

  const pixels = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let value;
      switch (filter) {
        case 0:
          value = line[i];
          break;
        case 1:
          value = line[i] + left;
          break;
        case 2:
          value = line[i] + up;
          break;
        case 3:
          value = line[i] + ((left + up) >> 1);
          break;
        case 4:
          value = line[i] + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`PNG повреждён: неизвестный фильтр ${filter} в строке ${y}`);
      }
      cur[i] = value & 0xff;
    }
    cur.copy(pixels, y * stride);
    prev = cur;
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let p = 0, src = 0, dst = 0; p < width * height; p += 1, src += channels, dst += 4) {
    if (colorType === 6) {
      rgba[dst] = pixels[src];
      rgba[dst + 1] = pixels[src + 1];
      rgba[dst + 2] = pixels[src + 2];
      rgba[dst + 3] = pixels[src + 3];
    } else if (colorType === 2) {
      rgba[dst] = pixels[src];
      rgba[dst + 1] = pixels[src + 1];
      rgba[dst + 2] = pixels[src + 2];
      rgba[dst + 3] = 255;
    } else if (colorType === 4) {
      rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = pixels[src];
      rgba[dst + 3] = pixels[src + 1];
    } else {
      rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = pixels[src];
      rgba[dst + 3] = 255;
    }
  }
  return { width, height, data: rgba, hasAlpha: colorType === 4 || colorType === 6 };
}

// ---------------------------------------------------------------- shell helpers
function runSips(args) {
  try {
    execFileSync('sips', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const detail = error.stderr ? error.stderr.toString().trim() : error.message;
    throw new Error(`sips ${args.join(' ')} — ошибка: ${detail}`);
  }
}

function isPng(file) {
  const head = readFileSync(file).subarray(0, 8);
  return head.length === 8 && head.readUInt32BE(0) === 0x89504e47 && head.readUInt32BE(4) === 0x0d0a1a0a;
}

/** Макет → PNG ровно в размер снимка. Промежуточные файлы живут в /tmp. */
function prepareDesign(designPath, targetW, targetH, outDir) {
  if (!existsSync(designPath)) throw new Error(`макет не найден: ${designPath}`);
  const scratch = join(tmpdir(), `figma-compare-${process.pid}`);
  mkdirSync(scratch, { recursive: true });
  let source = designPath;
  try {
    if (!isPng(source)) {
      if (extname(source).toLowerCase() === '.png') {
        throw new Error(`макет ${designPath} повреждён: расширение .png, но сигнатура PNG отсутствует`);
      }
      // webp/heic и прочее — конвертируем системным sips (macOS).
      source = join(scratch, 'design-source.png');
      try {
        runSips(['-s', 'format', 'png', designPath, '--out', source]);
      } catch (error) {
        throw new Error(`не удалось прочитать макет ${designPath}: ${error.message.split('\n')[0]}`);
      }
      console.log(`· макет ${extname(designPath) || '(без расширения)'} → PNG через sips`);
    }
    let decoded = decodePng(readFileSync(source));
    const dest = join(outDir, 'design.png');
    if (decoded.width !== targetW || decoded.height !== targetH) {
      // sips -z принимает высоту, затем ширину.
      if (resolve(source) === resolve(dest)) {
        const staged = join(scratch, 'design-in.png');
        copyFileSync(source, staged);
        source = staged;
      }
      runSips(['-z', String(targetH), String(targetW), source, '--out', dest]);
      decoded = decodePng(readFileSync(dest));
      console.log(`· макет приведён к размеру снимка: ${decoded.width}×${decoded.height}`);
    } else if (resolve(source) !== resolve(dest)) {
      copyFileSync(source, dest);
    }
    return { path: dest, ...decoded };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------------- diff
function compare(web, design, threshold) {
  const { width, height } = web;
  if (design.width !== width || design.height !== height) {
    throw new Error(`размеры не совпали: web ${width}×${height}, design ${design.width}×${design.height}`);
  }
  const total = width * height;
  const a = web.data;
  const b = design.data;
  // Альфу сравниваем только когда она есть с обеих сторон; полностью прозрачный
  // пиксель считаем совпадением — иначе фон «дышит» и метрика врёт.
  const useAlpha = web.hasAlpha && design.hasAlpha;
  const diff = new Uint8Array(total * 4);
  let above = 0;
  let sum = 0;

  for (let p = 0, i = 0; p < total; p += 1, i += 4) {
    const transparent = useAlpha && (a[i + 3] === 0 || b[i + 3] === 0);
    let delta = 0;
    if (!transparent) {
      delta = Math.max(
        Math.abs(a[i] - b[i]),
        Math.abs(a[i + 1] - b[i + 1]),
        Math.abs(a[i + 2] - b[i + 2]),
      );
    }
    sum += delta;
    if (delta > threshold) {
      above += 1;
      diff[i] = 255;
      diff[i + 1] = 0;
      diff[i + 2] = 0;
    } else {
      // Совпавшие пиксели — приглушённый серый, чтобы красное читалось.
      const gray = Math.round(0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]);
      const muted = Math.round(200 + (gray * 55) / 255);
      diff[i] = muted;
      diff[i + 1] = muted;
      diff[i + 2] = muted;
    }
    diff[i + 3] = 255;
  }

  return {
    width,
    height,
    data: diff,
    diffPixels: above,
    diffPercent: total ? (above / total) * 100 : 0,
    meanDelta: total ? sum / total : 0,
  };
}

function sideBySide(panels, gap = 12) {
  const width = panels.reduce((acc, panel) => acc + panel.width, 0) + gap * (panels.length - 1);
  const height = Math.max(...panels.map((panel) => panel.height));
  const data = new Uint8Array(width * height * 4);
  // Фон промежутков — белый, чтобы границы панелей были видны.
  data.fill(255);
  let offsetX = 0;
  for (const panel of panels) {
    for (let y = 0; y < panel.height; y += 1) {
      const from = y * panel.width * 4;
      const to = (y * width + offsetX) * 4;
      data.set(panel.data.subarray(from, from + panel.width * 4), to);
    }
    offsetX += panel.width + gap;
  }
  return { width, height, data };
}

// ------------------------------------------------------------------------- main
async function main() {
  const designFile = DESIGN;
  console.log(`· ${URL_}  ${SELECTOR}`);
  console.log(`· viewport ${VIEW_W}×${VIEW_H} @${SCALE}x, порог ${THRESHOLD}, CDP ${CDP_PORT}`);

  const cdp = await connectCdp(CDP_PORT);
  let sessionId;
  let targetId;
  try {
    const created = await cdp.send('Target.createTarget', { url: 'about:blank' });
    targetId = created.targetId;
    const attached = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    sessionId = attached.sessionId;

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: VIEW_W, height: VIEW_H, deviceScaleFactor: SCALE, mobile: false },
      sessionId,
    );

    const loaded = cdp.once('Page.loadEventFired', 30000, sessionId);
    const nav = await cdp.send('Page.navigate', { url: URL_ }, sessionId);
    if (nav.errorText) throw new Error(`навигация не удалась: ${nav.errorText}`);
    await loaded;

    // Гидрация + @font-face: без этого метрики текста уезжают от макета.
    await cdp
      .send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true }, sessionId)
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 400));

    const rectExpr = `(() => {
      const el = document.querySelector(${JSON.stringify(SELECTOR)});
      if (!el) return JSON.stringify({ ok: false, reason: 'not-found' });
      const r = el.getBoundingClientRect();
      if (!(r.width > 0) || !(r.height > 0)) return JSON.stringify({ ok: false, reason: 'zero-size' });
      return JSON.stringify({
        ok: true,
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      });
    })()`;

    const deadline = Date.now() + 10000;
    let probe = null;
    let lastReason = 'not-found';
    while (Date.now() < deadline) {
      const res = await cdp.send(
        'Runtime.evaluate',
        { expression: rectExpr, returnByValue: true },
        sessionId,
      );
      if (res.exceptionDetails) {
        throw new Error(`Runtime.evaluate: ${JSON.stringify(res.exceptionDetails).slice(0, 400)}`);
      }
      probe = JSON.parse(res.result.value);
      if (probe.ok) break;
      lastReason = probe.reason;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!probe || !probe.ok) {
      throw new Error(`элемент ${SELECTOR} не найден за 10с (${lastReason})`);
    }

    const clip = {
      // CDP ждёт координаты документа, поэтому прибавляем прокрутку.
      x: Math.round(probe.rect.x + probe.scrollX),
      y: Math.round(probe.rect.y + probe.scrollY),
      width: Math.max(1, Math.round(probe.rect.width)),
      height: Math.max(1, Math.round(probe.rect.height)),
      scale: 1,
    };
    const shot = await cdp.send(
      'Page.captureScreenshot',
      { format: 'png', clip, captureBeyondViewport: true, fromSurface: true },
      sessionId,
    );
    const webPath = join(OUT, 'web.png');
    writeFileSync(webPath, Buffer.from(shot.data, 'base64'));
    const web = decodePng(readFileSync(webPath));
    console.log(`· снимок ${web.width}×${web.height} (клип ${clip.width}×${clip.height} @${SCALE}x)`);

    const design = prepareDesign(designFile, web.width, web.height, OUT);
    console.log(`· макет ${design.width}×${design.height}`);

    const diff = compare(web, design, THRESHOLD);
    const diffPath = join(OUT, 'diff.png');
    writeFileSync(diffPath, encodePng(diff));

    const side = sideBySide([web, design, diff]);
    const sidePath = join(OUT, 'side-by-side.png');
    writeFileSync(sidePath, encodePng(side));

    const report = {
      url: URL_,
      selector: SELECTOR,
      cdp: CDP_PORT,
      width: VIEW_W,
      height: VIEW_H,
      scale: SCALE,
      threshold: THRESHOLD,
      webSize: { width: web.width, height: web.height },
      designSize: { width: design.width, height: design.height },
      diffPercent: Number(diff.diffPercent.toFixed(3)),
      meanDelta: Number(diff.meanDelta.toFixed(3)),
      diffPixels: diff.diffPixels,
      paths: {
        out: OUT,
        web: webPath,
        design: design.path,
        diff: diffPath,
        sideBySide: sidePath,
      },
    };
    const reportPath = join(OUT, 'report.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log('');
    console.log(`  web      ${web.width}×${web.height}`);
    console.log(`  design   ${design.width}×${design.height}`);
    console.log(`  diff     ${report.diffPercent}% пикселей выше порога ${THRESHOLD}`);
    console.log(`  mean Δ   ${report.meanDelta} (0–255)`);
    console.log(`  web.png         ${webPath}`);
    console.log(`  design.png      ${design.path}`);
    console.log(`  diff.png        ${diffPath}`);
    console.log(`  side-by-side    ${sidePath}`);
    console.log(`  report.json     ${reportPath}`);
    return 0;
  } finally {
    if (targetId) {
      await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    }
    cdp.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`figma-compare: ${error?.message ?? error}\n`);
    process.exit(1);
  });
