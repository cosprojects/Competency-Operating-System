#!/usr/bin/env node
/**
 * Figma parity — шаг 1.5: оболочка.
 *
 * Берёт сырые сцены из extract.mjs (это 1:1 слепок вёрстки) и пересобирает их
 * в новую визуальную систему из файла AXIONA — mvp:
 *
 *   • фон экрана — точечный канвас (#FEFEFE, точка Ø1.5 #E2E8F0 каждые 24px);
 *   • слева — Floating-Nav (node 108:4400), открытый вариант 188×590;
 *   • контент — на workspace-подложке (#F9FAFB, radius 16, padding 40) шириной
 *     1200, внутри — карточки-подложки (#FFFFFF, border #E2E8F0, radius 16,
 *     тень 0 12px 20px rgba(181,172,172,0.35)).
 *
 * Спецификация снята из файла: 108:4400 (nav), 18:167 (плоскости),
 * 34:2969 (точечный тайл).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(here, 'assets');

// ------------------------------------------------------------------ токены
export const TOKENS = {
  color: {
    page: '#FEFEFE',
    surface: '#FFFFFF',
    muted: '#F8FAFC',
    sunken: '#F9FAFB',
    border: '#E2E8F0',
    ink: '#080B10',
    glyph: '#595959',
    accent: '#4F46E5',
  },
  radius: { lg: 10, xl: 12, '2xl': 12, '3xl': 16 },
  shadow: {
    nav: '0px 12px 40px rgba(0, 0, 0, 0.25)',
    panel: '0px 12px 20px rgba(181, 172, 172, 0.35)',
  },
  dot: { tile: 24, diameter: 1.5, color: '#E2E8F0', background: '#FEFEFE' },
  font: { family: 'Geist', body: 16, small: 14, lineHeight: 20 },
};

export const SHELL = {
  frameWidth: 1500,
  margin: 40,
  nav: { width: 188, height: 590, gap: 32 },
  workspace: { width: 1200, padding: 40, radius: 16 },
  minHeight: 1000,
  mobile: {
    // На 390 вёрстка сама отдаёт контейнер 358 с полями 16 — подложка
    // становится full-bleed, чтобы контент остался 1:1 без масштабирования.
    padding: 16,
    minHeight: 844,
  },
};

// ------------------------------------------------------------------ ассеты
function readAsset(name) {
  return readFileSync(join(assetsDir, name), 'utf8');
}

const ICONS = {
  home: readAsset('home.svg'),
  structure: readAsset('structure.svg'),
  graph: readAsset('graph.svg'),
  star: readAsset('star.svg'),
  chat: readAsset('chat.svg'),
  login: readAsset('login.svg'),
  logoMark: readAsset('logo-mark.svg'),
  logoText: readAsset('logo-text.svg'),
};

const NAV_ITEMS = [
  { key: 'home', label: 'Главная', routes: ['/'] },
  { key: 'structure', label: 'Профессии', routes: ['/professions'] },
  { key: 'graph', label: 'Схемы', routes: ['/canvas'] },
  { key: 'star', label: 'Сохранённое', routes: ['/saved'] },
  { key: 'chat', label: 'Обратная связь', routes: ['/feedback'] },
];

function activeIndexForRoute(route) {
  if (route.startsWith('/professions')) return 1;
  if (route.startsWith('/competencies')) return 1;
  if (route.startsWith('/canvas')) return 2;
  if (route.startsWith('/saved')) return 3;
  if (route.startsWith('/feedback')) return 4;
  if (route === '/') return 0;
  return -1;
}

// ---------------------------------------------------------------- нав-рэйл
const N = SHELL.nav;
const NAV_X = SHELL.margin;
const NAV_Y = SHELL.margin;
const ITEM_HEIGHT = 32;
const ITEM_GAP = 20;
const ITEMS_TOP = 20 + 32 + N.gap; // padding + бренд + gap
const CTA_HEIGHT = 44;
const CTA_TOP = N.height - 20 - CTA_HEIGHT;

function buildNavNodes(route, startIndex) {
  const nodes = [];
  const push = (node) => {
    node.i = nodes.length + startIndex;
    nodes.push(node);
    return node.i;
  };

  const navIndex = push({
    tag: 'div',
    cls: 'floating-nav',
    ck: 'nav-rail',
    sig: 'open',
    x: NAV_X,
    y: NAV_Y,
    w: N.width,
    h: N.height,
    f: 'rgba(255, 255, 255, 0.7)',
    r: `${TOKENS.radius.xl}px`,
    b: {
      top: { w: 1, color: TOKENS.color.surface },
      right: { w: 1, color: TOKENS.color.surface },
      bottom: { w: 1, color: TOKENS.color.surface },
      left: { w: 1, color: TOKENS.color.surface },
    },
    sh: TOKENS.shadow.nav,
    p: -1,
  });

  // Бренд: лого-марка 34×32 + текст 107×18, отступ 4.
  push({
    tag: 'svg',
    cls: 'nav-logo-mark',
    x: NAV_X + 20,
    y: NAV_Y + 20,
    w: 34,
    h: 32,
    svg: ICONS.logoMark,
    p: navIndex,
  });
  push({
    tag: 'svg',
    cls: 'nav-logo-text',
    x: NAV_X + 20 + 34 + 4,
    y: NAV_Y + 20 + 7,
    w: 107,
    h: 18,
    svg: ICONS.logoText,
    p: navIndex,
  });

  const activeIndex = activeIndexForRoute(route);
  NAV_ITEMS.forEach((item, index) => {
    const top = NAV_Y + ITEMS_TOP + index * (ITEM_HEIGHT + ITEM_GAP);
    const active = index === activeIndex;
    push({
      tag: 'svg',
      cls: `nav-icon nav-icon-${item.key}`,
      x: NAV_X + 20 + 4,
      y: top + 4,
      w: 24,
      h: 24,
      svg: ICONS[item.key],
      svgStroke: active ? TOKENS.color.accent : TOKENS.color.glyph,
      p: navIndex,
    });
    push({
      tag: 'span',
      cls: `nav-label nav-label-${item.key}`,
      x: NAV_X + 20 + 4 + 24 + 10,
      y: top + 6,
      w: 140,
      h: 20,
      tx: item.label,
      c: active ? TOKENS.color.accent : TOKENS.color.glyph,
      fs: TOKENS.font.body,
      fw: 400,
      lh: `${TOKENS.font.lineHeight}px`,
      ls: 'normal',
      al: 'left',
      bw: [0, 0, 0, 0],
      pad: [0, 0, 0, 0],
      p: navIndex,
    });
  });

  // CTA «Войти» внизу.
  const ctaIndex = push({
    tag: 'div',
    cls: 'nav-cta',
    x: NAV_X + 20,
    y: NAV_Y + CTA_TOP,
    w: N.width - 40,
    h: CTA_HEIGHT,
    f: TOKENS.color.muted,
    r: `${TOKENS.radius.lg}px`,
    p: navIndex,
  });
  push({
    tag: 'svg',
    cls: 'nav-cta-icon',
    x: NAV_X + 20 + 14,
    y: NAV_Y + CTA_TOP + 10,
    w: 24,
    h: 24,
    svg: ICONS.login,
    svgStroke: TOKENS.color.ink,
    p: ctaIndex,
  });
  push({
    tag: 'span',
    cls: 'nav-cta-label',
    x: NAV_X + 20 + 14 + 24 + 10,
    y: NAV_Y + CTA_TOP + 13,
    w: 60,
    h: 17,
    tx: 'Войти',
    c: TOKENS.color.ink,
    fs: TOKENS.font.small,
    fw: 500,
    lh: 'normal',
    ls: 'normal',
    al: 'left',
    bw: [0, 0, 0, 0],
    pad: [0, 0, 0, 0],
    p: ctaIndex,
  });

  return { nodes, navIndex };
}

// ------------------------------------------------------- ремап стилей
function hasClass(node, name) {
  return Boolean(node.cls && node.cls.split(/\s+/).includes(name));
}

function mapRadius(value) {
  if (!value) return value;
  if (String(value).includes('%')) return value;
  return String(value)
    .split(/\s+/)
    .map((part) => {
      const px = parseFloat(part);
      if (Number.isNaN(px)) return part;
      if (px >= 18) return '16px';
      if (px >= 13) return '12px';
      return `${px}px`;
    })
    .join(' ');
}

function isPanel(node) {
  if (!node.f) return false;
  const isWhite = /rgba?\(\s*255\s*,\s*255\s*,\s*255/i.test(node.f) || node.f === '#FFFFFF';
  if (!isWhite) return false;
  if (!node.b) return false;
  if (!node.r) return false;
  if (node.w < 200 || node.h < 60) return false;
  if (parseFloat(node.r) >= 100) return false; // пилюли не панели
  return true;
}

function restyle(node, panelAllowed) {
  const out = { ...node };
  if (out.r) out.r = mapRadius(out.r);
  if (out.b) {
    for (const side of Object.keys(out.b)) {
      out.b = { ...out.b, [side]: { ...out.b[side], color: TOKENS.color.border } };
    }
  }
  if (panelAllowed && isPanel(out)) {
    out.sh = TOKENS.shadow.panel;
    return { node: out, isPanel: true };
  }
  return { node: out, isPanel: false };
}

function dropRule(node) {
  if (hasClass(node, 'site-header')) return 'заменён нав-рэйлом';
  if (hasClass(node, 'footer')) return 'футер вне экранных макетов';
  if (hasClass(node, 'consent-banner')) return 'баннер согласия не часть экрана';
  if (hasClass(node, 'notice') && !hasClass(node, 'info')) return 'черновой preview-варнинг';
  return null;
}

// ------------------------------------------------------------- сборка сцены
export function buildShellScene(raw) {
  const nodes = raw.nodes;
  const children = new Map();
  for (const node of nodes) {
    if (node.p === -1) continue;
    if (!children.has(node.p)) children.set(node.p, []);
    children.get(node.p).push(node.i);
  }

  // 1. Помечаем выброшенные поддеревья.
  const dropped = new Set();
  const dropLog = [];
  const markDropped = (index) => {
    dropped.add(index);
    for (const child of children.get(index) || []) markDropped(child);
  };
  for (const node of nodes) {
    const reason = dropRule(node);
    if (!reason) continue;
    if (dropped.has(node.i)) continue;
    markDropped(node.i);
    dropLog.push({ cls: node.cls, reason });
  }

  // 2. Границы оставшегося контента.
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  for (const node of nodes) {
    if (dropped.has(node.i)) continue;
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + node.h);
    minX = Math.min(minX, node.x);
  }
  if (!Number.isFinite(minY)) {
    minY = 0;
    maxY = 0;
    minX = 0;
  }

  // Полноэкранные приложения (канвас) идут без нав-рэйла и подложки: это
  // отдельная вкладка продукта, а не страница внутри оболочки.
  if (raw.raster) {
    return {
      slug: raw.slug,
      name: raw.name,
      route: raw.route,
      mode: 'standalone',
      doc: { w: raw.doc.w, h: raw.doc.h },
      cssVars: raw.cssVars ?? {},
      shell: { standalone: true, raster: true },
      nodes: [
        { i: 0, p: -1, tag: 'img', cls: 'canvas-raster', x: 0, y: 0, w: raw.doc.w, h: raw.doc.h, img: raw.raster },
      ],
    };
  }

  const isMobile = raw.viewport ? raw.viewport.w < 700 : false;
  const mobile = SHELL.mobile;

  const WS = SHELL.workspace;
  const frameWidth = isMobile ? raw.viewport.w : SHELL.frameWidth;
  const wsX = isMobile ? 0 : SHELL.margin + N.width + 32;
  const wsY = isMobile ? 0 : SHELL.margin;
  const wsPadding = isMobile ? mobile.padding : WS.padding;
  const wsWidth = isMobile ? frameWidth : WS.width;
  const wsRadius = isMobile ? 0 : WS.radius;
  // Контейнер вёрстки: 160 при 1440, 16 при 390 — поэтому сдвиг разный.
  const webContainerLeft = isMobile ? mobile.padding : 160;
  const dx = wsX + wsPadding - webContainerLeft;
  const dy = wsY + wsPadding - minY;

  const contentHeight = maxY - minY;
  // Подложка всегда занимает экран целиком: короткие страницы (вход) не должны
  // оставлять внизу голый канвас.
  const minFrameHeight = isMobile ? mobile.minHeight : SHELL.minHeight;
  const minWsHeight = isMobile ? minFrameHeight : minFrameHeight - SHELL.margin * 2;
  const wsHeight = Math.max(wsPadding * 2 + contentHeight, minWsHeight);
  const frameHeight = isMobile ? Math.max(wsHeight, minFrameHeight) : wsY + wsHeight + SHELL.margin;

  // 3. Нав-рэйл: на мобильном его нет — там роль навигации играет сам контент.
  const navResult = isMobile
    ? { nodes: [], navIndex: -1 }
    : buildNavNodes(raw.route, 0);
  const navNodes = navResult.nodes;

  // 4. Workspace-подложка.
  const wsIndex = navNodes.length;
  // На мобильном подложка не заливается: фон — точечный канвас, а поверхности
  // несут сами карточки. На десктопе workspace закрывает канвас рабочей зоной.
  const wsNode = {
    i: wsIndex,
    tag: 'div',
    cls: 'workspace',
    x: wsX,
    y: wsY,
    w: wsWidth,
    h: wsHeight,
    ...(isMobile ? {} : { f: TOKENS.color.sunken, r: `${wsRadius}px` }),
    p: -1,
  };

  // 5. Контент: ремап родителей, сдвиг, стили.
  const indexMap = new Map();
  const contentNodes = [];
  for (const node of nodes) {
    if (dropped.has(node.i)) continue;
    const newIndex = wsIndex + 1 + contentNodes.length;
    indexMap.set(node.i, newIndex);
    const parentKept = node.p !== -1 && !dropped.has(node.p) && indexMap.has(node.p);
    const parent = parentKept ? indexMap.get(node.p) : wsIndex;
    const topLevel = parent === wsIndex;
    const moved = {
      ...node,
      x: +(node.x + dx).toFixed(2),
      y: +(node.y + dy).toFixed(2),
      p: parent,
    };
    // Ink-box текста живёт в тех же координатах документа — сдвигаем вместе с узлом.
    if (Array.isArray(node.tr)) {
      moved.tr = [+(node.tr[0] + dx).toFixed(2), +(node.tr[1] + dy).toFixed(2), node.tr[2], node.tr[3]];
    }
    const { node: styled, isPanel: panel } = restyle(moved, topLevel);
    if (panel) styled.sh = TOKENS.shadow.panel;
    contentNodes.push(styled);
  }

  const scene = {
    slug: raw.slug,
    name: raw.name,
    route: raw.route,
    mode: isMobile ? 'mobile' : 'desktop',
    doc: { w: frameWidth, h: frameHeight },
    bg: {
      type: 'dots',
      color: TOKENS.dot.background,
      dotColor: TOKENS.dot.color,
      tile: TOKENS.dot.tile,
      diameter: TOKENS.dot.diameter,
    },
    cssVars: raw.cssVars ?? {},
    shell: {
      nav: isMobile ? null : { x: NAV_X, y: NAV_Y, w: N.width, h: N.height },
      workspace: { x: wsX, y: wsY, w: wsWidth, h: wsHeight, padding: wsPadding },
      contentOrigin: { x: wsX + wsPadding, y: wsY + wsPadding },
      dropped: dropLog,
      source: { w: raw.doc.w, h: raw.doc.h, minX, minY, maxY },
    },
    nodes: [...navNodes, wsNode, ...contentNodes],
  };

  // Индексы пересобираем по порядку — рендерер опирается на index === i.
  scene.nodes.forEach((node, index) => {
    node.i = index;
  });
  return scene;
}

export { ICONS, NAV_ITEMS, activeIndexForRoute };
