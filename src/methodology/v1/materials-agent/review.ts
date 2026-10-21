import type { MaterialQueueJournal } from "./queue.ts";

export function renderMaterialQueueReview(journal: MaterialQueueJournal): string {
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
  if (journal.notes.length > 0) {
    lines.push("## Замечания");
    lines.push("");
    for (const note of journal.notes) lines.push(`- ${note}`);
    lines.push("");
  }
  lines.push("> Материалы не приняты в каталог. Нужен human-review.");
  return `${lines.join("\n")}\n`;
}
