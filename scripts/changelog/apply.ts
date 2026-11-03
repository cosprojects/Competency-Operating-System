/**
 * Шаг 2 агента лога: применить запись к `changelog.ts`.
 *
 *   npm run changelog:apply -- --entry .changelog/entry.json
 *   npm run changelog:apply -- --entry .changelog/entry.json --replace
 *   npm run changelog:apply -- --check
 *
 * `--check` ничего не меняет: проверяет весь файл на контракт лога.
 */
import fs from "node:fs";
import path from "node:path";
import {
  latestEntryDate,
  parseChangelog,
  readChangelog,
  renderChangelog,
  splitSentences,
  upsertEntry,
  validateEntries,
  validateEntry,
  type ChangelogEntry,
} from "./changelog-file.ts";
import { readState, stateAfterLog, writeState } from "./window.ts";
import {
  flagValue,
  hasFlag,
  localDateTimeString,
  parseDateArgument,
  parseFlags,
  projectRoot,
  truncatePlainText,
} from "./shared.ts";

const HELP = `Запись в лог обновлений.

Использование:
  npm run changelog:apply -- --entry <json> [флаги]
  npm run changelog:apply -- --check

Флаги:
  --entry <path|->       JSON-файл записи { date, title, description }; "-" читает stdin
  --replace              заменить запись за ту же дату (повторное логирование дня)
  --check                проверить changelog.ts и ничего не менять
  --dry-run              показать, что будет записано, не меняя файлы
  --changelog <path>     путь к changelog.ts
  --state <path>         путь к state.json
  --until <ISO>          конец окна логирования (пишется в state.json)
  --no-state             не обновлять state.json
  --help                 эта справка

Пример entry.json:
  { "date": "2026-11-03", "title": "Главная и лог обновлений", "description": "..." }
`;

function readEntry(argvFlags: ReturnType<typeof parseFlags>): ChangelogEntry {
  const entryPath = flagValue(argvFlags, "entry");
  if (!entryPath) throw new Error("нужен --entry <файл.json> (или --check)");
  const raw = entryPath === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(path.resolve(entryPath), "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${entryPath}: это не JSON`);
  }
  if (!parsed || typeof parsed !== "object") throw new Error(`${entryPath}: ожидался объект { date, title, description }`);
  const value = parsed as Record<string, unknown>;
  for (const field of ["date", "title", "description"] as const) {
    if (typeof value[field] !== "string") throw new Error(`${entryPath}: поле ${field} должно быть строкой`);
  }
  return { date: value.date as string, title: value.title as string, description: value.description as string };
}

function printCheck(entries: ChangelogEntry[]): boolean {
  const errors = validateEntries(entries);
  console.log(`Записей: ${entries.length}`);
  for (const entry of entries) {
    const sentences = splitSentences(entry.description).length;
    const descriptionLength = [...entry.description].length;
    console.log(
      `- ${entry.date} · «${truncatePlainText(entry.title, 60)}» · ${sentences} предл., ${descriptionLength} симв.`,
    );
  }
  if (errors.length === 0) {
    console.log("Контракт лога соблюдён.");
    return true;
  }
  console.error(`Найдено ошибок: ${errors.length}`);
  for (const error of errors) console.error(`- ${error}`);
  return false;
}

function main(): void {
  const argv = process.argv.slice(2);
  const flags = parseFlags(argv);
  if (hasFlag(flags, "help") || hasFlag(flags, "h")) {
    console.log(HELP);
    return;
  }

  const root = projectRoot();
  const changelogPath = path.resolve(flagValue(flags, "changelog") ?? path.join(root, "apps/web/src/content/changelog.ts"));
  const statePath = path.resolve(flagValue(flags, "state") ?? path.join(root, ".changelog", "state.json"));
  const sourceStats = fs.statSync(changelogPath);
  const source = fs.readFileSync(changelogPath, "utf8");
  const entries = parseChangelog(source);

  if (hasFlag(flags, "check")) {
    if (!printCheck(entries)) process.exitCode = 1;
    return;
  }

  const entry = readEntry(flags);
  const entryErrors = validateEntry(entry);
  if (entryErrors.length > 0) {
    console.error("Запись не прошла проверку:");
    for (const error of entryErrors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const replace = hasFlag(flags, "replace");
  const { entries: nextEntries, action } = upsertEntry(entries, entry, { replace });

  // Проверяем итоговый файл целиком до записи: старые записи тоже должны быть валидны.
  const rendered = renderChangelog(source, nextEntries);
  const reparsed = parseChangelog(rendered);
  const renderedErrors = validateEntries(reparsed);
  if (renderedErrors.length > 0) {
    console.error("Итоговый файл не прошёл проверку:");
    for (const error of renderedErrors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  if (hasFlag(flags, "dry-run")) {
    console.log(`dry-run: ${action === "inserted" ? "добавили бы" : "заменили бы"} запись за ${entry.date}`);
    console.log(`«${entry.title}»`);
    console.log(entry.description);
    console.log(`Всего записей стало бы: ${nextEntries.length}`);
    return;
  }

  // Параллельные сессии тоже пишут в changelog.ts: не затираем чужие правки.
  const currentStats = fs.statSync(changelogPath);
  if (currentStats.mtimeMs !== sourceStats.mtimeMs) {
    throw new Error("changelog.ts изменился во время применения записи. Прочитай файл заново и повтори apply");
  }
  fs.writeFileSync(changelogPath, rendered, "utf8");

  const untilRaw = flagValue(flags, "until");
  const until = untilRaw ? parseDateArgument(untilRaw, "--until") : new Date();
  if (!untilRaw) {
    console.warn(
      "Внимание: --until не указан, в state.json попадёт текущее время. Передавай конец окна из дайджеста, иначе события между сборкой и записью потеряются.",
    );
  }
  if (!hasFlag(flags, "no-state")) {
    const previous = readState(statePath);
    const previousTime = previous ? new Date(previous.lastLoggedAt).getTime() : Number.NEGATIVE_INFINITY;
    if (until.getTime() <= previousTime) {
      console.warn(
        `state.json не двигаю назад: текущее состояние ${previous?.lastLoggedAt}, окно заканчивается ${until.toISOString()}`,
      );
    } else {
      writeState(statePath, stateAfterLog(until, latestEntryDate(nextEntries), nextEntries.length));
    }
  }

  console.log(
    `${action === "inserted" ? "Добавлена" : "Заменена"} запись за ${entry.date}: «${entry.title}».`,
  );
  console.log(`Всего записей: ${nextEntries.length}. Файл: ${path.relative(root, changelogPath)}`);
  if (!hasFlag(flags, "no-state")) {
    console.log(`Состояние: ${path.relative(root, statePath)} · последнее логирование ${localDateTimeString(until)}`);
  }
}

try {
  main();
} catch (error: unknown) {
  console.error(`changelog:apply: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
