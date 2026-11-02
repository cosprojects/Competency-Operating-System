/**
 * Детерминированная раскладка схемы компетенций для канваса.
 *
 * Узлы — компетенции профессии. Разделы профессии становятся горизонтальными
 * полосами («лентами»): слева название раздела, справа карточки компетенций
 * по порядку. Связи — пререквизиты. Раскладка считается один раз и не
 * «прыгает» между рендерами: канвас можно панорамировать и масштабировать.
 */

export type CompetencyTier = "foundation" | "core" | "optional";

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

const CARD = { width: 188, height: 92 };
const GAP = 24;
const ROW_GAP = 22;
const BAND_PADDING = 12;
const LABEL_WIDTH = 176;
const LABEL_GAP = 24;
const PADDING = 64;

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

export function layoutCompetencyGraph(input: GraphNodeInput[]): GraphLayout {
  const groups = groupBySection(input);
  const nodes: GraphNode[] = [];
  const bands: GraphBand[] = [];

  let cursorY = PADDING;
  let maxRight = 0;
  const bandHeight = CARD.height + BAND_PADDING * 2;

  for (const group of groups) {
    const bandX = PADDING / 2;
    const bandWidth =
      LABEL_WIDTH + LABEL_GAP + group.items.length * CARD.width + (group.items.length - 1) * GAP;
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
        x: bandX + LABEL_WIDTH + LABEL_GAP + index * (CARD.width + GAP),
        y: cursorY + BAND_PADDING,
        width: CARD.width,
        height: CARD.height,
      });
    });

    maxRight = Math.max(maxRight, bandX + bandWidth);
    cursorY += bandHeight + ROW_GAP;
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: GraphEdge[] = [];
  for (const node of input) {
    for (const prerequisite of node.prerequisites) {
      if (nodeIds.has(prerequisite)) edges.push({ from: prerequisite, to: node.id });
    }
  }

  return {
    nodes,
    edges,
    bands,
    width: maxRight + PADDING / 2,
    height: cursorY - ROW_GAP + PADDING,
  };
}

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
