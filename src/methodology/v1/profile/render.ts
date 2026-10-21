import type { ProfileEntry, ProfileJournal, ProfileKind } from "./types.ts";

const KIND_LABEL: Record<ProfileKind, string> = {
  skill: "навык",
  knowledge: "знание",
  tool: "инструмент",
};

const REASON_LABEL: Record<string, string> = {
  programming_language: "язык программирования",
  web_development: "веб-разработка",
  software_engineering: "разработка ПО",
  project_management: "управление проектами",
  other_domain_motion_3d: "другое направление: motion/3D",
  media_production: "производство медиа",
  media_content_ops: "медиа-контент и оперирование",
  business_admin: "бизнес и администрирование",
  legal_policy: "право и политика",
  data_ai_infra: "данные, ИИ, инфраструктура",
  transversal: "общие (трансверсальные) навыки",
};

const OUTCOME_LABEL: Record<string, string> = {
  add_requirement: "требование (черновик)",
  already_required: "уже в графе",
  needs_node: "нужен новый узел",
  ambiguous: "неоднозначно",
  reject_tool: "инструмент",
  reject_taste: "оценка вкуса",
  reject_closed: "профессия закрыта",
};

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function shorten(text: string, max = 260): string {
  const line = oneLine(text);
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}

function cell(text: string): string {
  return oneLine(text).replace(/\|/g, "\\|");
}

function relationLabel(relation: string): string {
  return relation === "essential" ? "обязательный" : "опциональный";
}

function entryLine(entry: ProfileEntry): string {
  const parts = [
    `- \`${KIND_LABEL[entry.kind]}\` **${oneLine(entry.title)}**`,
    `— «${shorten(entry.description) || "описание источником не дано"}»`,
    `— [ESCO](${entry.sourceUrl})`,
    `· ${relationLabel(entry.occupations.some((item) => item.relation === "essential") ? "essential" : "optional")}`,
  ];
  if (entry.occupations.length > 1) parts.push(`· занятий: ${entry.occupations.length}`);
  if (entry.needsReview) parts.push("· **нужна проверка**");
  if (entry.sourceError) parts.push(`· ошибка источника: ${shorten(entry.sourceError, 80)}`);
  if (entry.nodeMatch) {
    const outcome = OUTCOME_LABEL[entry.nodeMatch.outcome] ?? entry.nodeMatch.outcome;
    parts.push(`· COS: ${outcome}${entry.nodeMatch.nodeId ? ` (${entry.nodeMatch.nodeId})` : ""}`);
  }
  return parts.join(" ");
}

export function renderProfileMarkdown(journal: ProfileJournal): string {
  const entryById = new Map(journal.entries.map((entry) => [entry.id, entry]));
  const lines: string[] = [];
  const title = journal.professionTitleRu
    ? `${journal.professionTitle} / ${journal.professionTitleRu}`
    : journal.professionTitle;

  lines.push(`# ${title} — профиль компетенций (черновик)`);
  lines.push("");
  lines.push(
    `> profileVersion ${journal.profileVersion} · taxonomy ${journal.taxonomyVersion} · mapping ${journal.mappingVersion} · ${journal.generatedOn} · \`writesToGraph: false\``,
  );
  lines.push(">");
  lines.push(
    "> Сборка не записывает граф и не подтверждает компетенции. Лист считается подтверждённым, если источник дал запись навыка с описанием и она попала в дерево; всё остальное — пробел или материал для проверки человеком.",
  );
  lines.push("");

  lines.push("## Сводка");
  lines.push("");
  lines.push("| Показатель | Значение |");
  lines.push("|---|---|");
  lines.push(`| Занятий-источников | ${journal.stats.sourceOccupations} |`);
  lines.push(`| Навыков получено ссылками | ${journal.stats.skillsSeen} |`);
  lines.push(`| Уникальных записей ESCO | ${journal.stats.uniqueSkills} |`);
  lines.push(`| Сопоставлено с деревом | ${journal.stats.mapped} |`);
  lines.push(`| Вне области профиля | ${journal.stats.outOfScope} |`);
  lines.push(`| Не сопоставлено | ${journal.stats.unmapped} |`);
  lines.push(
    `| Листья: подтверждено / всего | ${journal.stats.leavesSupported} / ${journal.stats.leavesTotal} |`,
  );
  lines.push(
    `| Группы: есть свидетельства / всего | ${journal.stats.groupsSupported} / ${journal.stats.groupsTotal} |`,
  );
  lines.push(`| Записей без описания источника | ${journal.stats.entriesWithoutDescription} |`);
  lines.push("");

  lines.push("## Источники");
  lines.push("");
  lines.push("| Занятие ESCO | Роль | Essential | Optional |");
  lines.push("|---|---|---|---|");
  for (const source of journal.sourceOccupations) {
    lines.push(
      `| [${cell(source.title)}](${source.uri}) | ${source.role === "core" ? "ядро" : "поддержка"} | ${source.essentialCount} | ${source.optionalCount} |`,
    );
  }
  lines.push("");

  lines.push("## Дерево профиля");
  lines.push("");
  for (const branch of journal.branches) {
    const branchTitle = branch.titleRu ? `${branch.title} / ${branch.titleRu}` : branch.title;
    lines.push(`### ${branchTitle}`);
    lines.push("");
    const general = branch.generalEntryIds
      .map((id) => entryById.get(id))
      .filter((entry): entry is ProfileEntry => entry !== undefined);
    if (general.length > 0) {
      lines.push("Общие компетенции ветки:");
      lines.push("");
      for (const entry of general) lines.push(entryLine(entry));
      lines.push("");
    }
    for (const group of branch.groups) {
      const groupTitle = group.titleRu ? `${group.title} / ${group.titleRu}` : group.title;
      lines.push(`#### ${groupTitle} · ${KIND_LABEL[group.kind]}`);
      lines.push("");
      const groupEntries = group.generalEntryIds
        .map((id) => entryById.get(id))
        .filter((entry): entry is ProfileEntry => entry !== undefined);
      if (groupEntries.length > 0) {
        lines.push("Общие компетенции группы:");
        lines.push("");
        for (const entry of groupEntries) lines.push(entryLine(entry));
        lines.push("");
      }
      for (const leaf of group.leaves) {
        const leafTitle = leaf.titleRu ? `${leaf.title} / ${leaf.titleRu}` : leaf.title;
        if (leaf.status === "supported") {
          lines.push(`##### ✅ ${leafTitle} · ${KIND_LABEL[leaf.kind]}`);
          lines.push("");
          for (const id of leaf.entryIds) {
            const entry = entryById.get(id);
            if (entry) lines.push(entryLine(entry));
          }
          lines.push("");
        } else {
          lines.push(`##### ⛔ ${leafTitle} · ${KIND_LABEL[leaf.kind]} — пробел`);
          lines.push("");
          lines.push("_В выбранных источниках нет записи, подтверждающей этот лист._");
          lines.push("");
        }
      }
    }
  }

  lines.push("## Пробелы");
  lines.push("");
  if (journal.gaps.length === 0) {
    lines.push("Пробелов нет: у каждого листа есть свидетельство источника.");
  } else {
    lines.push(
      `Листьев без свидетельства: ${journal.gaps.length}. Это не вывод об отсутствии компетенции, а место для нового источника.`,
    );
    lines.push("");
    for (const gap of journal.gaps) {
      const gapTitle = gap.titleRu ? `${gap.title} / ${gap.titleRu}` : gap.title;
      lines.push(`- \`${gap.leafId}\` — ${gapTitle} (${KIND_LABEL[gap.kind]})`);
    }
  }
  lines.push("");

  lines.push("## Вне области профиля");
  lines.push("");
  const reasonCounts = new Map<string, number>();
  for (const item of journal.outOfScope) {
    reasonCounts.set(item.reason, (reasonCounts.get(item.reason) ?? 0) + 1);
  }
  lines.push("| Причина | Записей |");
  lines.push("|---|---|");
  for (const [reason, count] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cell(REASON_LABEL[reason] ?? reason)} | ${count} |`);
  }
  lines.push("");
  const byReason = new Map<string, string[]>();
  for (const item of journal.outOfScope) {
    const list = byReason.get(item.reason) ?? [];
    list.push(item.title);
    byReason.set(item.reason, list);
  }
  for (const [reason, titles] of [...byReason.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const label = REASON_LABEL[reason] ?? reason;
    const shown = titles.slice(0, 40).join(", ");
    const rest = titles.length > 40 ? ` … и ещё ${titles.length - 40}` : "";
    lines.push(`- **${label}**: ${shown}${rest}`);
  }
  lines.push("");

  lines.push("## Не сопоставлено");
  lines.push("");
  if (journal.unmapped.length === 0) {
    lines.push("Все уникальные навыки либо сопоставлены, либо объяснены как вне области.");
  } else {
    lines.push(
      "Эти навыки не попали в дерево и не объяснены как вне области. Решение принимает человек.",
    );
    lines.push("");
    for (const item of journal.unmapped) {
      lines.push(`- ${item.title} (${item.kind})`);
    }
  }
  lines.push("");

  if (journal.mappingMissing.length > 0) {
    lines.push("## Правила маппинга без источника");
    lines.push("");
    lines.push(
      "Эти правила ссылаются на названия, которых нет в выбранных занятиях. Либо источник выбран неверно, либо правило устарело.",
    );
    lines.push("");
    for (const item of journal.mappingMissing) {
      lines.push(`- «${item.escoTitle}» → \`${item.targetId}\``);
    }
    lines.push("");
  }

  lines.push("## Диагностика соответствия графу COS");
  lines.push("");
  lines.push(journal.graphFit.note);
  lines.push("");
  lines.push("| Исход methodologist | Записей |");
  lines.push("|---|---|");
  for (const [outcome, count] of Object.entries(journal.graphFit.counts).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    lines.push(`| ${OUTCOME_LABEL[outcome] ?? outcome} | ${count} |`);
  }
  lines.push("");
  lines.push("## Ограничения");
  lines.push("");
  lines.push("- В граф ничего не записано: журнал носит диагностический характер.");
  lines.push("- Маппинг — организация выдачи, а не доказательство компетенции.");
  lines.push("- Лист без свидетельства не доказывает отсутствие компетенции.");
  lines.push("- Приёмка метода требует независимой размеченной выборки; здесь её нет.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}
