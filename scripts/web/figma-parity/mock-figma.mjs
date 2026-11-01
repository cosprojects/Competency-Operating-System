#!/usr/bin/env node
/**
 * Figma parity — сухой прогон плагина без Figma.
 *
 * Подменяет глобальный объект `figma` минимальной реализацией Plugin API и
 * прогоняет сгенерированный plugin/code.js: ловит ошибки API, проверяет
 * порядок вызовов (шрифт → characters, fontName → characters) и считает,
 * сколько узлов/компонентов/инстансов реально создаётся.
 *
 * Usage: node scripts/web/figma-parity/mock-figma.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

class MockNode {
  constructor(type) {
    this.type = type;
    this.id = `${type}:${MockNode.counter++}`;
    this.name = '';
    this.children = [];
    this.parent = null;
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.fills = [];
    this.strokes = [];
    this.effects = [];
    this.opacity = 1;
    this.clipsContent = false;
    this.cornerRadius = 0;
    this.strokeWeight = 0;
    this.strokeAlign = 'INSIDE';
    this.characters = '';
    this.fontName = null;
    this.fontSize = 0;
    this.lineHeight = { unit: 'AUTO' };
    this.letterSpacing = { unit: 'PERCENT', value: 0 };
    this.textCase = 'ORIGINAL';
    this.textAlignHorizontal = 'LEFT';
    this.textAutoResize = 'NONE';
    this.resizable = true;
    this._overrides = 0;
    MockNode.registry.push(this);
  }

  get absoluteX() {
    return (this.parent ? this.parent.absoluteX : 0) + this.x;
  }

  appendChild(node) {
    if (node.parent) node.parent.children = node.parent.children.filter((child) => child !== node);
    node.parent = this;
    this.children.push(node);
    if (this.type === 'INSTANCE') node._overrides += 1;
  }

  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  resize(width, height) {
    if (this.type === 'TEXT' && !this.fontName) {
      throw new Error(`TEXT ${this.id}: resize до fontName`);
    }
    if (!(width > 0) || !(height > 0)) {
      throw new Error(`${this.type} ${this.id}: некорректный resize ${width}×${height}`);
    }
    this.width = width;
    this.height = height;
  }

  setBoundVariable(field, variable) {
    this.boundVariables = { ...(this.boundVariables || {}), [field]: variable && variable.id };
  }

  findAll(predicate = () => true) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (predicate(child)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  findOne(predicate) {
    return this.findAll(predicate)[0] || null;
  }
}

MockNode.counter = 1;
MockNode.registry = [];

function assertCanWriteCharacters(node) {
  if (!node.fontName) throw new Error(`TEXT ${node.id}: characters до fontName`);
  const loaded = MockNode.loadedFonts.has(`${node.fontName.family}|${node.fontName.style}`);
  if (!loaded) throw new Error(`TEXT ${node.id}: шрифт ${node.fontName.family} ${node.fontName.style} не загружен`);
}

const fontStylesFor = (family) =>
  family === 'Geist'
    ? ['Regular', 'Medium', 'Semi Bold', 'Bold', 'Extra Bold', 'Black']
    : ['Regular', 'Medium', 'Semi Bold', 'Bold', 'Extra Bold', 'Black'];

MockNode.loadedFonts = new Set();
MockNode.variables = [];
MockNode.variableCollections = [];
MockNode.variantSets = 0;

const pages = [];
const root = { type: 'DOCUMENT', children: pages };

const makeNode = (type) => new MockNode(type);

const svgSize = (svg) => {
  const width = /width="([\d.]+)"/.exec(svg);
  const height = /height="([\d.]+)"/.exec(svg);
  return { width: width ? parseFloat(width[1]) : 24, height: height ? parseFloat(height[1]) : 24 };
};

let currentPageNode = null;

const figma = {
  root,
  viewport: { scrollAndZoomIntoView() {} },
  // Как в dynamic-page: прямой сеттер запрещён, только setCurrentPageAsync.
  async setCurrentPageAsync(page) {
    if (!page) throw new Error('setCurrentPageAsync: нет страницы');
    currentPageNode = page;
  },
  createPage() {
    const page = makeNode('PAGE');
    pages.push(page);
    return page;
  },
  createFrame() {
    return makeNode('FRAME');
  },
  createRectangle() {
    return makeNode('RECTANGLE');
  },
  createComponent() {
    return makeNode('COMPONENT');
  },
  createImage() {
    return { hash: `img:${MockNode.counter++}` };
  },
  combineAsVariants(comps, parent) {
    if (!Array.isArray(comps) || !comps.length) throw new Error('combineAsVariants: пусто');
    const set = makeNode('COMPONENT_SET');
    if (parent) {
      set.parent = parent;
      parent.children.push(set);
    }
    for (const comp of comps) {
      if (comp.parent) comp.parent.children = comp.parent.children.filter((c) => c !== comp);
      comp.parent = set;
      set.children.push(comp);
    }
    MockNode.variantSets += 1;
    return set;
  },
  variables: {
    createVariableCollection(name) {
      const collection = {
        type: 'VARIABLE_COLLECTION',
        id: `collection:${MockNode.counter++}`,
        name,
        modes: [{ modeId: `mode:${MockNode.counter++}`, name: 'Mode 1' }],
        renameMode: () => {},
      };
      MockNode.variableCollections.push(collection);
      return collection;
    },
    createVariable(name, collection, type) {
      if (!collection) throw new Error('createVariable: нет коллекции');
      const variable = {
        type: 'VARIABLE',
        id: `variable:${MockNode.counter++}`,
        name,
        resolvedType: type,
        values: {},
        setValueForMode(modeId, value) {
          this.values[modeId] = value;
        },
      };
      MockNode.variables.push(variable);
      return variable;
    },
    setBoundVariableForPaint(paint, field, variable) {
      return { ...paint, boundVariables: { ...(paint.boundVariables || {}), [field]: { type: 'VARIABLE_ALIAS', id: variable.id } } };
    },
  },
  createPaintStyle() {
    const style = { type: 'PAINT', name: '', paints: [] };
    MockNode.registry.push(style);
    return style;
  },
  createTextStyle() {
    const style = {
      type: 'TEXT_STYLE',
      id: `textstyle:${MockNode.counter++}`,
      name: '',
      fontName: null,
      fontSize: 0,
      lineHeight: { unit: 'AUTO' },
      letterSpacing: null,
    };
    MockNode.registry.push(style);
    return style;
  },
  createNodeFromSvg(svg) {
    const frame = makeNode('FRAME');
    const { width, height } = svgSize(svg);
    frame.width = width;
    frame.height = height;
    const vector = makeNode('VECTOR');
    vector.parent = frame;
    frame.children.push(vector);
    return frame;
  },
  createText() {
    const text = makeNode('TEXT');
    Object.defineProperty(text, 'characters', {
      get: () => text._characters ?? '',
      set: (value) => {
        assertCanWriteCharacters(text);
        text._characters = value;
      },
    });
    return text;
  },
  async loadFontAsync(font) {
    if (!fontStylesFor(font.family).includes(font.style)) {
      throw new Error(`нет шрифта ${font.family} ${font.style}`);
    }
    MockNode.loadedFonts.add(`${font.family}|${font.style}`);
  },
  async loadAllPagesAsync() {
    return pages;
  },
  async listAvailableFontsAsync() {
    return ['Geist', 'Inter'].flatMap((family) =>
      fontStylesFor(family).map((style) => ({ fontName: { family, style } })),
    );
  },
  notify(message, options) {
    figma._notifications.push({ message, options });
  },
  closePlugin() {
    figma._closed = true;
  },
  _notifications: [],
  _closed: false,
};

Object.defineProperty(figma, 'currentPage', {
  get: () => currentPageNode,
  set: () => {
    throw new Error(
      'in set_currentPage: Cannot call with documentAccess: dynamic-page. Use figma.setCurrentPageAsync instead.',
    );
  },
});

// COMPONENT.createInstance
MockNode.prototype.createInstance = function createInstance() {
  if (this.type !== 'COMPONENT') throw new Error('createInstance только у COMPONENT');
  const instance = makeNode('INSTANCE');
  instance.width = this.width;
  instance.height = this.height;
  const clone = (source, target) => {
    for (const child of source.children) {
      const copy = makeNode(child.type);
      copy.name = child.name;
      copy.x = child.x;
      copy.y = child.y;
      copy.width = child.width;
      copy.height = child.height;
      copy.fills = JSON.parse(JSON.stringify(child.fills || []));
      copy.strokes = JSON.parse(JSON.stringify(child.strokes || []));
      copy.cornerRadius = child.cornerRadius;
      copy._characters = child._characters ?? '';
      copy.fontName = child.fontName;
      if (child.fontName) {
        Object.defineProperty(copy, 'characters', {
          get: () => copy._characters ?? '',
          set: (value) => {
            copy._characters = value;
            copy._overrides += 1;
          },
        });
      }
      copy.parent = target;
      target.children.push(copy);
      clone(child, copy);
    }
  };
  clone(this, instance);
  return instance;
};

// ------------------------------------------------------------------- запуск
const code = readFileSync(join(here, 'plugin', 'code.js'), 'utf8');

const sceneCount = (code.match(/const SCENE = \[/) ? 1 : 0) + (code.includes('DOT_TILE_BASE64') ? 1 : 0);
if (!sceneCount) {
  console.error('в code.js нет SCENE/DOT_TILE_BASE64 — сначала запусти build.mjs');
  process.exit(1);
}

const started = Date.now();
const fn = new Function(
  'figma',
  'console',
  `${code}\nreturn { get SCENE() { return SCENE; }, get CONFIG() { return CONFIG; } };`,
);
// SCENE заполняется асинхронно внутри main(), поэтому читаем через геттеры.
const api = fn(figma, console);

await new Promise((resolve) => {
  const timer = setTimeout(() => resolve(), 60000);
  const poll = setInterval(() => {
    if (figma._closed) {
      clearInterval(poll);
      clearTimeout(timer);
      resolve();
    }
  }, 20);
});

const counts = MockNode.registry.reduce((acc, node) => {
  const key = node.type || 'STYLE';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const errors = [];
for (const node of MockNode.registry) {
  if (!Array.isArray(node.children)) continue; // стили и переменные — не узлы
  if (node.type === 'TEXT' && node.characters === '' && node.width > 0) {
    errors.push(`текст без символов: ${node.id} (${node.name})`);
  }
  if (!(node.width >= 0) || !(node.height >= 0)) errors.push(`некорректный размер: ${node.id}`);
}

console.log('Сцены:', api.SCENE.length, '| страницы:', pages.map((page) => page.name).join(', '));
console.log('Создано узлов:', JSON.stringify(counts));
console.log('Стили:', MockNode.registry.filter((n) => n.type === 'PAINT').length, 'цветовых,', MockNode.registry.filter((n) => n.type === 'TEXT_STYLE').length, 'текстовых');
console.log('Переменные:', MockNode.variables.length, 'в', MockNode.variableCollections.length, 'коллекциях | component sets:', MockNode.variantSets);
const boundFills = MockNode.registry.filter((n) => Array.isArray(n.fills) && n.fills.some((p) => p && p.boundVariables)).length;
console.log('Узлов с привязанными заливками:', boundFills);
console.log('Уведомления:', figma._notifications.map((item) => item.message).join(' | '));
console.log('Время:', Date.now() - started, 'мс');
if (errors.length) {
  console.error('\nПроблемы:');
  for (const error of errors.slice(0, 10)) console.error('  - ' + error);
  process.exit(1);
}
const fatal = figma._notifications.some((item) => String(item.message).startsWith('Ошибка'));
if (fatal) {
  console.error('\nПлагин сообщил об ошибке сборки — см. уведомление выше');
  process.exit(1);
}
if (!figma._closed) {
  console.error('\nПлагин не завершился (нет closePlugin) — вероятно повис на ошибке');
  process.exit(1);
}
console.log('\nOK: плагин отработал без ошибок API');
