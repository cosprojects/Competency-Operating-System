/**
 * Сборка markdown-дайджеста. Чистая функция: вход — окно, сессии и git,
 * выход — текст, который читает агент. Здесь нет файловых операций.
 */
import type { GitDigest } from "./git.ts";
import type { SessionDigest } from "./sessions.ts";
import { entryDateForWindow } from "./window.ts";
import { localDateTimeString, localTimeString, uniqueStrings } from "./shared.ts";

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function areaOf(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length >= 3) return parts.slice(0, 2).join("/");
  return parts[0] ?? filePath;
}

function hotAreas(files: string[], limit = 8): Array<{ area: string; count: number }> {
  const counts = new Map<string, number>();
  for (const file of files) {
    const area = areaOf(file);
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((left, right) => right.count - left.count || left.area.localeCompare(right.area))
    .slice(0, limit);
}

function list(values: string[], limit: number): string {
  if (values.length === 0) return "—";
  const shown = values.slice(0, limit).join(", ");
  const rest = values.length - limit;
  return rest > 0 ? `${shown}, ещё ${rest}` : shown;
}

export function meaningfulSession(session: SessionDigest): boolean {
  return (
    session.userMessages.length > 0 ||
    session.files.length > 0 ||
    session.commands.length > 0 ||
    session.assistantNotes.length > 0 ||
    session.deliverables.length > 0 ||
    session.compactionSummaries.length > 0
  );
}

export interface RenderDigestOptions {
  since: Date;
  until: Date;
  sinceSource: string;
  workspace: string;
  sessions: SessionDigest[];
  git: GitDigest;
  maxChars: number;
}

/** Собрать markdown-дайджест. */
export function renderDigest(options: RenderDigestOptions): string {
  const sessions = options.sessions.filter(meaningfulSession);
  const allFiles = uniqueStrings([
    ...sessions.flatMap((session) => session.files),
    ...options.git.commits.flatMap((commit) => commit.files.map((file) => file.path)),
  ]);
  const allUserMessages = uniqueStrings(sessions.flatMap((session) => session.userMessages));
  const allCommands = uniqueStrings(sessions.flatMap((session) => session.commands));
  const uncommitted = options.git.uncommitted;
  const diff = options.git.diff;
  const empty =
    sessions.length === 0 &&
    options.git.commits.length === 0 &&
    uncommitted.length === 0 &&
    diff.files === 0;

  const lines: string[] = [];
  lines.push("# Дайджест работы для лога обновлений", "");
  lines.push(`- Период: **${localDateTimeString(options.since)} → ${localDateTimeString(options.until)}**`);
  lines.push(`- Начало отсчёта: ${options.sinceSource}`);
  lines.push(`- Рабочее пространство: \`${options.workspace}\``);
  lines.push(`- Дата для записи: \`${entryDateForWindow(options.until)}\``);
  lines.push("");
  if (empty) {
    lines.push(
      "> **Изменений не найдено.** С момента последнего логирования не было ни работы в сессиях, ни коммитов, ни изменённых файлов. Запись создавать не нужно.",
    );
    lines.push("");
  }

  lines.push("## Цифры", "");
  lines.push(`- Сессий с активностью: ${sessions.length}`);
  lines.push(`- Запросов человека: ${allUserMessages.length}`);
  lines.push(`- Файлов затронуто: ${allFiles.length}`);
  lines.push(`- Команд в работе: ${allCommands.length}`);
  lines.push(`- Коммитов: ${options.git.commits.length}`);
  lines.push(`- Незакоммиченных файлов: ${uncommitted.length}`);
  if (diff.files > 0) {
    lines.push(
      `- Изменено строк в незакоммиченном: +${diff.additions} / −${diff.deletions} в ${diff.files} ${plural(diff.files, "файле", "файлах", "файлах")}`,
    );
  }
  lines.push("");

  const areas = hotAreas(allFiles);
  if (areas.length > 0) {
    lines.push("## Изменённые области", "");
    for (const area of areas) lines.push(`- \`${area.area}\` — ${area.count}`);
    lines.push("");
  }

  lines.push("## Коммиты", "");
  if (options.git.commits.length === 0) {
    lines.push("Нет коммитов в окне.");
  } else {
    for (const commit of options.git.commits) {
      lines.push(`### \`${commit.shortHash}\` · ${commit.date.slice(0, 16).replace("T", " ")} · ${commit.subject}`);
      lines.push(
        `${commit.files.length} ${plural(commit.files.length, "файл", "файла", "файлов")}, изменено строк: +${commit.additions} / −${commit.deletions}`,
      );
      if (commit.files.length > 0) {
        const files = commit.files
          .slice(0, 8)
          .map((file) => `\`${file.path}\` (+${file.additions}/−${file.deletions})`);
        lines.push(files.join(", ") + (commit.files.length > 8 ? `, ещё ${commit.files.length - 8}` : ""));
      }
    }
  }
  lines.push("");

  lines.push("## Незакоммиченные изменения", "");
  if (uncommitted.length === 0) {
    lines.push("Рабочее дерево чистое.");
  } else {
    for (const file of uncommitted.slice(0, 40)) {
      lines.push(`- \`${file.status || "??"}\` ${file.path}${file.additions > 0 ? ` (+${file.additions})` : ""}`);
    }
    if (uncommitted.length > 40) lines.push(`- … и ещё ${uncommitted.length - 40}`);
  }
  lines.push("");

  lines.push("## Сессии", "");
  if (sessions.length === 0) {
    lines.push("В окне не было сессий с содержательной активностью.");
  } else {
    for (const session of sessions) {
      const timeRange = `${localTimeString(new Date(session.firstAt))}–${localTimeString(
        new Date(session.lastAt),
      )}`;
      const turns = session.turns > 0 ? `, ${session.turns} ${plural(session.turns, "ход", "хода", "ходов")}` : "";
      lines.push(
        `### «${session.title}» — ${timeRange}${turns}${session.isSubagent ? " (субагент)" : ""}`,
      );
      if (session.userMessages.length > 0) {
        lines.push("", "Запросы человека:");
        for (const message of session.userMessages.slice(0, 6)) lines.push(`- «${message}»`);
        if (session.userMessages.length > 6) lines.push(`- … и ещё ${session.userMessages.length - 6}`);
      }
      if (session.files.length > 0) {
        lines.push("", `Файлы (${session.files.length}): ${list(session.files, 15)}`);
      }
      if (session.commands.length > 0) {
        lines.push("", "Команды:");
        for (const command of session.commands.slice(0, 8)) lines.push(`- \`${command}\``);
        if (session.commands.length > 8) lines.push(`- … и ещё ${session.commands.length - 8}`);
      }
      if (session.failedCommands.length > 0) {
        lines.push("", "Ошибки в командах:");
        for (const command of session.failedCommands.slice(0, 5)) lines.push(`- \`${command}\``);
      }
      if (session.compactionSummaries.length > 0) {
        lines.push("", "Сжатые итоги прошлых ходов:");
        for (const summary of session.compactionSummaries.slice(-1)) lines.push(`- ${summary}`);
      }
      if (session.assistantNotes.length > 0) {
        lines.push("", "Итоги ассистента:");
        for (const note of session.assistantNotes.slice(-4)) lines.push(`- ${note}`);
      }
      if (session.deliverables.length > 0) {
        lines.push("", "Представленные файлы:");
        for (const deliverable of session.deliverables.slice(0, 5)) lines.push(`- ${deliverable}`);
      }
      lines.push("");
    }
  }

  lines.push("## Что сделать дальше", "");
  lines.push(
    "1. На основе дайджеста составь одну запись: **дата**, **общее название** и **описание ровно из 3 предложений**.",
  );
  lines.push(
    "2. Дата — локальная дата конца окна; название — до 60 символов, без точки; описание — до 450 символов: что сделано → что это меняет для пользователя → что дальше.",
  );
  lines.push(
    "3. Запиши JSON `{ date, title, description }` в файл и примени: `npm run changelog:apply -- --entry <файл>` (для повторного логирования того же дня добавь `--replace`).",
  );
  lines.push("4. Проверь: `npm run changelog:check` и `npm run typecheck`.");
  lines.push("");

  let markdown = lines.join("\n");
  const characters = [...markdown];
  if (characters.length > options.maxChars) {
    markdown = `${characters.slice(0, options.maxChars).join("")}\n\n… дайджест обрезан по лимиту ${options.maxChars} символов`;
  }
  return markdown;
}
