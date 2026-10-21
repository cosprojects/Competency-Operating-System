import type { CompetencyBlock } from "../types.ts";
import type { StudyPriorityMark, StudyPriorityTier } from "../priority/types.ts";
import { TIER_ORDER } from "../priority/types.ts";
import type { CanvasLayout, CanvasLayoutInput, CanvasNodePlacement } from "./types.ts";

const FOUNDATION = { width: 220, height: 68 };
const STANDARD = { width: 192, height: 56 };
const GAP = 40;
const PADDING = 40;
const TWO_PI = Math.PI * 2;

interface Positioned {
  node: CanvasNodePlacement;
  width: number;
  height: number;
}

function gridLayout(
  items: Array<{ block: CompetencyBlock; mark: StudyPriorityMark; tier: StudyPriorityTier }>,
  card: { width: number; height: number },
  centerX: number,
  centerY: number,
): Positioned[] {
  if (items.length === 0) return [];
  const columns = items.length <= 1 ? 1 : items.length <= 3 ? items.length : 3;
  const rows = Math.ceil(items.length / columns);
  const totalWidth = columns * card.width + (columns - 1) * GAP;
  const totalHeight = rows * card.height + (rows - 1) * GAP;
  return items.map((item, index) => {
    const row = Math.floor(index / columns);
    const inRow = index % columns;
    const rowCount = Math.min(columns, items.length - row * columns);
    const rowWidth = rowCount * card.width + (rowCount - 1) * GAP;
    const x = centerX - rowWidth / 2 + card.width / 2 + inRow * (card.width + GAP);
    const y = centerY - totalHeight / 2 + card.height / 2 + row * (card.height + GAP);
    return {
      node: {
        competencyId: item.block.id,
        title: item.block.title,
        tier: item.tier,
        order: item.mark.order,
        ring: 0,
        angle: 0,
        x,
        y,
        width: card.width,
        height: card.height,
        emphasis: "primary",
        opacity: 1,
        nodeVariant: "core_root",
      },
      width: card.width,
      height: card.height,
    };
  });
}

function ringLayout(
  items: Array<{ block: CompetencyBlock; mark: StudyPriorityMark; tier: StudyPriorityTier }>,
  centerX: number,
  centerY: number,
  baseRadius: number,
  ring: number,
  startAngle = -Math.PI / 2,
): Positioned[] {
  if (items.length === 0) return [];
  const radius = Math.max(baseRadius, (items.length * (STANDARD.width + GAP)) / TWO_PI);
  return items.map((item, index) => {
    const angle = startAngle + (TWO_PI * index) / items.length;
    return {
      node: {
        competencyId: item.block.id,
        title: item.block.title,
        tier: item.tier,
        order: item.mark.order,
        ring,
        angle,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        width: STANDARD.width,
        height: STANDARD.height,
        emphasis: ring === 1 ? "secondary" : "tertiary",
        opacity: ring === 1 ? 0.9 : 0.65,
        nodeVariant: "standard",
      },
      width: STANDARD.width,
      height: STANDARD.height,
    };
  });
}

function boundsOf(positions: Positioned[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (positions.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const item of positions) {
    minX = Math.min(minX, item.node.x - item.width / 2);
    minY = Math.min(minY, item.node.y - item.height / 2);
    maxX = Math.max(maxX, item.node.x + item.width / 2);
    maxY = Math.max(maxY, item.node.y + item.height / 2);
  }
  return { minX: minX - PADDING, minY: minY - PADDING, maxX: maxX + PADDING, maxY: maxY + PADDING };
}

function halfExtent(positions: Positioned[]): number {
  const bounds = boundsOf(positions);
  return Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2;
}

export function layoutCompetencies(input: CanvasLayoutInput): CanvasLayout {
  const viewport = input.viewport ?? { width: 1200, height: 800 };
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const blockById = new Map(input.blocks.map((block) => [block.id, block]));
  const marksByCompetency = new Map(input.marks.map((mark) => [mark.competencyId, mark]));
  const diagnostics: string[] = [];

  const selected = [...marksByCompetency.values()]
    .filter((mark) => {
      const block = blockById.get(mark.competencyId);
      if (!block) {
        diagnostics.push(`mark «${mark.competencyId}»: блок не найден`);
        return false;
      }
      return block.professionIds.includes(input.professionId);
    })
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.order - b.order || a.competencyId.localeCompare(b.competencyId));

  if (selected.length === 0) {
    const professionBlocks = input.blocks.filter((block) => block.professionIds.includes(input.professionId));
    if (professionBlocks.length > 0 && !input.allowPartial) {
      throw new Error("Нет размеченных компетенций; используйте --allow-partial для пустого предпросмотра");
    }
    return {
      layoutVersion: "1.0.0",
      domain: input.domain,
      professionId: input.professionId,
      viewport,
      nodes: [],
      edges: [],
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      diagnostics: [...diagnostics, "нет размеченных компетенций"],
      writesToGraph: false,
    };
  }

  const blocksByTier = {
    foundation: [] as Array<{ block: CompetencyBlock; mark: StudyPriorityMark; tier: StudyPriorityTier }>,
    core: [] as Array<{ block: CompetencyBlock; mark: StudyPriorityMark; tier: StudyPriorityTier }>,
    optional: [] as Array<{ block: CompetencyBlock; mark: StudyPriorityMark; tier: StudyPriorityTier }>,
  };
  for (const mark of selected) {
    const block = blockById.get(mark.competencyId);
    if (!block) continue;
    blocksByTier[mark.tier].push({ block, mark, tier: mark.tier });
  }

  const positions: Positioned[] = [];
  const foundationPositions = gridLayout(blocksByTier.foundation, FOUNDATION, centerX, centerY);
  positions.push(...foundationPositions);

  const foundationExtent = halfExtent(foundationPositions);
  let corePositions: Positioned[] = [];
  let coreRadius = 0;
  if (blocksByTier.core.length > 0) {
    if (foundationPositions.length > 0) {
      const baseRadius = Math.max(260, foundationExtent + STANDARD.width / 2 + GAP + 20);
      corePositions = ringLayout(blocksByTier.core, centerX, centerY, baseRadius, 1);
      coreRadius = Math.max(baseRadius, (blocksByTier.core.length * (STANDARD.width + GAP)) / TWO_PI);
    } else {
      corePositions = gridLayout(blocksByTier.core, STANDARD, centerX, centerY);
    }
    positions.push(...corePositions);
  }

  if (blocksByTier.optional.length > 0) {
    if (corePositions.length === 0 && foundationPositions.length === 0) {
      positions.push(...gridLayout(blocksByTier.optional, STANDARD, centerX, centerY));
    } else {
      const baseRadius = corePositions.length > 0
        ? coreRadius + 180
        : foundationExtent + STANDARD.width / 2 + 200;
      const firstRing = blocksByTier.optional.slice(0, 12);
      const secondRing = blocksByTier.optional.slice(12);
      positions.push(...ringLayout(firstRing, centerX, centerY, baseRadius, 2));
      if (secondRing.length > 0) {
        positions.push(...ringLayout(secondRing, centerX, centerY, baseRadius + 140, 3));
      }
    }
  }

  // Проверка пересечений; не режем узлы и не прячем — только диагностика.
  for (let left = 0; left < positions.length; left += 1) {
    for (let right = left + 1; right < positions.length; right += 1) {
      const a = positions[left]!;
      const b = positions[right]!;
      const overlapX = Math.abs(a.node.x - b.node.x) < (a.width + b.width) / 2;
      const overlapY = Math.abs(a.node.y - b.node.y) < (a.height + b.height) / 2;
      if (overlapX && overlapY) {
        diagnostics.push(`пересечение узлов «${a.node.title}» и «${b.node.title}»`);
      }
    }
  }
  const nodeIds = new Set(positions.map((item) => item.node.competencyId));
  const edges = selected
    .flatMap((mark) =>
      mark.prerequisites.map((prerequisite) => {
        if (!nodeIds.has(prerequisite)) {
          const block = blockById.get(prerequisite);
          diagnostics.push(
            `prerequisite «${block?.title ?? prerequisite}» вне выбранного набора; ребро пропущено`,
          );
          return null;
        }
        return { fromCompetencyId: prerequisite, toCompetencyId: mark.competencyId, kind: "prerequisite" as const };
      }),
    )
    .filter((edge): edge is { fromCompetencyId: string; toCompetencyId: string; kind: "prerequisite" } => edge !== null);

  const missing = input.blocks.filter(
    (block) => block.professionIds.includes(input.professionId) && !marksByCompetency.has(block.id),
  );
  if (missing.length > 0) {
    diagnostics.push(`без приоритета: ${missing.map((block) => block.title).join(", ")}`);
    if (!input.allowPartial) {
      throw new Error(`Нет приоритета для ${missing.length} компетенций; используйте --allow-partial для предпросмотра`);
    }
  }

  return {
    layoutVersion: "1.0.0",
    domain: input.domain,
    professionId: input.professionId,
    viewport,
    nodes: positions.map((item) => item.node),
    edges,
    bounds: boundsOf(positions),
    diagnostics,
    writesToGraph: false,
  };
}
