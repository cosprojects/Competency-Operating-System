#!/usr/bin/env node
/**
 * Figma parity — шаг 1: снять отрендеренную геометрию и стили экранов приложения.
 *
 * Гоняет headless Chrome по CDP (без npm-зависимостей: global fetch + global
 * WebSocket в Node >= 22), обходит DOM и сохраняет для каждого видимого узла
 * абсолютные координаты, заливки, рамки, тени, шрифт и текст.
 *
 * Usage:
 *   node scripts/web/figma-parity/extract.mjs \
 *     --base http://127.0.0.1:3100 \
 *     --cdp  9222 \
 *     --out  scripts/web/figma-parity/scenes
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg('base', 'http://127.0.0.1:3100');
const CDP_PORT = arg('cdp', process.env.CDP_PORT ?? '9222');
const OUT = resolve(arg('out', join(here, 'scenes')));
const ROUTES_FILE = arg('routes', join(here, 'routes.json'));
const COOKIE = arg('cookie', process.env.PARITY_COOKIE ?? '');
const [COOKIE_NAME, COOKIE_VALUE] = COOKIE.includes('=')
  ? [COOKIE.slice(0, COOKIE.indexOf('=')), COOKIE.slice(COOKIE.indexOf('=') + 1)]
  : ['', ''];
const routes = JSON.parse(readFileSync(ROUTES_FILE, 'utf8'));
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = routes.viewports ?? [routes.viewport ?? { id: 'desktop', width: 1440, height: 1000 }];
const COMPONENTS = routes.components ?? {};

// ---------------------------------------------------------------- CDP client
const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
const target = targets.find((t) => t.type === 'page');
if (!target) throw new Error('нет page-таргета; Chrome запущен с --remote-debugging-port?');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let nextId = 1;
const pending = new Map();
const listeners = new Map();

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve: ok, reject: fail } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? fail(new Error(JSON.stringify(msg.error))) : ok(msg.result);
  } else if (msg.method) {
    for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
  }
};

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((ok, fail) => {
    pending.set(id, { resolve: ok, reject: fail });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function once(method, timeoutMs = 45000) {
  return new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error(`timeout ${method}`)), timeoutMs);
    const fn = (params) => {
      clearTimeout(timer);
      listeners.set(method, (listeners.get(method) ?? []).filter((f) => f !== fn));
      ok(params);
    };
    listeners.set(method, [...(listeners.get(method) ?? []), fn]);
  });
}

await send('Page.enable');
await send('Runtime.enable');
async function applyViewport(viewport) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: Boolean(viewport.mobile),
  });
}
await applyViewport(VIEWPORTS[0]);
await send('Network.enable');

async function setAuthCookie(authorized) {
  if (!COOKIE_NAME) return;
  if (authorized) {
    await send('Network.setCookie', {
      name: COOKIE_NAME,
      value: COOKIE_VALUE,
      domain: '127.0.0.1',
      path: '/',
    });
  } else {
    await send('Network.deleteCookies', { name: COOKIE_NAME, domain: '127.0.0.1' });
  }
}

// ------------------------------------------------- page-side extraction script
const pageScript = (configJson) => String.raw`
(() => {
  const CONFIG = ${configJson};
  const selectors = Object.entries(CONFIG).map(([key, sel]) => ({ key, sel }));
  const docRoot = document.body;
  const docRect = docRoot.getBoundingClientRect();

  const colorOf = (v) => v;
  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  const signature = (el) => {
    const shape = (node) => {
      let out = node.tagName.toLowerCase() + (node.getAttribute('class') || '');
      for (const child of node.children) out += '{' + shape(child) + '}';
      return out;
    };
    return hash(shape(el));
  };
  const componentKey = (el) => {
    let best = null;
    for (const { key, sel } of selectors) {
      if (!el.matches(sel)) continue;
      if (!best || sel.length > best.sel.length) best = { key, sel };
    }
    return best ? best.key : undefined;
  };
  const ownText = (el) => {
    const tag = el.tagName.toLowerCase();
    try {
      if (tag === 'input' || tag === 'textarea') {
        return el.getAttribute('placeholder') || el.value || '';
      }
      if (tag === 'select') {
        const opt = el.selectedOptions && el.selectedOptions[0];
        return opt ? opt.textContent.trim() : '';
      }
    } catch (error) {
      return '';
    }
    return Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const sides = (cs) => {
    const w = (p) => parseFloat(cs.getPropertyValue('border-' + p + '-width')) || 0;
    const st = (p) => cs.getPropertyValue('border-' + p + '-style');
    const c = (p) => cs.getPropertyValue('border-' + p + '-color');
    const out = {};
    for (const p of ['top', 'right', 'bottom', 'left']) {
      if (w(p) > 0 && st(p) !== 'none') out[p] = { w: +w(p).toFixed(2), color: c(p) };
    }
    return out;
  };
  // Ширины рамок по сторонам — нужны, чтобы посчитать content-box текста.
  const borderWidths = (cs) =>
    ['top', 'right', 'bottom', 'left'].map(
      (p) => parseFloat(cs.getPropertyValue('border-' + p + '-width')) || 0,
    );
  const paddings = (cs) =>
    ['top', 'right', 'bottom', 'left'].map((p) => parseFloat(cs.getPropertyValue('padding-' + p)) || 0);
  // Реальный ink-box текста: даёт вертикальное положение строки внутри кнопки/чипа.
  // Разбиваем текстовую ноду на строки: одна нода = одна строка. Тогда
  // переносы совпадают с браузером пиксель-в-пиксель и не приходится надеяться
  // на одинаковый wrap в Figma.
  const textLines = (textNode) => {
    try {
      const raw = textNode.textContent;
      if (!raw || !raw.trim()) return [];
      const startOffset = raw.length - raw.trimStart().length;
      const endOffset = startOffset + raw.trim().length;
      const lines = [];
      for (let index = startOffset; index < endOffset; index += 1) {
        const char = raw[index];
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + 1);
        const rect = range.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) continue;
        if (!char.trim()) {
          // пробел приклеиваем к текущей строке, новую не открываем
          if (lines.length) continue;
        }
        const top = rect.top;
        const last = lines[lines.length - 1];
        if (!last || Math.abs(last.top - top) > 1) {
          lines.push({
            top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            start: index,
            end: index + 1,
          });
        } else {
          last.left = Math.min(last.left, rect.left);
          last.right = Math.max(last.right, rect.right);
          last.bottom = Math.max(last.bottom, rect.bottom);
          last.end = index + 1;
        }
      }
      return lines
        .map((line) => ({
          text: raw.slice(line.start, line.end).trim(),
          rect: [
            +(line.left - docRect.left).toFixed(2),
            +(line.top - docRect.top).toFixed(2),
            +(line.right - line.left).toFixed(2),
            +(line.bottom - line.top).toFixed(2),
          ],
        }))
        .filter((line) => line.text);
    } catch (error) {
      return [];
    }
  };

  const nodes = [];
  const stack = []; // captured ancestors

  const push = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) return null;
    const tag = el.tagName.toLowerCase();
    const bg = cs.backgroundColor;
    const bgImage = cs.backgroundImage;
    const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    const hasGradient = bgImage && bgImage.includes('gradient');
    const border = sides(cs);
    const hasBorder = Object.keys(border).length > 0;
    const shadow = cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow : undefined;
    const isSvg = tag === 'svg';
    const isImg = tag === 'img';
    const text = ownText(el);
    const visual = hasBg || hasGradient || hasBorder || Boolean(shadow) || isSvg || isImg;
    if (!visual && !text) return null;

    const radius = cs.borderRadius;
    const node = {
      i: nodes.length,
      p: stack.length ? stack[stack.length - 1].i : -1,
      tag,
      x: +(r.left - docRect.left).toFixed(2),
      y: +(r.top - docRect.top).toFixed(2),
      w: +r.width.toFixed(2),
      h: +r.height.toFixed(2),
    };
    const cls = el.getAttribute('class');
    if (cls) node.cls = cls;
    if (hasBg) node.f = colorOf(bg);
    if (hasGradient) node.g = bgImage.slice(0, 240);
    if (radius && radius !== '0px') node.r = radius;
    if (hasBorder) node.b = border;
    if (shadow) node.sh = shadow.slice(0, 240);
    if (Number(cs.opacity) < 1) node.op = +cs.opacity.toFixed(2);
    if (cs.overflow !== 'visible') node.clip = 1;
    if (isSvg) node.svg = el.outerHTML.slice(0, 24000);
    if (isImg) node.img = { src: el.getAttribute('src'), alt: el.getAttribute('alt') };
    // Текстовая нода появляется отдельным узлом (см. walk) — иначе инлайн-текст,
    // перемешанный с <a>/<strong>, склеивался в один блок и наезжал на детей.
    const fieldLike = tag === 'input' || tag === 'textarea' || tag === 'select';
    const typeAttr = (el.getAttribute('type') || '').toLowerCase();
    const hasGlyphText = fieldLike
      ? typeAttr !== 'checkbox' && typeAttr !== 'radio' && Boolean(text)
      : false;
    if (fieldLike) {
      node.pad = paddings(cs);
      node.bw = borderWidths(cs);
    }
    const ck = componentKey(el);
    if (ck) {
      node.ck = ck;
      node.sig = signature(el);
    }
    nodes.push(node);
    return node;
  };

  // Текстовая нода снимается со стилями родителя (они наследуются в CSS).
  // Внутри храним и полный текст, и построчные боксы: рендерер сам решает,
  // делать редактируемый параграф или точную однострочную метку.
  const pushText = (textNode, ownerEl, ownerNode) => {
    if (!ownerNode) return;
    const lines = textLines(textNode);
    if (!lines.length) return;
    const cs = getComputedStyle(ownerEl);
    const left = Math.min(...lines.map((line) => line.rect[0]));
    const top = Math.min(...lines.map((line) => line.rect[1]));
    const right = Math.max(...lines.map((line) => line.rect[0] + line.rect[2]));
    const bottom = Math.max(...lines.map((line) => line.rect[1] + line.rect[3]));
    const maxLineWidth = Math.max(...lines.map((line) => line.rect[2]));
    nodes.push({
      i: nodes.length,
      p: ownerNode.i,
      tag: '#text',
      x: +left.toFixed(2),
      y: +top.toFixed(2),
      w: +(right - left).toFixed(2),
      h: +(bottom - top).toFixed(2),
      tr: [+left.toFixed(2), +top.toFixed(2), +(right - left).toFixed(2), +(bottom - top).toFixed(2)],
      tx: lines.map((line) => line.text).join(' '),
      lc: lines.length,
      lw: +maxLineWidth.toFixed(2),
      lines: lines.map((line) => ({ text: line.text, rect: line.rect })),
      c: cs.color,
      fs: parseFloat(cs.fontSize),
      fw: Number(cs.fontWeight) || 400,
      lh: cs.lineHeight,
      ls: cs.letterSpacing,
      al: cs.textAlign,
      tt: cs.textTransform && cs.textTransform !== 'none' ? cs.textTransform : undefined,
      it: cs.fontStyle === 'italic' ? 1 : undefined,
      pad: [0, 0, 0, 0],
      bw: [0, 0, 0, 0],
    });
  };

  // Для input/select глифов в DOM нет — синтезируем текстовую ноду по content-box.
  const pushFieldText = (el, node) => {
    const typeAttr = (el.getAttribute('type') || '').toLowerCase();
    if (typeAttr === 'checkbox' || typeAttr === 'radio') return;
    const cs = getComputedStyle(el);
    const bw = borderWidths(cs);
    const pad = paddings(cs);
    const text = ownText(el);
    if (!text) return;
    const left = node.x + bw[3] + pad[3];
    const top = node.y + bw[0] + pad[0];
    const width = node.w - bw[3] - bw[1] - pad[3] - pad[1];
    const height = node.h - bw[0] - bw[2] - pad[0] - pad[2];
    if (!(width > 4)) return;
    nodes.push({
      i: nodes.length,
      p: node.i,
      tag: '#text',
      x: +left.toFixed(2),
      y: +top.toFixed(2),
      w: +width.toFixed(2),
      h: +height.toFixed(2),
      tr: [+left.toFixed(2), +top.toFixed(2), +width.toFixed(2), +height.toFixed(2)],
      tx: text,
      lc: 1,
      lw: +width.toFixed(2),
      c: cs.color,
      fs: parseFloat(cs.fontSize),
      fw: Number(cs.fontWeight) || 400,
      lh: cs.lineHeight,
      ls: cs.letterSpacing,
      al: cs.textAlign,
      tt: cs.textTransform && cs.textTransform !== 'none' ? cs.textTransform : undefined,
      it: cs.fontStyle === 'italic' ? 1 : undefined,
      pad: [0, 0, 0, 0],
      bw: [0, 0, 0, 0],
    });
  };

  const walk = (el) => {
    let created = null;
    try {
      created = push(el);
    } catch (error) {
      created = null; // один проблемный узел не должен ронять весь экран
    }
    if (created) stack.push(created);
    if (created) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        try {
          pushFieldText(el, created);
        } catch (error) {
          /* без синтетического текста */
        }
      } else {
        // Текстовые ноды и элементы идут в DOM-порядке — так инлайн-текст
        // остаётся на своих местах между ссылками и выделениями.
        for (const child of el.childNodes) {
          if (child.nodeType === 3) {
            try {
              pushText(child, el, created);
            } catch (error) {
              /* пропускаем проблемную текстовую ноду */
            }
          } else if (child.nodeType === 1) {
            walk(child);
          }
        }
      }
    } else {
      for (const child of el.children) walk(child);
    }
    if (created) stack.pop();
  };

  for (const child of docRoot.children) walk(child);

  const rootStyle = getComputedStyle(document.documentElement);
  const cssVars = {};
  for (const name of [
    '--ink', '--muted', '--soft', '--bg', '--panel', '--line',
    '--accent', '--accent-dark', '--accent-soft',
    '--success', '--warning', '--danger', '--radius', '--shadow', '--font',
  ]) {
    cssVars[name] = rootStyle.getPropertyValue(name).trim();
  }

  return JSON.stringify({
    title: document.title,
    url: location.href,
    viewport: { w: innerWidth, h: innerHeight },
    doc: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
    cssVars,
    nodeCount: nodes.length,
    nodes,
  });
})()`;

// ------------------------------------------------------------------ per route
const manifest = [];
for (const viewport of VIEWPORTS) {
  await applyViewport(viewport);
  for (const route of routes.screens) {
    const allowed =
      route.viewports ?? routes.defaultViewports ?? VIEWPORTS.map((item) => item.id);
    if (!allowed.includes(viewport.id)) continue;
    if (route.auth && !COOKIE_NAME) {
      console.log(`· ${route.slug} — пропущен: нужен --cookie (см. dev-session.mjs)`);
      continue;
    }
    const suffix = viewport.id === 'desktop' ? '' : `--${viewport.id}`;
    const fileBase = `${route.slug}${suffix}`;
    process.stdout.write(`· ${fileBase} ${route.route} @${viewport.width} … `);
    await setAuthCookie(Boolean(route.auth));
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: BASE + route.route });
    await loaded;
    await new Promise((r) => setTimeout(r, 800)); // гидрация/сетевые запросы
    // Ждём @font-face: иначе текст измеряется фолбэком и метрики уезжают.
    await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });

    // Экраны с подготовкой состояния: например, масштаб канваса.
    for (const step of route.preCapture ?? []) {
      try {
        await send('Runtime.evaluate', { expression: step, awaitPromise: true });
      } catch (error) {
        /* шаг подготовки не критичен */
      }
    }
    if (route.preCapture?.length) await new Promise((r) => setTimeout(r, 600));

    const res = await send('Runtime.evaluate', {
      expression: pageScript(JSON.stringify(COMPONENTS)),
      returnByValue: true,
      timeout: 90000,
      awaitPromise: false,
    });
    if (res.exceptionDetails) {
      console.error(`\n  extract failed: ${JSON.stringify(res.exceptionDetails).slice(0, 600)}`);
      continue;
    }
    const payload = JSON.parse(res.result.value);
    const scene = { ...route, ...payload, viewportId: viewport.id };
    scene.slug = fileBase;

    if (route.capture === 'raster') {
      // Приложения с панорамой/зумом (канвас компетенций) снимаем картинкой:
      // векторная реконструкция ломается на CSS-трансформах масштаба.
      const raster = await send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 84,
        captureBeyondViewport: false,
      });
      scene.raster = `data:image/jpeg;base64,${raster.data}`;
      scene.doc = { w: viewport.width, h: viewport.height };
      scene.nodes = [];
      scene.nodeCount = 0;
    }
    writeFileSync(join(OUT, `${fileBase}.json`), JSON.stringify(scene));

    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    });
    writeFileSync(join(OUT, `${fileBase}.png`), Buffer.from(shot.data, 'base64'));

    manifest.push({
      slug: fileBase,
      name: route.name,
      route: route.route,
      viewport: viewport.id,
      nodes: payload.nodeCount,
      size: `${payload.doc.w}x${payload.doc.h}`,
    });
    console.log(`${payload.nodeCount} nodes, ${payload.doc.w}x${payload.doc.h}`);
  }
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nготово: ${manifest.length} экранов -> ${OUT}`);
ws.close();
process.exit(0);
