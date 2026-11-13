import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseChangelog,
  renderChangelog,
  splitSentences,
  upsertEntry,
  validateEntries,
  validateEntry,
  type ChangelogEntry,
} from "../scripts/changelog/changelog-file.ts";
import {
  collectSessions,
  decodeSessionFrames,
  extractSessionDigest,
  parseSessionContent,
} from "../scripts/changelog/sessions.ts";
import { zstd } from "../scripts/changelog/shared.ts";
import { resolveWindow, writeState } from "../scripts/changelog/window.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories: string[] = [];

after(() => {
  for (const directory of temporaryDirectories) fs.rmSync(directory, { recursive: true, force: true });
});

function makeTempDirectory(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

const VALID_ENTRY: ChangelogEntry = {
  date: "2026-11-03",
  title: "Лог обновлений и агент",
  description: "Собрали агент лога обновлений. Теперь изменения за день попадают в блок на главной. Дальше будем запускать его после каждой рабочей сессии.",
};

function changelogSource(entries: string): string {
  return [
    "/** Тестовый лог. */",
    "export interface ChangelogEntry {",
    "  date: string;",
    "  title: string;",
    "  description: string;",
    "}",
    "",
    "const ENTRIES: ChangelogEntry[] = [",
    entries,
    "];",
    "",
    "export function latestChangelog(): ChangelogEntry[] {",
    "  return [...ENTRIES];",
    "}",
    "",
  ].join("\n");
}

function entrySource(entry: ChangelogEntry): string {
  return [
    "  {",
    `    date: "${entry.date}",`,
    `    title: "${entry.title}",`,
    "    description:",
    `      "${entry.description}",`,
    "  },",
  ].join("\n");
}

function packSessionFrames(lines: string[], frameCount = 2): Buffer {
  const frames: Buffer[] = [];
  const perFrame = Math.max(1, Math.ceil(lines.length / frameCount));
  for (let index = 0; index < lines.length; index += perFrame) {
    const chunk = lines.slice(index, index + perFrame).join("\n") + "\n";
    frames.push(zstd.zstdCompressSync(Buffer.from(chunk, "utf8")));
  }
  return Buffer.concat(frames);
}

interface SessionFixture {
  workspace: string;
  lines: string[];
}

function sessionFixture(workspace: string, baseTime: number): SessionFixture {
  return {
    workspace,
    lines: [
      JSON.stringify({ type: "session", version: 4, id: "session-test", createdAt: baseTime, cwd: workspace, delegationDepth: 0 }),
      JSON.stringify({ type: "session/title", time: baseTime + 1_000, data: { title: "Тестовая сессия" } }),
      JSON.stringify({ type: "turn/start", time: baseTime + 1_000, data: { turn: 1 } }),
      JSON.stringify({
        type: "user/message",
        time: baseTime + 2_000,
        data: { role: "user", source: { kind: "user" }, content: [{ type: "text", text: "Сделай блок лога на главной." }] },
      }),
      JSON.stringify({
        type: "user/message",
        time: baseTime + 2_500,
        data: {
          role: "user",
          source: { kind: "agent-instructions" },
          content: [{ type: "text", text: "<system-reminder>не считай это запросом человека</system-reminder>" }],
        },
      }),
      JSON.stringify({
        type: "assistant/message",
        time: baseTime + 3_000,
        data: {
          message: {
            role: "assistant",
            content: [
              { type: "reasoning", text: "думаю" },
              { type: "text", text: "Собираю дайджест по сессиям." },
            ],
          },
        },
      }),
      JSON.stringify({
        type: "tool/call",
        time: baseTime + 4_000,
        data: { callId: "call-edit", name: "edit", arguments: JSON.stringify({ file_path: "scripts/changelog/collect.ts" }) },
      }),
      JSON.stringify({
        type: "tool/result",
        time: baseTime + 4_100,
        data: { message: { role: "tool", toolCallId: "call-edit", isError: false } },
      }),
      JSON.stringify({
        type: "tool/call",
        time: baseTime + 5_000,
        data: { callId: "call-run-code", name: "run_code", arguments: JSON.stringify({ code: 'await tools.write({ file_path: "scripts/changelog/render.ts", content: "..." });', description: "Написать рендер" }) },
      }),
      JSON.stringify({
        type: "tool/call",
        time: baseTime + 6_000,
        data: { callId: "call-bash", name: "bash", arguments: JSON.stringify({ command: "npm run typecheck", description: "Проверка типов" }) },
      }),
      JSON.stringify({
        type: "tool/result",
        time: baseTime + 6_100,
        data: { message: { role: "tool", toolCallId: "call-bash", isError: true } },
      }),
      JSON.stringify({
        type: "deliverables/presented",
        time: baseTime + 7_000,
        data: { files: [{ path: "docs/12-release/report.md", description: "Отчёт" }] },
      }),
    ],
  };
}

describe("changelog file", () => {
  it("разбирает и собирает файл байт в байт", () => {
    const source = fs.readFileSync(path.join(repoRoot, "apps/web/src/content/changelog.ts"), "utf8");
    const entries = parseChangelog(source);
    assert.ok(entries.length >= 3);
    assert.equal(renderChangelog(source, entries), source);
    assert.deepEqual(validateEntries(entries), []);
  });

  it("принимает запись с тремя предложениями", () => {
    assert.deepEqual(validateEntry(VALID_ENTRY), []);
  });

  it("требует ровно три предложения, короткое название и корректную дату", () => {
    const two = validateEntry({ ...VALID_ENTRY, description: "Только одно предложение. И второе." });
    assert.ok(two.some((error) => error.includes("3 предложения")), two.join("; "));

    const longTitle = validateEntry({ ...VALID_ENTRY, title: "Я".repeat(61) });
    assert.ok(longTitle.some((error) => error.includes("не длиннее")));

    const dotTitle = validateEntry({ ...VALID_ENTRY, title: "Лог обновлений." });
    assert.ok(dotTitle.some((error) => error.includes("без точки")));

    const badDate = validateEntry({ ...VALID_ENTRY, date: "2026-13-01" });
    assert.ok(badDate.some((error) => error.includes("YYYY-MM-DD")));

    const longDescription = validateEntry({
      ...VALID_ENTRY,
      description: `${"А".repeat(152)}. ${"Б".repeat(152)}. ${"В".repeat(152)}.`,
    });
    assert.ok(longDescription.some((error) => error.includes("не длиннее 450")));
  });

  it("не считает сокращения и инициалы концом предложения", () => {
    // Сокращение в середине предложения не создаёт границу.
    assert.equal(splitSentences("Сделали раз, два и т. д. и поехали дальше. Потом ещё. Готово.").length, 3);
    assert.equal(splitSentences("Проверил А. С. Пушкина. Всё.").length, 2);
    // Аббревиатура в конце предложения — не инициал: граница сохраняется.
    assert.equal(splitSentences("Сделали выгрузку в CSV и PDF. Потом проверили.").length, 2);
    assert.deepEqual(splitSentences(""), []);
  });

  it("вставляет новую запись и заменяет запись за ту же дату", () => {
    const entries: ChangelogEntry[] = [
      { ...VALID_ENTRY, date: "2026-11-02", title: "Старая" },
      { ...VALID_ENTRY, date: "2026-11-01", title: "Ещё старая" },
    ];
    const inserted = upsertEntry(entries, { ...VALID_ENTRY, date: "2026-11-03" });
    assert.equal(inserted.action, "inserted");
    assert.equal(inserted.entries[0]?.date, "2026-11-03");

    const replaced = upsertEntry(entries, { ...entries[0]!, title: "Обновлённая" }, { replace: true });
    assert.equal(replaced.action, "replaced");
    assert.equal(replaced.entries[0]?.title, "Обновлённая");
    assert.equal(replaced.entries.length, 2);

    assert.throws(() => upsertEntry(entries, entries[0]!), /--replace/);
  });
});

describe("session digest", () => {
  it("декодирует склеенные zstd-фреймы и фильтрует окно", () => {
    const workspace = makeTempDirectory("cos-changelog-workspace-");
    const baseTime = Date.now() - 60_000;
    const fixture = sessionFixture(workspace, baseTime);
    const buffer = packSessionFrames(fixture.lines, 2);

    const frames = decodeSessionFrames(buffer);
    assert.equal(frames.length, 2);

    const parsed = parseSessionContent(frames);
    assert.equal(parsed.header?.cwd, workspace);
    assert.ok(parsed.events.length >= 10);

    const digest = extractSessionDigest(parsed.header, parsed.events, {
      sinceMs: baseTime,
      untilMs: baseTime + 30_000,
      workspace,
    });
    assert.ok(digest);
    assert.equal(digest.title, "Тестовая сессия");
    assert.deepEqual(digest.userMessages, ["Сделай блок лога на главной."]);
    assert.ok(digest.files.includes("scripts/changelog/collect.ts"));
    assert.ok(digest.files.includes("scripts/changelog/render.ts"));
    assert.ok(digest.commands.some((command) => command.includes("npm run typecheck")));
    assert.deepEqual(digest.failedCommands, ["npm run typecheck"]);
    assert.ok(digest.assistantNotes.some((note) => note.includes("Собираю дайджест")));
    assert.equal(digest.turns, 1);

    const outsideWindow = extractSessionDigest(parsed.header, parsed.events, {
      sinceMs: baseTime + 40_000,
      untilMs: baseTime + 50_000,
      workspace,
    });
    assert.equal(outsideWindow, null);
  });

  it("находит сессии только этого рабочего пространства", () => {
    const workspace = makeTempDirectory("cos-changelog-workspace-");
    const otherWorkspace = makeTempDirectory("cos-changelog-other-");
    const sessionsRoot = makeTempDirectory("cos-changelog-sessions-");
    const baseTime = Date.now() - 60_000;

    for (const [name, fixture] of [
      ["session-local", sessionFixture(workspace, baseTime)],
      ["session-foreign", sessionFixture(otherWorkspace, baseTime)],
    ] as const) {
      const directory = path.join(sessionsRoot, name);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "session.v4.jsonl.zstd"), packSessionFrames(fixture.lines, 2));
    }

    const digests = collectSessions({
      sessionsRoot,
      workspace,
      sinceMs: baseTime,
      untilMs: baseTime + 30_000,
    });
    assert.equal(digests.length, 1);
    assert.equal(digests[0]?.title, "Тестовая сессия");
  });
});

describe("logging window", () => {
  it("берёт начало окна из state.json", () => {
    const directory = makeTempDirectory("cos-changelog-window-");
    const statePath = path.join(directory, "state.json");
    const since = new Date("2026-11-03T18:00:00+03:00");
    writeState(statePath, { lastLoggedAt: since.toISOString(), lastEntryDate: "2026-11-03", entries: 3 });

    const resolved = resolveWindow({
      statePath,
      changelogPath: path.join(directory, "missing-changelog.ts"),
      cwd: directory,
      until: new Date("2026-11-03T20:00:00+03:00"),
    });
    assert.equal(resolved.since.getTime(), since.getTime());
    assert.match(resolved.source, /state\.json/);
  });

  it("без state.json отталкивается от начала дня последней записи", () => {
    const directory = makeTempDirectory("cos-changelog-window-");
    const changelogPath = path.join(directory, "changelog.ts");
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const entry = { ...VALID_ENTRY, date: todayIso };
    fs.writeFileSync(changelogPath, changelogSource(entrySource(entry)), "utf8");

    const until = new Date(Date.now() + 86_400_000);
    const resolved = resolveWindow({
      statePath: path.join(directory, "missing-state.json"),
      changelogPath,
      cwd: directory,
      until,
    });
    assert.equal(
      resolved.since.getTime(),
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
    );
  });
});

describe("changelog CLI", () => {
  it("применяет запись и обновляет state.json", () => {
    const directory = makeTempDirectory("cos-changelog-apply-");
    const changelogPath = path.join(directory, "changelog.ts");
    const entryPath = path.join(directory, "entry.json");
    const statePath = path.join(directory, "state.json");
    fs.writeFileSync(
      changelogPath,
      changelogSource(entrySource({ ...VALID_ENTRY, date: "2026-11-02", title: "Предыдущая" })),
      "utf8",
    );
    fs.writeFileSync(entryPath, JSON.stringify(VALID_ENTRY), "utf8");

    const until = "2026-11-03T19:30:00+03:00";
    const output = execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        path.join(repoRoot, "scripts/changelog/apply.ts"),
        "--entry",
        entryPath,
        "--changelog",
        changelogPath,
        "--state",
        statePath,
        "--until",
        until,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.match(output, /Добавлена запись/);
    assert.match(fs.readFileSync(changelogPath, "utf8"), /Лог обновлений и агент/);

    const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as { lastLoggedAt: string };
    assert.equal(state.lastLoggedAt, new Date(until).toISOString());

    assert.throws(() =>
      execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(repoRoot, "scripts/changelog/apply.ts"),
          "--entry",
          entryPath,
          "--changelog",
          changelogPath,
          "--state",
          statePath,
        ],
        { cwd: repoRoot, encoding: "utf8", stdio: "pipe" },
      ),
    );

    const replaced = execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        path.join(repoRoot, "scripts/changelog/apply.ts"),
        "--entry",
        entryPath,
        "--changelog",
        changelogPath,
        "--state",
        statePath,
        "--replace",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.match(replaced, /Заменена запись/);
    assert.equal(parseChangelog(fs.readFileSync(changelogPath, "utf8")).length, 2);
  });

  it("собирает дайджест из тестовой сессии", () => {
    const directory = makeTempDirectory("cos-changelog-collect-");
    const workspace = path.join(directory, "workspace");
    const sessionsRoot = path.join(directory, "sessions");
    const outPath = path.join(directory, "digest.md");
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(path.join(sessionsRoot, "session-test"), { recursive: true });

    const baseTime = Date.now() - 60_000;
    const fixture = sessionFixture(workspace, baseTime);
    fs.writeFileSync(
      path.join(sessionsRoot, "session-test", "session.v4.jsonl.zstd"),
      packSessionFrames(fixture.lines, 2),
    );

    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        path.join(repoRoot, "scripts/changelog/collect.ts"),
        "--sessions-root",
        sessionsRoot,
        "--workspace",
        workspace,
        "--since",
        new Date(baseTime - 60_000).toISOString(),
        "--until",
        new Date(baseTime + 60_000).toISOString(),
        "--no-git",
        "--out",
        outPath,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );

    const digest = fs.readFileSync(outPath, "utf8");
    assert.match(digest, /Тестовая сессия/);
    assert.match(digest, /Сделай блок лога на главной/);
    assert.match(digest, /scripts\/changelog\/collect\.ts/);
    assert.doesNotMatch(digest, /не считай это запросом человека/);
  });
});
