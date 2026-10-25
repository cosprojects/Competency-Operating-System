import type { CompetencyBlock } from "../competency/types.ts";
import type { MaterialQueueJournal } from "./queue.ts";

export interface ReviewCoverageContext {
  /** Компетенции профессии в порядке view. */
  competencies: Array<{ competencyId: string; title: string }>;
  /** Accepted-блоки каталога: нужны, чтобы связать компетенции с элементами журнала. */
  blocks: CompetencyBlock[];
}

export function renderMaterialQueueReview(journal: MaterialQueueJournal, context?: ReviewCoverageContext): string {
  const lines: string[] = [];
  lines.push(`# Материалы: ${journal.professionId}`);
  lines.push("");
  lines.push(`Элементов: ${journal.totals.items}; completed: ${journal.totals.completed}; failed: ${journal.totals.failed}; discovered: ${journal.totals.discovered}; linked: ${journal.totals.linked}.`);
  lines.push("");
  for (const result of journal.items) {
    lines.push(`## ${result.item.title}`);
    lines.push("");
    lines.push(`- статус: **${result.status}**; попыток: ${result.attempts}; материалов: ${result.materials.length}; связей: ${result.linked}`);
    if (result.errors.length > 0) lines.push(`- ошибки: ${result.errors.join("; ")}`);
    for (const material of result.materials) {
      lines.push(`- [${material.title}](${material.url}) — ${material.kind}, ${material.access}, ${material.language}; links: ${material.links.length}`);
    }
    lines.push("");
  }
  if (context) {
    const itemsByBlock = new Map(journal.items.map((item) => [item.item.competencyId, item]));
    const acceptedBlocks = context.blocks.filter((block) => block.status === "accepted");
    lines.push("## Покрытие компетенций профессии");
    lines.push("");
    lines.push("| Компетенция | Блок | Материалов | Связей |");
    lines.push("|---|---|---:|---:|");
    const withoutMaterials: string[] = [];
    for (const competency of context.competencies) {
      const covering = acceptedBlocks.filter((block) => (block.canonicalIds ?? []).includes(competency.competencyId));
      const found = covering.map((block) => itemsByBlock.get(block.id)).filter((item) => item !== undefined);
      const materials = found.reduce((sum, item) => sum + item!.materials.length, 0);
      const linked = found.reduce((sum, item) => sum + item!.linked, 0);
      if (materials === 0) withoutMaterials.push(competency.title);
      lines.push(`| ${competency.title} | ${covering.map((block) => block.title).join(", ") || "—"} | ${materials} | ${linked} |`);
    }
    lines.push("");
    lines.push(`Без материалов: ${withoutMaterials.length} из ${context.competencies.length}.`);
    if (withoutMaterials.length > 0) lines.push(`Без материалов остались: ${withoutMaterials.join(", ")}.`);
    lines.push("");
  }
  if (journal.notes.length > 0) {
    lines.push("## Замечания");
    lines.push("");
    for (const note of journal.notes) lines.push(`- ${note}`);
    lines.push("");
  }
  lines.push("> Материалы не приняты в каталог. Нужен human-review.");
  return `${lines.join("\n")}\n`;
}
