import type { CompetencyBlock, CompetencyCandidate, TagRecord } from "./types.ts";

export function renderCandidateReview(candidates: CompetencyCandidate[], unassigned: string[]): string {
  const lines: string[] = [];
  lines.push("# Кандидаты в компетенции");
  lines.push("");
  lines.push(`Кандидатов: ${candidates.length}; неназначенных тегов: ${unassigned.length}.`);
  lines.push("");
  for (const candidate of candidates) {
    lines.push(`## ${candidate.title}${candidate.titleEn ? ` / ${candidate.titleEn}` : ""}`);
    lines.push("");
    lines.push(`- id: \`${candidate.id}\``);
    lines.push(`- статус: ${candidate.status}`);
    lines.push(`- область: ${candidate.scopeHint}`);
    lines.push(`- тегов: ${candidate.tagIds.length}`);
    lines.push(`- определение: ${candidate.definition}`);
    if (candidate.issues.length > 0) {
      lines.push(`- замечания: ${candidate.issues.join("; ")}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function renderBlockReview(blocks: CompetencyBlock[], globalIssues: string[]): string {
  const lines: string[] = [];
  lines.push("# Блоки компетенций на проверку");
  lines.push("");
  lines.push(`Блоков: ${blocks.length}. Все блоки имеют статус needs_review: в каталог они не попадают без человека.`);
  if (globalIssues.length > 0) {
    lines.push("");
    lines.push("## Общие замечания");
    lines.push("");
    for (const issue of globalIssues) lines.push(`- ${issue}`);
  }
  for (const block of blocks) {
    lines.push("");
    lines.push(`## ${block.title}${block.titleEn ? ` / ${block.titleEn}` : ""}`);
    lines.push("");
    lines.push(`- id: \`${block.id}\``);
    lines.push(`- область: ${block.scope}`);
    lines.push(`- профессии: ${block.professionIds.join(", ")}`);
    lines.push(`- компонентов: ${block.components.length}; тегов: ${block.tags.length}`);
    lines.push(`- evidence: ${block.evidenceState}; источников: ${block.sourceRefs.length}`);
    lines.push(`- определение: ${block.definition}`);
    if (block.issues.length > 0) {
      lines.push(`- замечания: ${block.issues.join("; ")}`);
    }
    for (const component of block.components) {
      lines.push("");
      lines.push(`### ${component.order}. ${component.title}`);
      lines.push("");
      lines.push(component.definition);
      lines.push("");
      for (const tagId of component.tagIds) {
        const tag = block.tags.find((item) => item.id === tagId);
        if (!tag) continue;
        lines.push(
          `- **${tag.title}** (${tag.kind}) — ${tag.definition}${tag.needsReview ? " · нужна проверка" : ""}`,
        );
      }
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function renderMaterialReview(
  materials: import("./types.ts").Material[],
  coverage: Array<{ title: string; materials: number; kinds: Record<string, number> }>,
): string {
  const lines: string[] = [];
  lines.push("# Материалы компетенций");
  lines.push("");
  lines.push(`Материалов: ${materials.length}. Все материалы имеют статус черновика и требуют проверки.`);
  lines.push("");
  lines.push("## Покрытие");
  lines.push("");
  for (const item of coverage) {
    lines.push(`- ${item.title}: ${item.materials} (${JSON.stringify(item.kinds)})`);
  }
  lines.push("");
  for (const material of materials) {
    lines.push(`## ${material.title}`);
    lines.push("");
    lines.push(`- ${material.kind} · ${material.provider} · ${material.access} · ${material.language}`);
    lines.push(`- ${material.url}`);
    if (material.price?.note) lines.push(`- цена: ${material.price.note}`);
    lines.push(`- ${material.description}`);
    for (const link of material.links) {
      lines.push(`  - связь: ${link.competencyId}${link.componentId ? ` / ${link.componentId}` : ""}${link.tagId ? ` / ${link.tagId}` : ""} · relevance ${link.relevance}${link.modelProposal ? " · modelProposal" : ""}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
