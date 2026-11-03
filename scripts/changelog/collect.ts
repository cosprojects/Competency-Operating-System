/**
 * Шаг 1 агента лога: собрать дайджест работы с момента последнего логирования.
 *
 *   npm run changelog:collect
 *   npm run changelog:collect -- --since 2026-11-01 --stdout
 *
 * Источники: сессии DSH этого рабочего пространства + git (коммиты и
 * незакоммиченные изменения). Результат — markdown-файл в `.changelog/`,
 * который агент читает и превращает в одну запись.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readGitDigest, type GitDigest } from "./git.ts";
import { meaningfulSession, renderDigest } from "./render.ts";
import { collectSessions } from "./sessions.ts";
import { resolveWindow } from "./window.ts";
import {
  flagValue,
  hasFlag,
  localDateString,
  localDateTimeString,
  localTimeString,
  parseDateArgument,
  parseFlags,
  projectRoot,
  uniqueStrings,
} from "./shared.ts";

const HELP = `Дайджест работы для лога обновлений.

Использование:
  npm run changelog:collect -- [флаги]

Флаги:
  --since <ISO|YYYY-MM-DD>  начало окна (по умолчанию — с последнего логирования)
  --until <ISO|YYYY-MM-DD>  конец окна (по умолчанию — сейчас)
  --workspace <path>        рабочее пространство (по умолчанию — корень репозитория)
  --sessions-root <path>    хранилище сессий DSH (по умолчанию ~/.dsh/sessions)
  --changelog <path>        файл лога (для определения точки отсчёта)
  --state <path>            state.json агента
  --out <path>              куда писать дайджест
  --stdout                  вывести дайджест в консоль, не писать файл
  --no-git                  не читать git
  --max-chars <N>           лимит длины дайджеста (по умолчанию 60000)
  --help                    эта справка

Примеры:
  npm run changelog:collect
  npm run changelog:collect -- --stdout
  npm run changelog:collect -- --since 2026-11-01 --until 2026-11-03
`;

function emptyGitDigest(): GitDigest {
  return { available: false, branch: "", commits: [], uncommitted: [], diff: { files: 0, additions: 0, deletions: 0 } };
}

/** Незакоммиченные файлы фильтруем по mtime: старые правки не относятся к окну. */
function filterUncommittedByWindow(git: GitDigest, workspace: string, sinceMs: number): GitDigest {
  const uncommitted = git.uncommitted.filter((file) => {
    if (/(^|\/)\.tmp-|(^|\/)\.DS_Store$|(^|\/)\.changelog(\/|$)/u.test(file.path)) return false;
    const absolute = path.resolve(workspace, file.path);
    try {
      return fs.statSync(absolute).mtimeMs >= sinceMs - 1000;
    } catch {
      // Удалённый или переименованный файл — оставляем, он относится к работе.
      return file.status.includes("D");
    }
  });
  const diff = uncommitted.reduce(
    (total, file) => ({
      files: total.files + 1,
      additions: total.additions + file.additions,
      deletions: total.deletions + file.deletions,
    }),
    { files: 0, additions: 0, deletions: 0 },
  );
  return { ...git, uncommitted, diff };
}

function main(): void {
  const argv = process.argv.slice(2);
  const flags = parseFlags(argv);
  if (hasFlag(flags, "help") || hasFlag(flags, "h")) {
    console.log(HELP);
    return;
  }

  const root = projectRoot();
  const workspace = path.resolve(flagValue(flags, "workspace") ?? root);
  const sessionsRoot =
    flagValue(flags, "sessions-root") ??
    process.env.DSH_SESSIONS_DIR ??
    path.join(os.homedir(), ".dsh", "sessions");
  const changelogPath = flagValue(flags, "changelog") ?? path.join(root, "apps/web/src/content/changelog.ts");
  const statePath = flagValue(flags, "state") ?? path.join(root, ".changelog", "state.json");

  const untilRaw = flagValue(flags, "until");
  const until = untilRaw ? parseDateArgument(untilRaw, "--until") : new Date();

  let since: Date;
  let sinceSource: string;
  const sinceRaw = flagValue(flags, "since");
  if (sinceRaw) {
    since = parseDateArgument(sinceRaw, "--since");
    sinceSource = "указано вручную через --since";
  } else {
    const resolved = resolveWindow({ statePath, changelogPath, cwd: workspace, until });
    since = resolved.since;
    sinceSource = resolved.source;
  }
  if (since.getTime() >= until.getTime()) {
    throw new Error(`Начало окна (${localDateTimeString(since)}) не раньше конца (${localDateTimeString(until)})`);
  }

  const sessions = collectSessions({
    sessionsRoot,
    workspace,
    sinceMs: since.getTime(),
    untilMs: until.getTime(),
  });
  const rawGit = hasFlag(flags, "no-git") ? emptyGitDigest() : readGitDigest(workspace, since, until);
  const git = rawGit.available ? filterUncommittedByWindow(rawGit, workspace, since.getTime()) : rawGit;

  const maxCharsRaw = Number.parseInt(flagValue(flags, "max-chars") ?? "", 10);
  const maxChars = Number.isFinite(maxCharsRaw) && maxCharsRaw > 0 ? maxCharsRaw : 60_000;

  const markdown = renderDigest({ since, until, sinceSource, workspace, sessions, git, maxChars });
  const meaningful = sessions.filter(meaningfulSession);

  if (hasFlag(flags, "stdout")) {
    console.log(markdown);
    console.error(
      `Период: ${localDateTimeString(since)} → ${localDateTimeString(until)} · сессий: ${meaningful.length} · коммитов: ${git.commits.length}`,
    );
    return;
  }

  const outPath = path.resolve(
    workspace,
    flagValue(flags, "out") ??
      path.join(".changelog", `digest-${localDateString(until)}-${localTimeString(until).replace(":", "")}.md`),
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, markdown, "utf8");

  console.log(`Дайджест: ${outPath}`);
  console.log(`Период: ${localDateTimeString(since)} → ${localDateTimeString(until)}`);
  console.log(`Источник начала: ${sinceSource}`);
  console.log(`Для apply передай то же окно: --until ${until.toISOString()}`);
  console.log(
    `Сессии: ${meaningful.length} · запросы: ${uniqueStrings(meaningful.flatMap((session) => session.userMessages)).length} · файлы: ${uniqueStrings(meaningful.flatMap((session) => session.files)).length} · команды: ${uniqueStrings(meaningful.flatMap((session) => session.commands)).length}`,
  );
  console.log(
    `Git: коммитов ${git.commits.length} · незакоммиченных ${git.uncommitted.length}${
      git.diff.files > 0 ? ` (+${git.diff.additions}/−${git.diff.deletions})` : ""
    }`,
  );
  if (meaningful.length === 0 && git.commits.length === 0 && git.uncommitted.length === 0 && git.diff.files === 0) {
    console.log("Изменений нет — запись создавать не нужно.");
  } else {
    console.log("Прочитай дайджест, составь запись и примени её через npm run changelog:apply.");
  }
}

try {
  main();
} catch (error: unknown) {
  console.error(`changelog:collect: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
