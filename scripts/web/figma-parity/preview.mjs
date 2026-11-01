#!/usr/bin/env node
/**
 * Figma parity — локальный предпросмотр.
 *
 * Рисует те же сцены, что уйдут в плагин, обычным HTML/CSS и снимает PNG
 * через headless Chrome. Нужен, чтобы смотреть результат до запуска плагина.
 *
 * Usage: node scripts/web/figma-parity/preview.mjs [--cdp 9222] [--out preview]
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildShellScene, TOKENS } from './shell.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CDP_PORT = process.env.CDP_PORT ?? '9222';
const outDir = resolve(here, 'preview');
mkdirSync(outDir, { recursive: true });

const routes = JSON.parse(readFileSync(join(here, 'routes.json'), 'utf8'));

// ------------------------------------------------------------------ CDP
async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const target = targets.find((t) => t.type === 'page');
  if (!target) throw new Error('нет page-таргета в Chrome (--remote-debugging-port)');
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
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      const id = nextId++;
      pending.set(id, { resolve: ok, reject: fail });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const once = (method, timeoutMs = 30000) =>
    new Promise((ok, fail) => {
      const timer = setTimeout(() => fail(new Error(`timeout ${method}`)), timeoutMs);
      const fn = (params) => {
        clearTimeout(timer);
        listeners.set(method, (listeners.get(method) ?? []).filter((f) => f !== fn));
        ok(params);
      };
      listeners.set(method, [...(listeners.get(method) ?? []), fn]);
    });
  await send('Page.enable');
  await send('Runtime.enable');
  return { send, once, ws };
}

// ------------------------------------------------------------------ HTML
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function firstColor(gradient) {
  const match = String(gradient).match(/(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})/);
  return match ? match[1] : null;
}

function svgMarkup(row) {
  let svg = row.svg;
  if (row.svgStroke) {
    const target = row.svgStroke.toLowerCase();
    svg = svg
      .replace(/stroke="#[0-9a-fA-F]{3,8}"/g, `stroke="${target}"`)
      .replace(/stroke="currentColor"/gi, `stroke="${target}"`);
  }
  if (row.svgFill) {
    const target = row.svgFill.toLowerCase();
    svg = svg.replace(/fill="#[0-9a-fA-F]{3,8}"/g, `fill="${target}"`);
  }
  return svg.replace(/<svg /, `<svg style="display:block;width:100%;height:100%" `);
}

function textBoxAbs(row) {
  const bw = row.bw || [0, 0, 0, 0];
  const pad = row.pad || [0, 0, 0, 0];
  let left = row.x + bw[3] + pad[3];
  let top = row.tr ? row.tr[1] : row.y + bw[0] + pad[0];
  let width = row.w - bw[3] - bw[1] - pad[3] - pad[1];
  if (!(width > 4)) {
    left = row.x;
    width = Math.max(row.w, 4);
  }
  // Многострочный блок — параграф: ширина по самой длинной строке + слак.
  if (row.lc > 1) {
    return { left: row.x, top: row.y, width: Math.max(row.lw || row.w, 4) + 2, nowrap: false };
  }
  // Однострочный текст (метка, бейдж, кнопка) позиционируем по ink-box и
  // запрещаем перенос: иначе браузер ломает строку ровно на границе ширины.
  if (row.tr && row.tr[3] <= (row.fs || 16) * 1.75) {
    return { left: row.tr[0], top: row.tr[1], width: row.tr[2] + 3, nowrap: true };
  }
  return { left, top, width, nowrap: false };
}

function styleFor(row) {
  const css = ['position:absolute', `left:${row.x}px`, `top:${row.y}px`, `width:${row.w}px`, `height:${row.h}px`];
  const fill = row.f || (row.g ? firstColor(row.g) : null);
  if (fill) css.push(`background-color:${fill}`);
  if (row.g) css.push(`background-image:${row.g}`);
  if (row.r) css.push(`border-radius:${row.r}`);
  if (row.b) {
    const side = (name) => {
      const value = row.b[name];
      return value ? `${value.w}px solid ${value.color}` : '0';
    };
    css.push(
      `border-top:${side('top')}`,
      `border-right:${side('right')}`,
      `border-bottom:${side('bottom')}`,
      `border-left:${side('left')}`,
    );
  }
  if (row.sh) css.push(`box-shadow:${row.sh}`);
  if (row.op !== undefined) css.push(`opacity:${row.op}`);
  if (row.clip) css.push('overflow:hidden');
  return css.join(';');
}

function textStyleFor(row) {
  const css = ['position:absolute', `left:${row.x}px`, `top:${row.y}px`, `width:${row.w}px`];
  css.push(`font-family:'${TOKENS.font.family}',system-ui,sans-serif`);
  css.push(`font-size:${row.fs}px`);
  css.push(`font-weight:${row.fw}`);
  if (row.lh && row.lh !== 'normal') css.push(`line-height:${row.lh}`);
  if (row.ls && row.ls !== 'normal') css.push(`letter-spacing:${row.ls}`);
  css.push(`color:${row.c}`);
  if (row.tt === 'uppercase') css.push('text-transform:uppercase');
  if (row.al) css.push(`text-align:${row.al}`);
  css.push(row.nowrap ? 'white-space:nowrap' : 'white-space:pre-wrap');
  return css.join(';');
}

function renderNodes(scene, indices, parentAbs, children, out) {
  for (const index of indices) {
    const row = scene.nodes[index];
    const local = { ...row, x: row.x - parentAbs.x, y: row.y - parentAbs.y };
    const kids = children.get(index) || [];
    const tb = row.tx ? textBoxAbs(row) : null;

    if (row.img) {
      out.push(
        `<div style="${styleFor(local)};background-image:url('${row.img}');background-size:cover;background-position:top left"></div>`,
      );
      continue;
    }

    if (row.svg) {
      out.push(`<div style="${styleFor(local)}">${svgMarkup(row)}</div>`);
      continue;
    }

    if (kids.length === 0 && !row.tx) {
      out.push(`<div style="${styleFor(local)}"></div>`);
      continue;
    }

    if (kids.length === 0 && row.tx && !row.f && !row.b) {
      const css = textStyleFor({
        ...local,
        x: tb.left - parentAbs.x,
        y: tb.top - parentAbs.y,
        w: tb.width,
        nowrap: tb.nowrap,
      });
      out.push(`<div style="${css}">${escapeHtml(row.tx)}</div>`);
      continue;
    }

    out.push(`<div style="${styleFor(local)}">`);
    if (row.tx) {
      const css = textStyleFor({
        ...local,
        x: tb.left - row.x,
        y: tb.top - row.y,
        w: tb.width,
        nowrap: tb.nowrap,
      });
      out.push(`<div style="${css}">${escapeHtml(row.tx)}</div>`);
    }
    renderNodes(scene, kids, row, children, out);
    out.push('</div>');
  }
}

const dotTile = `<svg xmlns="http://www.w3.org/2000/svg" width="${TOKENS.dot.tile}" height="${TOKENS.dot.tile}"><rect width="100%" height="100%" fill="${TOKENS.dot.background}"/><circle cx="${TOKENS.dot.tile / 2}" cy="${TOKENS.dot.tile / 2}" r="${TOKENS.dot.diameter / 2}" fill="${TOKENS.dot.color}"/></svg>`;
const dotUrl = `data:image/svg+xml;utf8,${encodeURIComponent(dotTile)}`;

function sceneToHtml(scene) {
  const children = new Map();
  for (const node of scene.nodes) {
    if (node.p === -1) continue;
    if (!children.has(node.p)) children.set(node.p, []);
    children.get(node.p).push(node.i);
  }
  const roots = scene.nodes.filter((node) => node.p === -1).map((node) => node.i);
  const parts = [];
  renderNodes(scene, roots, { x: 0, y: 0 }, children, parts);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}
  body{margin:0;background:${TOKENS.dot.background}}
  #screen{position:relative;width:${scene.doc.w}px;height:${scene.doc.h}px;
    background-image:url("${dotUrl}");background-size:${TOKENS.dot.tile}px ${TOKENS.dot.tile}px;background-repeat:repeat}
  </style></head><body><div id="screen">${parts.join('')}</div></body></html>`;
}

// ------------------------------------------------------------------- run
const { send, once, ws } = await connect();
const results = [];
const viewports = routes.viewports ?? [{ id: 'desktop' }];
const jobs = [];
for (const viewport of viewports) {
  for (const screen of routes.screens) {
    const allowed = screen.viewports ?? routes.defaultViewports ?? viewports.map((item) => item.id);
    if (!allowed.includes(viewport.id)) continue;
    const suffix = viewport.id === 'desktop' ? '' : `--${viewport.id}`;
    jobs.push({ fileBase: `${screen.slug}${suffix}`, slug: screen.slug });
  }
}

for (const job of jobs) {
  const raw = JSON.parse(readFileSync(join(here, 'scenes', `${job.fileBase}.json`), 'utf8'));
  const scene = buildShellScene(raw);
  const html = sceneToHtml(scene);
  const htmlPath = join(outDir, `${job.fileBase}.html`);
  writeFileSync(htmlPath, html);

  await send('Emulation.setDeviceMetricsOverride', {
    width: scene.doc.w,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: `file://${htmlPath}` });
  await loaded;
  await new Promise((r) => setTimeout(r, 500));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const pngPath = join(outDir, `${job.fileBase}.png`);
  writeFileSync(pngPath, Buffer.from(shot.data, 'base64'));
  results.push({ slug: job.fileBase, png: pngPath, w: scene.doc.w, h: scene.doc.h });
  console.log(`${job.fileBase}: ${scene.doc.w}×${scene.doc.h} → ${pngPath}`);
}

ws.close();
process.exit(0);
