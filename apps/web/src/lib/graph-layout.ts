/**
 * Детерминированная раскладка схемы компетенций для канваса.
 *
 * Два режима отображения:
 * - board — разделы профессии горизонтальными лентами: слева название, справа
 *   карточки компетенций по порядку (как в левом сайдбаре);
 * - network — сеть как в старых HTML-канвасах: фундаментальные компетенции
 *   в центре, основные и необязательные — кольцами вокруг, связи-пререквизиты.
 *
 * Раскладка считается один раз и не «прыгает» между рендерами: канвас можно
 * панорамировать и масштабировать.
 */

export type CompetencyTier = "foundation" | "core" | "optional";

export type GraphMode = "board" | "network";

export interface GraphNodeInput {
  id: string;
  title: string;
  tier: CompetencyTier;
  order: number;
  sectionId: string;
  sectionTitle: string;
  definition: string;
  knowledge: number;
  skills: number;
  sources: number;
  prerequisites: string[];
}

export interface GraphNode extends GraphNodeInput {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphBand {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  labelX: number;
  labelY: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  bands: GraphBand[];
  width: number;
  height: number;
}

// Размеры карточек подобраны так, чтобы обе раскладки вписывались в центр
// канваса (между сайдбарами) при включённом зуме «по размеру».
const BOARD_CARD = { width: 376, height: 92 };
const BOARD_GAP = 24;
const BOARD_ROW_GAP = 22;
const BOARD_BAND_PADDING = 12;
const BOARD_LABEL_WIDTH = 176;
const BOARD_LABEL_GAP = 24;

const NETWORK_CARD = { width: 190, height: 78 };
const NETWORK_GAP = 26;
const NETWORK_PADDING = 96;

const PADDING = 64;
const TWO_PI = Math.PI * 2;

interface SectionGroup {
  id: string;
  title: string;
  items: GraphNodeInput[];
}

function groupBySection(nodes: GraphNodeInput[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  const byId = new Map<string, SectionGroup>();
  for (const node of nodes) {
    let group = byId.get(node.sectionId);
    if (!group) {
      group = { id: node.sectionId, title: node.sectionTitle, items: [] };
      byId.set(node.sectionId, group);
      groups.push(group);
    }
    group.items.push(node);
  }
  for (const group of groups) {
    group.items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ru"));
  }
  return groups;
}

function collectEdges(nodes: GraphNode[]): GraphEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: GraphEdge[] = [];
  for (const node of nodes) {
    for (const prerequisite of node.prerequisites) {
      if (nodeIds.has(prerequisite)) edges.push({ from: prerequisite, to: node.id });
    }
  }
  return edges;
}

/* ------------------------------------------------------------------ */
/* board: разделы лентами                                             */
/* ------------------------------------------------------------------ */

function layoutBoard(input: GraphNodeInput[]): GraphLayout {
  const groups = groupBySection(input);
  const nodes: GraphNode[] = [];
  const bands: GraphBand[] = [];

  let cursorY = PADDING;
  let maxRight = 0;
  const bandHeight = BOARD_CARD.height + BOARD_BAND_PADDING * 2;

  for (const group of groups) {
    const bandX = PADDING / 2;
    const bandWidth =
      BOARD_LABEL_WIDTH + BOARD_LABEL_GAP + group.items.length * BOARD_CARD.width + (group.items.length - 1) * BOARD_GAP;
    bands.push({
      id: group.id,
      title: group.title,
      x: bandX,
      y: cursorY,
      width: bandWidth,
      height: bandHeight,
      labelX: bandX + 16,
      labelY: cursorY + bandHeight / 2,
    });

    group.items.forEach((item, index) => {
      nodes.push({
        ...item,
        x: bandX + BOARD_LABEL_WIDTH + BOARD_LABEL_GAP + index * (BOARD_CARD.width + BOARD_GAP),
        y: cursorY + BOARD_BAND_PADDING,
        width: BOARD_CARD.width,
        height: BOARD_CARD.height,
      });
    });

    maxRight = Math.max(maxRight, bandX + bandWidth);
    cursorY += bandHeight + BOARD_ROW_GAP;
  }

  return {
    nodes,
    edges: collectEdges(nodes),
    bands,
    width: maxRight + PADDING / 2,
    height: cursorY - BOARD_ROW_GAP + PADDING,
  };
}

/* ------------------------------------------------------------------ */
/* network: сеть по уровням, как в старых HTML-канвасах               */
/* ------------------------------------------------------------------ */

interface Positioned {
  input: GraphNodeInput;
  x: number;
  y: number;
}

function gridPositions(items: GraphNodeInput[]): Positioned[] {
  if (items.length === 0) return [];
  const columns = items.length <= 1 ? 1 : items.length <= 4 ? 2 : 3;
  const rows = Math.ceil(items.length / columns);
  const totalWidth = columns * NETWORK_CARD.width + (columns - 1) * NETWORK_GAP;
  const totalHeight = rows * NETWORK_CARD.height + (rows - 1) * NETWORK_GAP;
  return items.map((input, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowCount = Math.min(columns, items.length - row * columns);
    const rowWidth = rowCount * NETWORK_CARD.width + (rowCount - 1) * NETWORK_GAP;
    return {
      input,
      x: -rowWidth / 2 + NETWORK_CARD.width / 2 + column * (NETWORK_CARD.width + NETWORK_GAP),
      y: -totalHeight / 2 + NETWORK_CARD.height / 2 + row * (NETWORK_CARD.height + NETWORK_GAP),
    };
  });
}

function ringRadius(count: number, minimum: number): number {
  if (count <= 1) return minimum;
  const chordRadius = (NETWORK_CARD.width + NETWORK_GAP) / (2 * Math.sin(Math.PI / count));
  return Math.max(minimum, chordRadius);
}

function ringPositions(items: GraphNodeInput[], radius: number, startAngle = -Math.PI / 2): Positioned[] {
  if (items.length === 0) return [];
  return items.map((input, index) => {
    const angle = startAngle + (TWO_PI * index) / items.length;
    return { input, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

function layoutNetwork(input: GraphNodeInput[]): GraphLayout {
  const byTier: Record<CompetencyTier, GraphNodeInput[]> = { foundation: [], core: [], optional: [] };
  for (const node of input) byTier[node.tier].push(node);
  const sort = (items: GraphNodeInput[]) =>
    items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ru"));
  sort(byTier.foundation);
  sort(byTier.core);
  sort(byTier.optional);

  const positioned: Positioned[] = [];
  const foundation = gridPositions(byTier.foundation);
  positioned.push(...foundation);
  const foundationHalfHeight = foundation.length
    ? Math.max(...foundation.map((item) => Math.abs(item.y))) + NETWORK_CARD.height / 2
    : 0;

  let coreRadius = 0;
  if (byTier.core.length > 0) {
    coreRadius = ringRadius(
      byTier.core.length,
      Math.max(300, foundationHalfHeight + NETWORK_CARD.width / 2 + NETWORK_GAP + 40),
    );
    positioned.push(...ringPositions(byTier.core, coreRadius));
  }

  if (byTier.optional.length > 0) {
    const base =
      coreRadius > 0 ? coreRadius + NETWORK_CARD.height + 110 : Math.max(300, foundationHalfHeight + 190);
    const firstRing = byTier.optional.slice(0, 14);
    const secondRing = byTier.optional.slice(14);
    positioned.push(...ringPositions(firstRing, ringRadius(firstRing.length, base)));
    if (secondRing.length > 0) {
      positioned.push(...ringPositions(secondRing, ringRadius(secondRing.length, base + 170)));
    }
  }

  if (positioned.length === 0) {
    return { nodes: [], edges: [], bands: [], width: 0, height: 0 };
  }

  const minX = Math.min(...positioned.map((item) => item.x - NETWORK_CARD.width / 2)) - NETWORK_PADDING;
  const minY = Math.min(...positioned.map((item) => item.y - NETWORK_CARD.height / 2)) - NETWORK_PADDING;
  const maxX = Math.max(...positioned.map((item) => item.x + NETWORK_CARD.width / 2)) + NETWORK_PADDING;
  const maxY = Math.max(...positioned.map((item) => item.y + NETWORK_CARD.height / 2)) + NETWORK_PADDING;

  const nodes: GraphNode[] = positioned.map((item) => ({
    ...item.input,
    x: item.x - NETWORK_CARD.width / 2 - minX,
    y: item.y - NETWORK_CARD.height / 2 - minY,
    width: NETWORK_CARD.width,
    height: NETWORK_CARD.height,
  }));

  return {
    nodes,
    edges: collectEdges(nodes),
    bands: [],
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function layoutCompetencyGraph(input: GraphNodeInput[], mode: GraphMode = "board"): GraphLayout {
  return mode === "network" ? layoutNetwork(input) : layoutBoard(input);
}

/* ------------------------------------------------------------------ */
/* Связи                                                             */
/* ------------------------------------------------------------------ */

function edgeAnchors(
  from: GraphNode,
  to: GraphNode,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sign = dx >= 0 ? 1 : -1;
    return {
      start: { x: fromCenter.x + (sign * from.width) / 2, y: fromCenter.y },
      end: { x: toCenter.x - (sign * to.width) / 2, y: toCenter.y },
    };
  }
  const sign = dy >= 0 ? 1 : -1;
  return {
    start: { x: fromCenter.x, y: fromCenter.y + (sign * from.height) / 2 },
    end: { x: toCenter.x, y: toCenter.y - (sign * to.height) / 2 },
  };
}

/** Кривая между краями карточек — линия не проходит под текстом. */
export function edgePath(from: GraphNode, to: GraphNode): string {
  const { start, end } = edgeAnchors(from, to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const control = 0.45;
  const first = horizontal
    ? { x: start.x + dx * control, y: start.y }
    : { x: start.x, y: start.y + dy * control };
  const second = horizontal
    ? { x: end.x - dx * control, y: end.y }
    : { x: end.x, y: end.y - dy * control };
  return `M ${start.x} ${start.y} C ${first.x} ${first.y}, ${second.x} ${second.y}, ${end.x} ${end.y}`;
}
