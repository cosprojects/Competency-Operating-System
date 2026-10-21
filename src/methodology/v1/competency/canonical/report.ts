import type { CanonicalMap, CanonicalValidationResult } from "./types.ts";

export function renderCanonicalCoverage(map: CanonicalMap, result: CanonicalValidationResult): string {
  const lines: string[] = [];
  lines.push(`# Каноническая карта — ${map.professionId}`);
  lines.push("");
  lines.push(`Версия: ${map.canonicalVersion}; статус: ${map.status}; обновлено: ${map.updatedOn}.`);
  lines.push("");
  lines.push(`Компетенций: **${result.coverage.total}**; покрыто: **${result.coverage.covered}**; частично: **${result.coverage.partial}**; пробелов: **${result.coverage.gap}**.`);
  lines.push("");
  for (const branch of map.branches) {
    const branchCoverage = result.coverage.byBranch[branch.id];
    lines.push(`## ${branch.title}`);
    lines.push("");
    lines.push(branch.definition);
    lines.push("");
    lines.push(`Покрытие: ${branchCoverage?.covered ?? 0} covered / ${branchCoverage?.partial ?? 0} partial / ${branchCoverage?.gap ?? 0} gap.`);
    lines.push("");
    for (const section of branch.sections) {
      const sectionCoverage = result.coverage.bySection[section.id];
      lines.push(`### ${section.title}`);
      lines.push("");
      lines.push(section.definition);
      lines.push("");
      lines.push("| Компетенция | Tier-подсказка | Статус | Блоки |");
      lines.push("|---|---|---|---|");
      for (const competency of section.competencies) {
        lines.push(
          `| ${competency.title} | ${competency.priorityHint} | ${competency.status} | ${competency.coveredBy.join(", ") || "—"} |`,
        );
      }
      lines.push("");
      if (sectionCoverage) lines.push(`Итого: ${sectionCoverage.covered} / ${sectionCoverage.partial} / ${sectionCoverage.gap}.`);
      lines.push("");
    }
  }
  if (result.errors.length > 0) {
    lines.push("## Ошибки");
    lines.push("");
    for (const error of result.errors) lines.push(`- ${error}`);
    lines.push("");
  }
  if (result.warnings.length > 0) {
    lines.push("## Предупреждения");
    lines.push("");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
