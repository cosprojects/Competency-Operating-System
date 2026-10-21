import type { CompetencyBlock } from "../types.ts";
import type { PriorityFile, PriorityTemplate, StudyPriorityMark } from "./types.ts";
import { CANVAS_ZONES, TIER_MEANINGS } from "./types.ts";

export function buildPriorityTemplate(input: {
  domain: string;
  professionId: string;
  source: "catalog" | "review";
  blocks: CompetencyBlock[];
  existing?: PriorityFile;
  generatedOn: string;
}): PriorityTemplate {
  const existingById = new Map(input.existing?.marks.map((mark) => [mark.competencyId, mark]) ?? []);
  const rows = input.blocks
    .filter((block) => block.professionIds.includes(input.professionId))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((block) => ({
      competencyId: block.id,
      title: block.title,
      blockStatus: block.status,
      components: block.components.length,
      tags: block.tags.length,
      ...(existingById.get(block.id) ? { existingMark: existingById.get(block.id)! } : {}),
    }));

  return {
    templateVersion: "1.0.0",
    domain: input.domain,
    professionId: input.professionId,
    source: input.source,
    generatedOn: input.generatedOn,
    tiers: [
      {
        id: "foundation",
        label: "Фундаментальная",
        meaning: TIER_MEANINGS.foundation,
        canvasZone: CANVAS_ZONES.foundation,
      },
      {
        id: "core",
        label: "Основная",
        meaning: TIER_MEANINGS.core,
        canvasZone: CANVAS_ZONES.core,
      },
      {
        id: "optional",
        label: "Необязательная",
        meaning: TIER_MEANINGS.optional,
        canvasZone: CANVAS_ZONES.optional,
      },
    ],
    rows,
    instructions: [
      "Заполните tier, order, rationale, confidence, reviewer и reviewedAt в src/methodology/v1/competency/priority/<profession>.json.",
      "order уникален в профессии; меньшее значение — раньше в обучении.",
      "prerequisites содержит только competencyId из этой таблицы; зависимости не должны идти позже зависимой компетенции.",
      "Финальный tier — человеческое решение. isCore и marketDemandWeight — сигналы, а не готовый приоритет.",
      "После заполнения запустите npm run priority:validate -- --domain <domain> --profession <profession> --require-complete.",
    ],
  };
}

export function renderPriorityTemplate(template: PriorityTemplate): string {
  const lines: string[] = [];
  lines.push(`# Шаблон маркировки — ${template.professionId}`);
  lines.push("");
  lines.push(`Источник блоков: ${template.source}; сгенерировано: ${template.generatedOn}.`);
  lines.push("");
  lines.push("## Уровни");
  lines.push("");
  lines.push("| Tier | Метка | Смысл | Канвас |");
  lines.push("|---|---|---|---|");
  for (const tier of template.tiers) {
    lines.push(`| \`${tier.id}\` | ${tier.label} | ${tier.meaning} | ${tier.canvasZone} |`);
  }
  lines.push("");
  lines.push("## Компетенции");
  lines.push("");
  lines.push("| competencyId | Название | Статус блока | tier | order | prerequisites | rationale | confidence | reviewer | reviewedAt |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const row of template.rows) {
    const mark = row.existingMark;
    lines.push(
      `| \`${row.competencyId}\` | ${row.title} | ${row.blockStatus} | ${mark?.tier ?? "—"} | ${mark?.order ?? "—"} | ${mark?.prerequisites.join(", ") || "—"} | ${mark?.rationale ?? "—"} | ${mark?.confidence ?? "—"} | ${mark?.reviewer ?? "—"} | ${mark?.reviewedAt ?? "—"} |`,
    );
  }
  lines.push("");
  lines.push("## Инструкции");
  lines.push("");
  for (const instruction of template.instructions) lines.push(`- ${instruction}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function toMarkdownRow(mark: StudyPriorityMark): string {
  return `| \`${mark.competencyId}\` | ${mark.tier} | ${mark.order} | ${mark.rationale} |`;
}
