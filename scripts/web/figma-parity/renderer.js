/* eslint-disable */
/**
 * AXIONA · Web parity builder — тело плагина Figma.
 *
 * build.mjs подставляет сверху `const SCENE = [...]` и `const CONFIG = {...}`,
 * поэтому здесь нет import/export: файл исполняется в sandbox плагина.
 *
 * Вход — сцены из extract.mjs: плоский список узлов с абсолютными координатами
 * (x/y считаются от левого верхнего угла документа страницы).
 */
/* global figma, PACKED_BASE64, DOT_TILE_BASE64, SVG_ASSETS, SCENE, CONFIG */

let SCENE = [];
let CONFIG = {};
let SVG_ASSETS = {};

const WEIGHTS = [400, 500, 600, 700, 800, 900];
const CLASSIC_STYLE = {
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black',
};

function styleNameForWeight(weight) {
  const numeric = Number(weight) || 400;
  let best = 400;
  let bestDelta = Infinity;
  for (const candidate of WEIGHTS) {
    const delta = Math.abs(candidate - numeric);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = candidate;
    }
  }
  return CLASSIC_STYLE[best];
}

function weightOfStyleName(style) {
  const normalized = String(style).toLowerCase().replace(/[\s_-]/g, '');
  const numeric = Number(normalized);
  if (!Number.isNaN(numeric)) return numeric;
  if (normalized.includes('extralight') || normalized.includes('ultralight')) return 200;
  if (normalized.includes('semibold') || normalized.includes('demibold')) return 600;
  if (normalized.includes('extrabold') || normalized.includes('ultrabold')) return 800;
  if (normalized.includes('thin') || normalized.includes('hairline')) return 100;
  if (normalized.includes('light')) return 300;
  if (normalized.includes('medium')) return 500;
  if (normalized.includes('black') || normalized.includes('heavy')) return 900;
  if (normalized.includes('bold')) return 700;
  if (normalized.includes('regular') || normalized.includes('normal') || normalized.includes('book')) {
    return 400;
  }
  return null;
}

let fontFamily = 'Inter';
const availableByFamily = new Map();

/** Geist — variable font: набор доступных стилей в Figma может отличаться, поэтому
 *  семейство и стили выбираем из listAvailableFontsAsync, а не хардкодом. */
async function resolveFonts() {
  const available = await figma.listAvailableFontsAsync();
  for (const entry of available) {
    const family = entry.fontName.family;
    if (!availableByFamily.has(family)) availableByFamily.set(family, new Set());
    availableByFamily.get(family).add(entry.fontName.style);
  }
  const preferred = CONFIG.fontFamily || 'Geist';
  const fallback = CONFIG.fontFallback || 'Inter';
  if (availableByFamily.has(preferred)) fontFamily = preferred;
  else if (availableByFamily.has(fallback)) fontFamily = fallback;
  else {
    fontFamily =
      [...availableByFamily.keys()].find((family) => availableByFamily.get(family).has('Regular')) ||
      [...availableByFamily.keys()][0] ||
      'Inter';
  }
}

// --------------------------------------------------------------------- цвета
function parseColor(css) {
  if (!css) return null;
  const value = String(css).trim();
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((c) => c + c).join('');
    const int = parseInt(hex.slice(0, 6), 16);
    const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return {
      r: ((int >> 16) & 255) / 255,
      g: ((int >> 8) & 255) / 255,
      b: (int & 255) / 255,
      a: alpha,
    };
  }
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(/[,/\s]+/).filter(Boolean).map(parseFloat);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return {
    r: parts[0] / 255,
    g: parts[1] / 255,
    b: parts[2] / 255,
    a: parts.length > 3 ? parts[3] : 1,
  };
}

function solidPaint(color) {
  return {
    type: 'SOLID',
    color: { r: color.r, g: color.g, b: color.b },
    opacity: color.a === undefined ? 1 : color.a,
  };
}

/** Разбор CSS linear-gradient в paint для Figma. */
function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/**
 * CSS-угол → gradientTransform Figma.
 * CSS: 0deg — снизу вверх, 90deg — слева направо, 180deg — сверху вниз.
 * Матрица переводит координаты объекта (0..1) в пространство градиента, где
 * t = x'. Проверено на 90deg (identity → t = x) и 180deg (t = y).
 */
function linearGradientTransform(angleDeg) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    [cos, sin, 0.5 - 0.5 * cos - 0.5 * sin],
    [-sin, cos, 0.5 + 0.5 * sin - 0.5 * cos],
  ];
}

function parseLinearGradient(css) {
  const match = /linear-gradient\(([\s\S]*)\)/.exec(String(css));
  if (!match) return null;
  const parts = splitTopLevel(match[1]).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  let angle = 180;
  const first = parts[0];
  if (/^-?[\d.]+deg$/.test(first)) {
    angle = parseFloat(first);
    parts.shift();
  } else if (/^to\s+/i.test(first)) {
    const direction = first.toLowerCase().replace(/^to\s+/, '');
    angle = direction === 'right' ? 90 : direction === 'left' ? 270 : direction === 'top' ? 0 : 180;
    parts.shift();
  }
  const stops = [];
  for (const part of parts) {
    const colorMatch = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})/.exec(part);
    if (!colorMatch) continue;
    const color = parseColor(colorMatch[1]);
    if (!color) continue;
    const positionMatch = /([\d.]+)%/.exec(part);
    stops.push({ color, position: positionMatch ? parseFloat(positionMatch[1]) / 100 : null });
  }
  if (stops.length < 2) return null;
  const lastIndex = stops.length - 1;
  stops.forEach((stop, index) => {
    if (stop.position === null) stop.position = index / lastIndex;
  });
  return {
    type: 'GRADIENT_LINEAR',
    gradientTransform: linearGradientTransform(angle),
    gradientStops: stops.map((stop) => ({
      position: Math.min(1, Math.max(0, stop.position)),
      color: { r: stop.color.r, g: stop.color.g, b: stop.color.b, a: stop.color.a },
    })),
  };
}

function fillPaintFor(row) {
  if (row.f) {
    const color = parseColor(row.f);
    if (color) return solidPaint(color);
  }
  if (row.g) return parseLinearGradient(row.g);
  return null;
}

function effectsFor(row) {
  if (!row.sh) return [];
  const out = [];
  const re = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?/g;
  let match;
  while ((match = re.exec(row.sh))) {
    const color = parseColor(match[1]);
    if (!color) continue;
    out.push({
      type: 'DROP_SHADOW',
      color: { r: color.r, g: color.g, b: color.b, a: color.a },
      offset: { x: parseFloat(match[2]), y: parseFloat(match[3]) },
      radius: parseFloat(match[4]),
      spread: match[5] ? parseFloat(match[5]) : 0,
      visible: true,
      blendMode: 'NORMAL',
    });
  }
  return out;
}

function radiusParts(value, boxSize) {
  if (!value) return null;
  if (String(value).includes('%')) {
    const percent = parseFloat(value);
    const half = (boxSize || 0) / 2;
    return { all: percent >= 50 ? half : half * (percent / 50) };
  }
  const parts = String(value).trim().split(/\s+/).map(parseFloat);
  const [a, b = a, c = a, d = b] = parts;
  if (a === b && b === c && c === d) return { all: a };
  return { tl: a, tr: b, br: c, bl: d };
}

// --------------------------------------------------------------------- шрифт
const fontCache = new Map();

async function ensureFont(weight) {
  const key = `${fontFamily}|${Math.round(Number(weight) || 400)}`;
  if (fontCache.has(key)) return fontCache.get(key);
  const styles = [...(availableByFamily.get(fontFamily) || new Set(['Regular']))];
  const target = Number(weight) || 400;
  let best = null;
  let bestDelta = Infinity;
  for (const style of styles) {
    const styleWeight = weightOfStyleName(style);
    const delta = styleWeight === null ? 500 : Math.abs(styleWeight - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = style;
    }
  }
  const candidates = [best, styleNameForWeight(target), 'Regular'].filter(Boolean);
  for (const style of candidates) {
    try {
      await figma.loadFontAsync({ family: fontFamily, style });
      const font = { family: fontFamily, style };
      fontCache.set(key, font);
      return font;
    } catch (error) {
      /* пробуем следующий стиль */
    }
  }
  for (const style of styles) {
    try {
      await figma.loadFontAsync({ family: fontFamily, style });
      const font = { family: fontFamily, style };
      fontCache.set(key, font);
      return font;
    } catch (error) {
      /* пробуем следующий */
    }
  }
  throw new Error(`не удалось загрузить шрифт ${fontFamily}`);
}

// ------------------------------------------------------------------ служебное
function layerName(row) {
  if (row.ck) return row.ck;
  const cls = row.cls ? `.${row.cls.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
  const text = row.tx ? ` «${row.tx.slice(0, 28)}»` : '';
  return `${row.tag}${cls}${text}`;
}

function hasPaint(row) {
  return Boolean(row.f || row.g || row.b || row.sh || row.r || row.clip || row.op);
}

function applyBoxPaint(node, row, boxWidth) {
  const fill = fillPaintFor(row);
  if (fill) {
    const fillHex = row.f ? normalizeHex(row.f) : null;
    node.fills = [fillHex ? bindColor(fill, fillHex, 'fill') : fill];
  } else if ('fills' in node) {
    node.fills = [];
  }

  if (row.b) {
    const sideNames = ['top', 'right', 'bottom', 'left'];
    const present = sideNames.filter((side) => row.b[side]);
    if (present.length) {
      const first = row.b[present[0]];
      const color = parseColor(first.color) || { r: 0, g: 0, b: 0, a: 1 };
      const strokeHex = normalizeHex(first.color);
      node.strokes = [strokeHex ? bindColor(solidPaint(color), strokeHex, 'stroke') : solidPaint(color)];
      node.strokeAlign = 'INSIDE';
      const uniform =
        present.length === 4 && present.every((side) => row.b[side].w === first.w);
      if (uniform) {
        node.strokeWeight = first.w;
      } else if ('strokeTopWeight' in node) {
        node.strokeTopWeight = row.b.top ? row.b.top.w : 0;
        node.strokeRightWeight = row.b.right ? row.b.right.w : 0;
        node.strokeBottomWeight = row.b.bottom ? row.b.bottom.w : 0;
        node.strokeLeftWeight = row.b.left ? row.b.left.w : 0;
      } else {
        node.strokeWeight = first.w;
      }
    }
  }

  const radius = radiusParts(row.r, Math.min(row.w || boxWidth || 0, row.h || 0));
  if (radius && 'cornerRadius' in node) {
    if (radius.all !== undefined) {
      node.cornerRadius = radius.all;
      bindRadius(node, radius.all, true);
    }
    else if ('topLeftRadius' in node) {
      node.topLeftRadius = radius.tl;
      node.topRightRadius = radius.tr;
      node.bottomRightRadius = radius.br;
      node.bottomLeftRadius = radius.bl;
    }
  }

  const effects = effectsFor(row);
  if (effects.length && 'effects' in node) node.effects = effects;
  if (row.op !== undefined && 'opacity' in node) node.opacity = row.op;
}

function textBoxFor(row) {
  const bw = row.bw || [0, 0, 0, 0];
  const pad = row.pad || [0, 0, 0, 0];
  // Многострочный блок — редактируемый параграф: ширина по самой длинной строке
  // (+2px слака), чтобы переносы совпали с браузером.
  if (row.lc > 1) {
    return {
      left: row.x,
      top: row.y,
      width: Math.max(row.lw || row.w, 4) + 2,
      singleLine: false,
      paragraph: true,
    };
  }
  // Однострочный текст позиционируем по ink-box и не ограничиваем шириной:
  // иначе Figma переносит последнее слово ровно на границе измеренной ширины.
  if (row.tr && row.tr[3] <= (row.fs || 16) * 1.75) {
    return { left: row.tr[0], top: row.tr[1], width: row.tr[2] + 3, singleLine: true };
  }
  let left = row.x + bw[3] + pad[3];
  let top = row.tr ? row.tr[1] : row.y + bw[0] + pad[0];
  let width = row.w - bw[3] - bw[1] - pad[3] - pad[1];
  if (!(width > 4)) {
    left = row.x;
    width = Math.max(row.w, 4);
  }
  return { left, top, width, singleLine: false };
}

function mapAlign(value) {
  switch (value) {
    case 'center':
      return 'CENTER';
    case 'right':
    case 'end':
      return 'RIGHT';
    case 'justify':
      return 'JUSTIFIED';
    default:
      return 'LEFT';
  }
}

async function makeTextNode(row) {
  const font = await ensureFont(row.fw);
  const node = figma.createText();
  node.name = layerName(row);
  node.fontName = font;
  node.characters = row.tx;
  node.fontSize = Math.max(1, row.fs || 16);
  if (row.lh && row.lh !== 'normal') {
    const lineHeight = parseFloat(row.lh);
    if (!Number.isNaN(lineHeight) && lineHeight > 0) {
      node.lineHeight = { unit: 'PIXELS', value: lineHeight };
    }
  } else {
    node.lineHeight = { unit: 'AUTO' };
  }
  if (row.ls && row.ls !== 'normal') {
    const letterSpacing = parseFloat(row.ls);
    if (!Number.isNaN(letterSpacing)) node.letterSpacing = { unit: 'PIXELS', value: letterSpacing };
  }
  if (row.tt === 'uppercase') node.textCase = 'UPPER';
  node.textAlignHorizontal = mapAlign(row.al);
  const textColor = parseColor(row.c) || { r: 0, g: 0, b: 0, a: 1 };
  const textHex = normalizeHex(row.c);
  node.fills = [textHex ? bindColor(solidPaint(textColor), textHex, 'text') : solidPaint(textColor)];
  // ключ должен совпадать с тем, что считает createTextStyles
  const lineHeightKey = row.lh && row.lh !== 'normal' ? Math.round(parseFloat(row.lh)) : 'auto';
  const letterSpacingKey = row.ls && row.ls !== 'normal' ? parseFloat(row.ls) : 0;
  createdTexts.push({
    node,
    key: `${Math.round(row.fs || 16)}|${Math.round(Number(row.fw) || 400)}|${lineHeightKey}|${letterSpacingKey}`,
  });

  const box = textBoxFor(row);
  node.x = box.left;
  node.y = box.top;
  if (box.singleLine) {
    // Ширина по содержимому: строка не ломается, позиция задана точно.
    node.textAutoResize = 'WIDTH_AND_HEIGHT';
  } else {
    node.resize(Math.max(4, box.width), Math.max(1, row.h || (row.tr ? row.tr[3] : row.fs || 16)));
    node.textAutoResize = 'HEIGHT';
  }
  return node;
}

// ------------------------------------------------------------ обход сцены
function rowsByParent(scene) {
  const children = new Map();
  scene.nodes.forEach((node, index) => {
    if (node.p === -1) return;
    if (!children.has(node.p)) children.set(node.p, []);
    children.get(node.p).push(index);
  });
  return children;
}

function svgNodeFor(row) {
  const svg = row.svg || (row.svgKey && SVG_ASSETS ? SVG_ASSETS[row.svgKey] : null);
  if (!svg) return null;
  try {
    const node = figma.createNodeFromSvg(svg);
    node.name = layerName(row);
    const strokeColor = row.svgStroke ? parseColor(row.svgStroke) : null;
    const fillColor = row.svgFill ? parseColor(row.svgFill) : null;
    if ((strokeColor || fillColor) && node.findAll) {
      const shapes = node.findAll(
        (child) =>
          child.type === 'VECTOR' ||
          child.type === 'ELLIPSE' ||
          child.type === 'RECTANGLE' ||
          child.type === 'POLYGON' ||
          child.type === 'STAR',
      );
      for (const shape of shapes) {
        if (strokeColor && 'strokes' in shape) {
          shape.strokes = [solidPaint(strokeColor)];
        }
        if (fillColor && 'fills' in shape) {
          shape.fills = [solidPaint(fillColor)];
        }
      }
    }
    return node;
  } catch (error) {
    return null;
  }
}

/**
 * Рисует один узел и его детей. Координаты сцены абсолютные, поэтому внутрь
 * контейнера кладём `row.x - ox`, где ox/oy — абсолютный левый верх контейнера.
 */
async function renderNode(scene, index, parent, ox, oy, ctx) {
  const row = scene.nodes[index];
  // Любой узел с ck — это инстанс мастера из библиотеки (в т.ч. вложенный).
  if (row.ck) {
    await placeInstance(scene, index, parent, ox, oy, ctx);
    return;
  }
  const kids = ctx.children.get(index) || [];

  if (row.img) {
    const comma = row.img.indexOf(',');
    const base64 = comma !== -1 ? row.img.slice(comma + 1) : row.img;
    try {
      const image = figma.createImage(base64ToBytes(base64));
      const rect = figma.createRectangle();
      rect.name = layerName(row);
      parent.appendChild(rect);
      rect.resize(Math.max(1, row.w), Math.max(1, row.h));
      rect.x = row.x - ox;
      rect.y = row.y - oy;
      rect.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
    } catch (error) {
      /* картинка не встроилась — пропускаем */
    }
    return;
  }

  if (row.svg || row.svgKey) {
    const node = svgNodeFor(row);
    if (node) {
      parent.appendChild(node);
      node.x = row.x - ox;
      node.y = row.y - oy;
      if (Math.abs(node.width - row.w) > 0.5 || Math.abs(node.height - row.h) > 0.5) {
        node.resizable = true;
        node.resize(Math.max(1, row.w), Math.max(1, row.h));
      }
    }
    return;
  }

  const text = Boolean(row.tx);

  if (kids.length === 0 && !text) {
    const rect = figma.createRectangle();
    rect.name = layerName(row);
    parent.appendChild(rect);
    rect.resize(Math.max(0.5, row.w), Math.max(0.5, row.h));
    rect.x = row.x - ox;
    rect.y = row.y - oy;
    applyBoxPaint(rect, row, row.w);
    return;
  }

  if (kids.length === 0 && text && !hasPaint(row)) {
    const node = await makeTextNode(row);
    parent.appendChild(node);
    const box = textBoxFor(row);
    node.x = box.left - ox;
    node.y = box.top - oy;
    return;
  }

  const frame = figma.createFrame();
  frame.name = layerName(row);
  parent.appendChild(frame);
  frame.resize(Math.max(1, row.w), Math.max(1, row.h));
  frame.x = row.x - ox;
  frame.y = row.y - oy;
  frame.clipsContent = Boolean(row.clip);
  applyBoxPaint(frame, row, row.w);

  if (text) {
    const textNode = await makeTextNode(row);
    frame.appendChild(textNode);
    const box = textBoxFor(row);
    textNode.x = box.left - row.x;
    textNode.y = box.top - row.y;
  }
  for (const child of kids) await renderNode(scene, child, frame, row.x, row.y, ctx);
}

// -------------------------------------------------------------- компоненты
function pathResolve(root, path) {
  let node = root;
  for (const step of path) {
    if (!node || !node.children || !node.children[step]) return null;
    node = node.children[step];
  }
  return node;
}

/** Строит мастер: поддерево с координатами относительно самого компонента. */
async function buildMasterContent(comp, scene, rootIdx, ctx) {
  const rootRow = scene.nodes[rootIdx];
  const created = [];

  const walk = async (index, path, parent, parentAbsX, parentAbsY) => {
    const row = scene.nodes[index];
    const kids = ctx.children.get(index) || [];
    const text = Boolean(row.tx);
    let node = null;

    if (row.svg || row.svgKey) {
      node = svgNodeFor(row);
      if (node) {
        parent.appendChild(node);
        node.x = row.x - parentAbsX;
        node.y = row.y - parentAbsY;
        if (Math.abs(node.width - row.w) > 0.5 || Math.abs(node.height - row.h) > 0.5) {
          node.resizable = true;
          node.resize(Math.max(1, row.w), Math.max(1, row.h));
        }
      }
      if (node) created.push({ path, node, rowIdx: index });
      return;
    }

    if (kids.length === 0 && !text) {
      node = figma.createRectangle();
      parent.appendChild(node);
      node.resize(Math.max(0.5, row.w), Math.max(0.5, row.h));
      node.x = row.x - parentAbsX;
      node.y = row.y - parentAbsY;
      applyBoxPaint(node, row, row.w);
    } else if (kids.length === 0 && text && !hasPaint(row)) {
      node = await makeTextNode(row);
      parent.appendChild(node);
      const box = textBoxFor(row);
      node.x = box.left - parentAbsX;
      node.y = box.top - parentAbsY;
    } else {
      node = figma.createFrame();
      parent.appendChild(node);
      node.resize(Math.max(1, row.w), Math.max(1, row.h));
      node.x = row.x - parentAbsX;
      node.y = row.y - parentAbsY;
      node.clipsContent = Boolean(row.clip);
      applyBoxPaint(node, row, row.w);
      if (text) {
        const textNode = await makeTextNode(row);
        node.appendChild(textNode);
        const box = textBoxFor(row);
        textNode.x = box.left - row.x;
        textNode.y = box.top - row.y;
      }
      for (let i = 0; i < kids.length; i += 1) {
        await walk(kids[i], [...path, i], node, row.x, row.y);
      }
    }
    if (node) created.push({ path, node, rowIdx: index });
  };

  const topKids = ctx.children.get(rootIdx) || [];
  for (let i = 0; i < topKids.length; i += 1) {
    await walk(topKids[i], [i], comp, rootRow.x, rootRow.y);
  }
  return created;
}

async function ensureMaster(scene, rootIdx, ctx) {
  const row = scene.nodes[rootIdx];
  const group = ctx.components.get(row.ck) || { masters: new Map() };
  ctx.components.set(row.ck, group);
  if (group.masters.has(row.sig)) return group.masters.get(row.sig);

  const comp = figma.createComponent();
  comp.name = `${row.ck}${group.masters.size ? ` / v${group.masters.size + 1}` : ''}`;
  comp.resize(Math.max(1, row.w), Math.max(1, row.h));
  comp.clipsContent = Boolean(row.clip);
  applyBoxPaint(comp, row, row.w);
  ctx.compPage.appendChild(comp);

  const created = await buildMasterContent(comp, scene, rootIdx, ctx);
  // Сцена мастера нужна, чтобы брать стили из его собственных строк, а не из
  // сцены того экрана, где сейчас ставится инстанс.
  const master = { comp, rootIdx, created, scene };
  group.masters.set(row.sig, master);
  return master;
}

function colorEquals(paints, cssColor) {
  const color = parseColor(cssColor);
  if (!color || !paints || !paints.length) return false;
  const paint = paints[0];
  if (paint.type !== 'SOLID') return false;
  return (
    Math.abs(paint.color.r - color.r) < 0.004 &&
    Math.abs(paint.color.g - color.g) < 0.004 &&
    Math.abs(paint.color.b - color.b) < 0.004
  );
}

function applyOverrides(instance, master, currentRow) {
  const rootRow = currentRow || master.scene.nodes[master.rootIdx];
  const masterScene = master.scene;
  if (rootRow.f) {
    const paint = fillPaintFor(rootRow);
    if (paint && !colorEquals(instance.fills, rootRow.f)) instance.fills = [paint];
  }
  for (const { path, rowIdx } of master.created) {
    const row = masterScene.nodes[rowIdx];
    const target = pathResolve(instance, path);
    if (!target) continue;
    try {
      if (row.tx && target.type === 'TEXT' && target.characters !== row.tx) {
        target.characters = row.tx;
      }
      if (row.c && target.type === 'TEXT' && !colorEquals(target.fills, row.c)) {
        target.fills = [solidPaint(parseColor(row.c) || { r: 0, g: 0, b: 0, a: 1 })];
      }
      if (row.f && target.type === 'RECTANGLE' && !colorEquals(target.fills, row.f)) {
        target.fills = [fillPaintFor(row)];
      }
      if (Math.abs((target.width || 0) - row.w) > 0.5) {
        target.resize(Math.max(1, row.w), Math.max(1, target.height));
        if (target.type === 'TEXT') target.textAutoResize = 'HEIGHT';
      }
    } catch (error) {
      /* переопределение не критично: остаётся значение мастера */
    }
  }
}

async function placeInstance(scene, index, parent, ox, oy, ctx) {
  const row = scene.nodes[index];
  const group = ctx.components.get(row.ck);
  const master = group && group.masters.get(row.sig);
  if (!master) {
    const tempCtx = { ...ctx, components: new Map() };
    await renderNode(scene, index, parent, ox, oy, { ...tempCtx, children: ctx.children });
    return;
  }
  const instance = master.comp.createInstance();
  parent.appendChild(instance);
  instance.x = row.x - ox;
  instance.y = row.y - oy;
  applyOverrides(instance, master, row);
}

// ------------------------------------------------------------- переменные
/**
 * Настоящие Figma Variables: цвета и радиусы. Экраны ссылаются на них, поэтому
 * правка переменной меняет все 21 макет сразу. В файле таких переменных не было
 * (страница Color — просто подписи), поэтому коллекцию создаём мы.
 */
const COLOR_ROLES = {
  '#fefefe': 'bg/page',
  '#ffffff': 'bg/surface',
  '#f8fafc': 'bg/muted',
  '#f9fafb': 'bg/sunken',
  '#e2e8f0': 'border/default',
  '#4f46e5': 'accent',
  '#080b10': 'text/ink',
  '#595959': 'text/glyph',
};

let variablesCollection = null;
const colorVariables = new Map();
const floatVariables = new Map();
const boundCount = { colors: 0, radii: 0, textStyles: 0 };
const createdTexts = [];

function normalizeHex(css) {
  const color = parseColor(css);
  if (!color) return null;
  const toHex = (value) => Math.round(value * 255).toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function getCollection() {
  if (variablesCollection) return variablesCollection;
  try {
    variablesCollection = figma.variables.createVariableCollection('AXIONA / Beta 1');
    const modeId = variablesCollection.modes[0].modeId;
    try {
      variablesCollection.renameMode(modeId, 'Light');
    } catch (error) {
      /* имя режима — косметика */
    }
  } catch (error) {
    variablesCollection = null;
  }
  return variablesCollection;
}

function colorVariable(hex, category) {
  if (!hex || typeof figma.variables === 'undefined') return null;
  const key = `${category}|${hex}`;
  if (colorVariables.has(key)) return colorVariables.get(key);
  const collection = getCollection();
  if (!collection) return null;
  const role = COLOR_ROLES[hex];
  const name = role ? `color/${role}` : `color/${category}/${hex.slice(1)}`;
  let variable = null;
  try {
    variable = figma.variables.createVariable(name, collection, 'COLOR');
    const color = parseColor(hex) || { r: 0, g: 0, b: 0, a: 1 };
    variable.setValueForMode(collection.modes[0].modeId, {
      r: color.r,
      g: color.g,
      b: color.b,
      a: color.a,
    });
  } catch (error) {
    variable = null;
  }
  colorVariables.set(key, variable);
  return variable;
}

function bindColor(paint, hex, category) {
  const variable = colorVariable(hex, category);
  if (!variable || typeof figma.variables.setBoundVariableForPaint !== 'function') return paint;
  try {
    boundCount.colors += 1;
    return figma.variables.setBoundVariableForPaint(paint, 'color', variable);
  } catch (error) {
    return paint;
  }
}

function radiusVariable(value) {
  const rounded = Math.round(value);
  if (floatVariables.has(rounded)) return floatVariables.get(rounded);
  const collection = getCollection();
  if (!collection) return null;
  let variable = null;
  try {
    variable = figma.variables.createVariable(`radius/${rounded}`, collection, 'FLOAT');
    variable.setValueForMode(collection.modes[0].modeId, rounded);
  } catch (error) {
    variable = null;
  }
  floatVariables.set(rounded, variable);
  return variable;
}

function bindRadius(node, value, uniform) {
  if (!uniform || !(value > 0) || typeof node.setBoundVariable !== 'function') return;
  const variable = radiusVariable(value);
  if (!variable) return;
  try {
    node.setBoundVariable('cornerRadius', variable);
    boundCount.radii += 1;
  } catch (error) {
    /* не все узлы поддерживают привязку радиуса */
  }
}

// ------------------------------------------------------- точечный канвас
function base64ToBytes(base64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Map();
  for (let index = 0; index < alphabet.length; index += 1) lookup.set(alphabet[index], index);
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let bits = 0;
  let value = 0;
  let offset = 0;
  for (const char of clean) {
    const index = lookup.get(char);
    if (index === undefined) continue;
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset] = (value >> bits) & 0xff;
      offset += 1;
    }
  }
  return bytes.subarray(0, offset);
}

/**
 * Распаковывает данные сцен встроенным inflate (Figma не даёт DecompressionStream).
 */
async function unpackScenes() {
  const bytes = base64ToBytes(PACKED_BASE64);
  const inflated = inflateRaw(bytes);
  const payload = JSON.parse(asciiFromBytes(inflated));
  SCENE = payload.scenes || [];
  CONFIG = payload.config || {};
  SVG_ASSETS = payload.svg || {};
  return SCENE.length;
}

let dotTilePaint = null;

function dotPaint(scene) {
  if (!scene.bg || scene.bg.type !== 'dots') return null;
  if (!dotTilePaint) {
    try {
      const image = figma.createImage(base64ToBytes(DOT_TILE_BASE64));
      const scale = CONFIG.dotTile ? CONFIG.dotTile.scale : 4;
      dotTilePaint = {
        type: 'IMAGE',
        imageHash: image.hash,
        scaleMode: 'TILE',
        scalingFactor: 1 / scale,
      };
    } catch (error) {
      return null;
    }
  }
  return dotTilePaint;
}

// ------------------------------------------------------------------ страницы
/**
 * Переключение текущей страницы. С `documentAccess: dynamic-page` присваивать
 * figma.currentPage нельзя — Figma требует setCurrentPageAsync (обычный сеттер
 * падает с «Cannot call with documentAccess: dynamic-page»).
 */
async function setPage(page) {
  if (typeof figma.setCurrentPageAsync === 'function') {
    await figma.setCurrentPageAsync(page);
    return;
  }
  figma.currentPage = page;
}

async function resetPage(name) {
  let page = figma.root.children.find((node) => node.type === 'PAGE' && node.name === name);
  if (!page) {
    page = figma.createPage();
    page.name = name;
  }
  for (const child of [...page.children]) child.remove();
  return page;
}

function createPaintStyles(tokens) {
  const created = [];
  for (const [name, value] of Object.entries(tokens || {})) {
    const color = parseColor(value);
    if (!color) continue;
    const style = figma.createPaintStyle();
    style.name = `color/${name.replace(/^--/, '')}`;
    style.paints = [solidPaint(color)];
    created.push(style.name);
  }
  return created;
}

async function createTextStyles(scenes) {
  const seen = new Map();
  for (const scene of scenes) {
    for (const row of scene.nodes) {
      if (!row.tx || !row.fs) continue;
      const lineHeight = row.lh && row.lh !== 'normal' ? Math.round(parseFloat(row.lh)) : 'auto';
      const letterSpacing = row.ls && row.ls !== 'normal' ? parseFloat(row.ls) : 0;
      const weight = Math.round(Number(row.fw) || 400);
      seen.set(`${row.fs}|${weight}|${lineHeight}|${letterSpacing}`, {
        size: row.fs,
        weight,
        lineHeight,
        letterSpacing,
      });
    }
  }
  const created = [];
  const stylesByKey = new Map();
  for (const spec of seen.values()) {
    const font = await ensureFont(spec.weight);
    const textStyle = figma.createTextStyle();
    textStyle.name = `text/${spec.size}/${font.style}`;
    textStyle.fontName = font;
    textStyle.fontSize = Number(spec.size);
    textStyle.lineHeight =
      spec.lineHeight === 'auto'
        ? { unit: 'AUTO' }
        : { unit: 'PIXELS', value: Number(spec.lineHeight) };
    if (Number(spec.letterSpacing)) {
      textStyle.letterSpacing = { unit: 'PIXELS', value: Number(spec.letterSpacing) };
    }
    created.push(textStyle.name);
    stylesByKey.set(`${spec.size}|${spec.weight}|${spec.lineHeight}|${spec.letterSpacing}`, {
      id: textStyle.id,
      name: textStyle.name,
    });
  }
  return { created, stylesByKey };
}

/** Назначает текстовым узлам стили (после того как стили созданы). */
function assignTextStyles(stylesByKey) {
  for (const { node, key } of createdTexts) {
    const style = stylesByKey.get(key);
    if (!style) continue;
    try {
      node.textStyleId = style.id;
      boundCount.textStyles += 1;
    } catch (error) {
      /* не критично: останутся локальные свойства */
    }
  }
}

/** Группирует мастера одного ключа в настоящий Component Set с вариантами. */
function combineVariants(components, parentPage) {
  let sets = 0;
  for (const [key, group] of components) {
    const comps = [...group.masters.values()].map((master) => master.comp);
    if (comps.length < 2) continue;
    try {
      comps.forEach((comp, index) => {
        comp.name = `Variant=${index + 1}`;
      });
      const set = figma.combineAsVariants(comps, parentPage);
      set.name = key;
      sets += 1;
    } catch (error) {
      /* останутся отдельными компонентами */
    }
  }
  return sets;
}

// -------------------------------------------------------------------- main
async function main() {
  figma.notify('Собираю макеты AXIONA Beta-1…', { timeout: 4000 });
  const sceneCount = await unpackScenes();
  if (!sceneCount) throw new Error('в бандле нет сцен — пересобери build.mjs');
  await figma.loadAllPagesAsync();
  await resolveFonts();

  const usedWeights = new Set();
  for (const scene of SCENE) {
    for (const row of scene.nodes) if (row.tx) usedWeights.add(Number(row.fw) || 400);
  }
  for (const weight of usedWeights) await ensureFont(weight);

  const parityPage = await resetPage(CONFIG.pages.parity);
  const mobilePage = await resetPage(CONFIG.pages.mobile || CONFIG.pages.parity);
  const compPage = await resetPage(CONFIG.pages.components);
  const components = new Map();
  const sceneContexts = new Map();
  for (const scene of SCENE) {
    sceneContexts.set(scene.slug, { children: rowsByParent(scene), components, compPage });
  }

  const failures = [];

  // Проход 1 — мастера компонентов.
  await setPage(compPage);
  for (const scene of SCENE) {
    const ctx = sceneContexts.get(scene.slug);
    for (let index = 0; index < scene.nodes.length; index += 1) {
      if (!scene.nodes[index].ck) continue;
      try {
        await ensureMaster(scene, index, ctx);
      } catch (error) {
        failures.push({
          where: `мастер ${scene.slug}/${scene.nodes[index].ck}`,
          message: String(error && error.message ? error.message : error),
        });
      }
    }
  }

  // Проход 2 — экраны: десктоп на одной странице, мобильный на другой.
  const GAP = 160;
  const cursors = new Map();
  const frames = [];
  for (const scene of SCENE) {
    const mode = scene.mode === 'mobile' ? 'mobile' : 'desktop';
    const page = mode === 'mobile' ? mobilePage : parityPage;
    await setPage(page);
    const offsetX = cursors.get(mode) || 0;
    cursors.set(mode, offsetX + scene.doc.w + GAP);

    // Экран собираем в try: упавший не должен уносить остальные.
    try {
    const frame = figma.createFrame();
    const number = /^\d+/.exec(scene.slug);
    frame.name = `${number ? `${number[0]} · ` : ''}${scene.name}${mode === 'mobile' ? ' · 390' : ''} — ${scene.route}`;
    frame.resize(scene.doc.w, scene.doc.h);
    frame.x = offsetX;
    frame.y = 0;
    const dots = dotPaint(scene);
    frame.fills = dots
      ? [dots]
      : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
    frame.clipsContent = true;
    page.appendChild(frame);

    const ctx = sceneContexts.get(scene.slug);
    for (let index = 0; index < scene.nodes.length; index += 1) {
      const row = scene.nodes[index];
      if (row.p !== -1) continue;
      await renderNode(scene, index, frame, 0, 0, ctx);
    }
    frames.push(frame);
    } catch (error) {
      failures.push({
        where: `экран ${scene.slug}`,
        message: String(error && error.message ? error.message : error),
      });
    }
  }

  // Мастера — сеткой на странице компонентов.
  let compX = 0;
  let compY = 0;
  let rowHeight = 0;
  for (const group of components.values()) {
    for (const master of group.masters.values()) {
      if (compX > 5200) {
        compX = 0;
        compY += rowHeight + 140;
        rowHeight = 0;
      }
      master.comp.x = compX;
      master.comp.y = compY;
      compX += master.comp.width + 96;
      rowHeight = Math.max(rowHeight, master.comp.height);
    }
  }

  // Ставим три страницы в начало списка, чтобы они были видны без прокрутки
  // табов: файл большой, новые страницы иначе уезжают в самый конец.
  const created = [parityPage, mobilePage, compPage];
  created.forEach((page, index) => {
    try {
      figma.root.insertChild(index, page);
    } catch (error) {
      /* если API не дал — останется в конце */
    }
  });

  const paintStyles = createPaintStyles(SCENE[0] && SCENE[0].cssVars);
  const textStylesResult = await createTextStyles(SCENE);
  const textStyles = textStylesResult.created;
  assignTextStyles(textStylesResult.stylesByKey);

  await setPage(compPage);
  const variantSets = combineVariants(components, compPage);

  await setPage(parityPage);
  if (frames.length) figma.viewport.scrollAndZoomIntoView(frames);
  const masterCount = [...components.values()].reduce((sum, group) => sum + group.masters.size, 0);
  const desktopCount = SCENE.filter((scene) => scene.mode !== 'mobile').length;
  const mobileCount = SCENE.length - desktopCount;

  if (failures.length) {
    const lines = failures.slice(0, 40).map((item) => `• ${item.where}: ${item.message}`);
    if (failures.length > 40) lines.push(`… и ещё ${failures.length - 40}`);
    await writeMessagePage(
      'Beta-1 · ERROR',
      `Собрано частично: ${desktopCount} десктоп + ${mobileCount} мобильных, ошибок: ${failures.length}`,
      lines,
      true,
    );
    figma.notify(`Собрано частично, ошибок: ${failures.length} — см. страницу Beta-1 · ERROR`, {
      error: true,
      timeout: 20000,
    });
    figma.closePlugin();
    return;
  }

  const collection = getCollection();
  const variableCount = collection ? colorVariables.size + floatVariables.size : 0;
  figma.notify(
    `Готово: ${desktopCount} десктоп + ${mobileCount} мобильных, ${masterCount} компонентов (${variantSets} наборов), ${variableCount} переменных, ${textStyles.length} текстовых стилей; привязано: ${boundCount.colors} заливок, ${boundCount.radii} радиусов, ${boundCount.textStyles} текстов`,
    { timeout: 15000 },
  );
  figma.closePlugin();
}

/**
 * Любая ошибка должна быть видна в файле, а не только в тосте (его легко
 * пропустить): создаём страницу «Beta-1 · ERROR» с текстом ошибки и стеком.
 */
/**
 * Рисует служебную страницу с сообщением. Используется и для фатальных ошибок,
 * и для списка упавших экранов (когда остальное собралось).
 */
async function writeMessagePage(name, title, lines, isError) {
  let page = figma.root.children.find((node) => node.type === 'PAGE' && node.name === name);
  if (!page) {
    page = figma.createPage();
    page.name = name;
  }
  for (const child of [...page.children]) child.remove();
  await setPage(page);
  const font = await ensureFont(400);
  const frame = figma.createFrame();
  frame.name = title;
  frame.resize(1100, 160);
  frame.fills = [
    isError
      ? { type: 'SOLID', color: { r: 1, g: 0.95, b: 0.95 }, opacity: 1 }
      : { type: 'SOLID', color: { r: 0.96, g: 0.98, b: 1 }, opacity: 1 },
  ];
  frame.clipsContent = false;
  page.appendChild(frame);

  const text = figma.createText();
  text.fontName = font;
  text.characters = [title, '', ...lines].join('\n');
  text.fontSize = 12;
  text.fills = [
    { type: 'SOLID', color: isError ? { r: 0.6, g: 0.05, b: 0.05 } : { r: 0.07, g: 0.13, b: 0.22 }, opacity: 1 },
  ];
  frame.appendChild(text);
  text.x = 24;
  text.y = 24;
  text.resize(Math.max(400, frame.width - 48), 20);
  text.textAutoResize = 'HEIGHT';
  frame.resize(1100, Math.max(120, text.height + 48));

  try {
    figma.root.insertChild(0, page);
  } catch (error) {
    /* порядок страниц — не критично */
  }
  figma.viewport.scrollAndZoomIntoView([frame]);
  return page;
}

async function reportFailure(error) {
  const message = String(error && error.message ? error.message : error);
  const stack = String(error && error.stack ? error.stack : '').slice(0, 3500);
  try {
    await writeMessagePage(
      'Beta-1 · ERROR',
      'Ошибка сборки макетов',
      [message, '', 'Стек:', stack],
      true,
    );
    figma.notify(`Ошибка сборки: ${message.slice(0, 160)}`, { error: true, timeout: 20000 });
  } catch (nesting) {
    figma.notify(`Ошибка сборки: ${message.slice(0, 160)}`, { error: true, timeout: 20000 });
  }
  figma.closePlugin();
}

main().catch((error) => {
  console.error(error);
  reportFailure(error);
});
