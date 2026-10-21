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

const EVIDENCE_LABEL: Record<string, string> = {
  occupation: "ESCO",
  universal: "ESCO · универсальная база",
  onet: "O*NET",
  guidance: "guidance",
  model: "модель COS",
  program: "программа",
};

const STATUS_MARK: Record<string, string> = {
  supported: "✅",
  model_only: "🧩",
  watchlist: "👁",
  no_evidence: "⛔",
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

function roleLabel(role: string): string {
  if (role === "core") return "ядро";
  if (role === "supporting") return "поддержка";
  return "универсальная база";
}

function relationLabel(relation: string): string {
  return relation === "essential" ? "обязательный" : "опциональный";
}

function entryLine(entry: ProfileEntry): string {
  const parts = [
    `- \`${KIND_LABEL[entry.kind]}\` **${oneLine(entry.title)}**`,
    `— «${shorten(entry.description) || "описание источником не дано"}»`,
    `— [${EVIDENCE_LABEL[entry.evidence] ?? entry.evidence}](${entry.sourceUrl})`,
    `· ${relationLabel(entry.occupations.some((item) => item.relation === "essential") ? "essential" : "optional")}`,
  ];
  if (entry.occupations.length > 1) parts.push(`· занятий: ${entry.occupations.length}`);
  if (entry.sourceLicense) parts.push(`· ${entry.sourceLicense}`);
  if (entry.sourceNote) parts.push(`· ${shorten(entry.sourceNote, 120)}`);
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
  lines.push(">");
  lines.push(
    "> ∞ — универсальная база: запись относится ко всем дизайнерам, а не к требованиям одной профессии.",
  );
  lines.push(">");
  lines.push(
    "> Статусы: ✅ источник · 🧩 только модель COS · 👁 watchlist без официальной записи · ⛔ пробел.",
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
  lines.push(`| Из них универсальная база | ${journal.stats.universalSkills} |`);
  lines.push(`| O*NET Software Skills | ${journal.stats.onetSkills} |`);
  lines.push(`| Guidance-источники | ${journal.stats.guidanceSkills} |`);
  lines.push(`| Программа (Яндекс Практикум) | ${journal.stats.programSkills} |`);
  lines.push(`| Модель COS (якоря графа) | ${journal.stats.modelSkills} |`);
  lines.push(`| Вне области профиля | ${journal.stats.outOfScope} |`);
  lines.push(`| Не сопоставлено | ${journal.stats.unmapped} |`);
  lines.push(
    `| Листья: подтверждено / всего | ${journal.stats.leavesSupported} / ${journal.stats.leavesTotal} |`,
  );
  lines.push(
    `| Универсальная база: листья | ${journal.stats.universalLeavesSupported} / ${journal.stats.universalLeavesTotal} |`,
  );
  lines.push(
    `| Профессиональные листья | ${journal.stats.professionLeavesSupported} / ${journal.stats.professionLeavesTotal} |`,
  );
  lines.push(
    `| Группы: есть свидетельства / всего | ${journal.stats.groupsSupported} / ${journal.stats.groupsTotal} |`,
  );
  lines.push(`| Листья: model_only / watchlist | ${journal.stats.modelOnlyLeaves} / ${journal.stats.watchlistLeaves} |`);
  lines.push(`| Записей без описания источника | ${journal.stats.entriesWithoutDescription} |`);
  lines.push("");

  lines.push("## Источники");
  lines.push("");
  lines.push("| Занятие ESCO | Роль | Essential | Optional |");
  lines.push("|---|---|---|---|");
  for (const source of journal.sourceOccupations) {
    lines.push(
      `| [${cell(source.title)}](${source.uri}) | ${roleLabel(source.role)} | ${source.essentialCount} | ${source.optionalCount} |`,
    );
  }
  lines.push("");

  if (journal.externalSources.length > 0) {
    lines.push("### Дополнительные источники");
    lines.push("");
    lines.push("| Источник | Тип | Лицензия | Записей |");
    lines.push("|---|---|---|---|");
    for (const source of journal.externalSources) {
      lines.push(
        `| [${cell(source.title)}](${source.url}) | ${source.kind} | ${cell(source.license)} | ${source.usedCount} |`,
      );
    }
    lines.push("");
  }

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
        const mark = STATUS_MARK[leaf.status] ?? "⛔";
        const statusSuffix =
          leaf.status === "model_only"
            ? " · модель COS, внешний источник нужен"
            : leaf.status === "watchlist"
              ? " · watchlist"
              : leaf.status === "no_evidence"
                ? " — пробел"
                : "";
        lines.push(
          `##### ${mark} ${leafTitle} · ${KIND_LABEL[leaf.kind]}${leaf.scope === "universal" ? " · ∞ универсальная база" : ""}${statusSuffix}`,
        );
        lines.push("");
        for (const id of leaf.entryIds) {
          const entry = entryById.get(id);
          if (entry) lines.push(entryLine(entry));
        }
        if (leaf.note) {
          lines.push("");
          lines.push(`_${leaf.note}_`);
        }
        if (leaf.status === "no_evidence") {
          lines.push("");
          lines.push("_В выбранных источниках нет записи, подтверждающей этот лист._");
        }
        lines.push("");
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
      lines.push(`- \`${gap.leafId}\` — ${gapTitle} (${KIND_LABEL[gap.kind]}${gap.scope === "universal" ? ", универсальная база" : ""})`);
    }
  }
  lines.push("");

  const modelLeaves = journal.branches
    .flatMap((branch) => branch.groups)
    .flatMap((group) => group.leaves)
    .filter((leaf) => leaf.status === "model_only");
  const watchLeaves = journal.branches
    .flatMap((branch) => branch.groups)
    .flatMap((group) => group.leaves)
    .filter((leaf) => leaf.status === "watchlist");

  lines.push("## Модель COS без внешнего источника");
  lines.push("");
  if (modelLeaves.length === 0) {
    lines.push("Нет.");
  } else {
    lines.push("Лист подтверждён якорем графа, но не внешним источником. Это не доказательство профессии.");
    lines.push("");
    for (const leaf of modelLeaves) {
      const leafTitle = leaf.titleRu ? `${leaf.title} / ${leaf.titleRu}` : leaf.title;
      lines.push(`- \`${leaf.id}\` — ${leafTitle}`);
    }
  }
  lines.push("");

  lines.push("## Watchlist");
  lines.push("");
  if (watchLeaves.length === 0) {
    lines.push("Нет.");
  } else {
    lines.push("Официальной записи нет. Лист не считается требованием и ждёт рыночного или отраслевого источника.");
    lines.push("");
    for (const leaf of watchLeaves) {
      const leafTitle = leaf.titleRu ? `${leaf.title} / ${leaf.titleRu}` : leaf.title;
      lines.push(`- \`${leaf.id}\` — ${leafTitle}${leaf.note ? `: ${leaf.note}` : ""}`);
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

  if (journal.universalMissing.length > 0) {
    lines.push("## Универсальные записи без источника");
    lines.push("");
    lines.push(
      "Эти правила универсальной базы не нашли запись ESCO ни в универсальных занятиях, ни по прямой ссылке.",
    );
    lines.push("");
    for (const item of journal.universalMissing) {
      lines.push(`- «${item.title}» → \`${item.targetId}\``);
    }
    lines.push("");
  }

  if (journal.modelMissing.length > 0) {
    lines.push("## Модель COS: правила без цитаты");
    lines.push("");
    for (const item of journal.modelMissing) {
      lines.push(`- \`${item.leafId}\` ← \`${item.nodeId}\`: ${item.reason}`);
    }
    lines.push("");
  }

  if (journal.guidanceMissing.length > 0) {
    lines.push("## Guidance: правила без подтверждённой цитаты");
    lines.push("");
    for (const item of journal.guidanceMissing) {
      lines.push(`- ${item.sourceId} → \`${item.targetId}\`: ${item.reason}`);
    }
    lines.push("");
  }

  if (journal.onetMissing.length > 0) {
    lines.push("## O*NET: инструменты без записи");
    lines.push("");
    for (const item of journal.onetMissing) {
      lines.push(`- ${item.socCode}: «${item.workplaceExample}»`);
    }
    lines.push("");
  }

  if (journal.programMissing.length > 0) {
    lines.push("## Программа: навыки без подтверждения на странице");
    lines.push("");
    for (const item of journal.programMissing) {
      lines.push(
        `- ${item.professionSlug} → \`${item.targetId}\`: ${item.skill} — ${item.reason}`,
      );
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
