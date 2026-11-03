/**
 * Чтение сессий DSH как источника для лога обновлений.
 *
 * Сессии лежат в `~/.dsh/sessions/<workspace>/session-<id>/session.v4.jsonl.zstd`.
 * Файл — это несколько склеенных zstd-фреймов с JSONL внутри; при чтении
 * декодируем фреймы по отдельности, последний (недописанный) пропускаем.
 *
 * Нас интересует не весь транскрипт, а сигналы для отчёта: запросы человека,
 * правленые файлы, значимые команды и итоговые мысли ассистента.
 */
import fs from "node:fs";
import path from "node:path";
import { truncatePlainText, uniqueStrings, zstd } from "./shared.ts";

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const SESSION_FILE_PATTERN = /^session(?:\.v\d+)?\.jsonl\.zstd$/u;

export interface SessionEvent {
  type: string;
  seq?: number;
  time?: number;
  data?: any;
  id?: string;
  cwd?: string;
  parentSession?: string;
  delegationDepth?: number;
}

export interface SessionDigest {
  id: string;
  title: string;
  cwd: string;
  firstAt: number;
  lastAt: number;
  isSubagent: boolean;
  turns: number;
  userMessages: string[];
  assistantNotes: string[];
  files: string[];
  commands: string[];
  failedCommands: string[];
  deliverables: string[];
  compactionSummaries: string[];
}

interface SessionFile {
  filePath: string;
  mtimeMs: number;
}

export interface ExtractOptions {
  sinceMs: number;
  untilMs: number;
  workspace: string;
}

/** Разжать все целые zstd-фреймы файла сессии. */
export function decodeSessionFrames(buffer: Buffer): string[] {
  const offsets: number[] = [];
  let offset = buffer.indexOf(ZSTD_MAGIC, 0);
  while (offset !== -1) {
    offsets.push(offset);
    offset = buffer.indexOf(ZSTD_MAGIC, offset + ZSTD_MAGIC.length);
  }
  if (offsets.length === 0) throw new Error("Файл сессии не является zstd-контейнером");

  const frames: string[] = [];
  for (let index = 0; index < offsets.length; index += 1) {
    const start = offsets[index];
    if (start === undefined) continue;
    const next = offsets[index + 1];
    const chunk = buffer.subarray(start, next ?? buffer.length);
    try {
      frames.push(zstd.zstdDecompressSync(chunk).toString("utf8"));
    } catch {
      // Последний фрейм может дописываться прямо сейчас — это нормально.
    }
  }
  return frames;
}

/** Разложить текст фреймов на заголовок сессии и события. */
export function parseSessionContent(frames: string[]): { header?: SessionEvent; events: SessionEvent[] } {
  let header: SessionEvent | undefined;
  const events: SessionEvent[] = [];
  for (const frame of frames) {
    for (const line of frame.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: SessionEvent;
      try {
        event = JSON.parse(trimmed) as SessionEvent;
      } catch {
        continue;
      }
      if (event.type === "session") {
        if (!header) header = event;
        continue;
      }
      if (typeof event.time !== "number") continue;
      events.push(event);
    }
  }
  return header ? { header, events } : { events };
}

function firstFrameText(buffer: Buffer): string | undefined {
  const next = buffer.indexOf(ZSTD_MAGIC, ZSTD_MAGIC.length);
  const chunk = buffer.subarray(0, next === -1 ? buffer.length : next);
  try {
    return zstd.zstdDecompressSync(chunk).toString("utf8");
  } catch {
    return undefined;
  }
}

/** Прочитать только заголовок: по нему фильтруем чужие рабочие пространства. */
export function readSessionHeader(filePath: string): SessionEvent | undefined {
  const text = firstFrameText(fs.readFileSync(filePath));
  if (!text) return undefined;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as SessionEvent;
      if (event.type === "session") return event;
    } catch {
      continue;
    }
  }
  return undefined;
}

function findSessionFiles(sessionsRoot: string, sinceMs: number): SessionFile[] {
  let workspaceDirectories: fs.Dirent[];
  try {
    workspaceDirectories = fs.readdirSync(sessionsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: SessionFile[] = [];
  const considerFile = (filePath: string): void => {
    let stats: fs.Stats;
    try {
      stats = fs.statSync(filePath);
    } catch {
      return;
    }
    // Файл не менялся после начала окна — новых событий в нём быть не может.
    if (stats.mtimeMs < sinceMs - 1000) return;
    files.push({ filePath, mtimeMs: stats.mtimeMs });
  };

  for (const directory of workspaceDirectories) {
    if (!directory.isDirectory()) continue;
    const directoryPath = path.join(sessionsRoot, directory.name);
    let names: string[];
    try {
      names = fs.readdirSync(directoryPath);
    } catch {
      continue;
    }
    for (const name of names) {
      const entryPath = path.join(directoryPath, name);
      // Основной layout: <workspace>/session-<id>/session.v4.jsonl.zstd.
      let stats: fs.Stats | undefined;
      try {
        stats = fs.statSync(entryPath);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        let sessionNames: string[] = [];
        try {
          sessionNames = fs.readdirSync(entryPath);
        } catch {
          continue;
        }
        for (const sessionName of sessionNames) {
          if (SESSION_FILE_PATTERN.test(sessionName)) considerFile(path.join(entryPath, sessionName));
        }
        continue;
      }
      // Старый layout: файл сессии прямо в каталоге рабочего пространства.
      if (SESSION_FILE_PATTERN.test(name)) considerFile(entryPath);
    }
  }
  return files.sort((left, right) => left.mtimeMs - right.mtimeMs);
}

function parseArguments(raw: unknown): Record<string, any> {
  if (raw && typeof raw === "object") return raw as Record<string, any>;
  if (typeof raw !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, any>) : {};
  } catch {
    return {};
  }
}

const READ_ONLY_COMMAND =
  /^(ls|cat|sed|grep|rg|find|head|tail|wc|pwd|echo|which|du|df|stat|file|date|env|printenv|git\s+(status|diff|log|show|branch|rev-parse|stash\s+list))\b/u;
const NOTABLE_COMMAND =
  /(npm|npx|pnpm|yarn)\s|(^|\s)(tsc|next|node)\s|git\s+(commit|push|merge|rebase|checkout|stash|tag|reset)|release:|:validate|:build|aggregate|typecheck|\btest\b/iu;

function notableCommand(command: string): string | undefined {
  const firstLine = command.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return undefined;
  if (READ_ONLY_COMMAND.test(firstLine)) return undefined;
  if (!NOTABLE_COMMAND.test(firstLine)) return undefined;
  return truncatePlainText(firstLine, 200);
}

function extractFilePaths(toolName: string, args: Record<string, any>): string[] {
  if (toolName === "edit" || toolName === "write" || toolName === "multi_edit" || toolName === "str_replace_editor") {
    const filePath = args.file_path ?? args.path;
    return typeof filePath === "string" ? [filePath] : [];
  }
  if (toolName === "present" && Array.isArray(args.files)) {
    return args.files
      .map((file: any) => (file && typeof file.path === "string" ? file.path : null))
      .filter((value: string | null): value is string => Boolean(value));
  }
  if (toolName === "run_code" && typeof args.code === "string") {
    return [...args.code.matchAll(/file_path\s*:\s*["'`]([^"'`]+)["'`]/gu)].map((match) => match[1] ?? "");
  }
  return [];
}

function extractDeliverables(toolName: string, args: Record<string, any>): string[] {
  if (toolName !== "present" || !Array.isArray(args.files)) return [];
  return args.files
    .map((file: any) => {
      if (!file || typeof file.path !== "string") return null;
      const description = typeof file.description === "string" ? truncatePlainText(file.description, 140) : "";
      return description ? `${file.path} — ${description}` : file.path;
    })
    .filter((value: string | null): value is string => Boolean(value));
}

const NOISE_PATH = /(^|\/)(node_modules|\.next|\.git|\.changelog)(\/|$)|^figma-parity\/(scenes|preview)\/|\.tmp-/u;

function relativeToWorkspace(filePath: string, workspace: string): string {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(workspace, filePath);
  const relative = path.relative(workspace, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return filePath;
  return relative;
}

function sessionTitle(events: SessionEvent[], fallback: string): string {
  let title = "";
  for (const event of events) {
    if (event.type === "session/title" && typeof event.data?.title === "string") title = event.data.title;
  }
  return title.trim() || fallback;
}

/**
 * Вытащить из событий одной сессии всё, что попадёт в дайджест.
 * `null` — в окне не было активности, сессию можно пропустить.
 */
export function extractSessionDigest(
  header: SessionEvent | undefined,
  events: SessionEvent[],
  options: ExtractOptions,
): SessionDigest | null {
  const { sinceMs, untilMs, workspace } = options;
  const windowEvents = events.filter(
    (event) => typeof event.time === "number" && event.time >= sinceMs && event.time <= untilMs,
  );
  if (windowEvents.length === 0) return null;

  const userMessages: string[] = [];
  const assistantNotes: string[] = [];
  const files: string[] = [];
  const commands: string[] = [];
  const failedCommands: string[] = [];
  const deliverables: string[] = [];
  const compactionSummaries: string[] = [];
  const pendingCalls = new Map<string, string>();
  let turns = 0;

  for (const event of windowEvents) {
    if (event.type === "turn/start") {
      turns += 1;
      continue;
    }
    if (event.type === "user/message") {
      if (event.data?.source?.kind !== "user") continue;
      const content = event.data?.content;
      if (!Array.isArray(content)) continue;
      const text = content
        .filter((block: any) => block?.type === "text" && typeof block.text === "string")
        .map((block: any) => block.text as string)
        .join("\n");
      if (text.trim()) userMessages.push(truncatePlainText(text, 600));
      continue;
    }
    if (event.type === "assistant/message") {
      const content = event.data?.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
          assistantNotes.push(truncatePlainText(block.text, 500));
        }
      }
      continue;
    }
    if (event.type === "compaction/summary") {
      const summary = event.data?.summary;
      if (!Array.isArray(summary)) continue;
      const text = summary
        .filter((block: any) => block?.type === "text" && typeof block.text === "string")
        .map((block: any) => block.text as string)
        .join("\n");
      if (text.trim()) compactionSummaries.push(truncatePlainText(text, 800));
      continue;
    }
    if (event.type === "deliverables/presented") {
      const presented = event.data?.files;
      if (!Array.isArray(presented)) continue;
      for (const file of presented) {
        if (!file || typeof file.path !== "string") continue;
        const description = typeof file.description === "string" ? truncatePlainText(file.description, 140) : "";
        deliverables.push(description ? `${file.path} — ${description}` : file.path);
      }
      continue;
    }
    if (event.type === "tool/result") {
      const callId = String(event.data?.message?.toolCallId ?? event.data?.toolCallId ?? "");
      const isError = event.data?.message?.isError === true;
      const summary = pendingCalls.get(callId);
      if (isError && summary) failedCommands.push(summary);
      continue;
    }
    if (event.type !== "tool/call") continue;

    const toolName = String(event.data?.name ?? "");
    const callId = String(event.data?.callId ?? "");
    const args = parseArguments(event.data?.arguments);
    for (const file of extractFilePaths(toolName, args)) {
      const relative = relativeToWorkspace(file, workspace);
      if (!NOISE_PATH.test(relative)) files.push(relative);
    }
    for (const deliverable of extractDeliverables(toolName, args)) deliverables.push(deliverable);

    const command = toolName === "bash" && typeof args.command === "string" ? notableCommand(args.command) : undefined;
    const runCode = toolName === "run_code" && typeof args.description === "string" ? `run_code — ${args.description}` : undefined;
    const summary = command ?? runCode;
    if (summary) {
      commands.push(summary);
      pendingCalls.set(callId, summary);
    }
  }

  const times = windowEvents.map((event) => event.time as number);
  return {
    id: header?.id ?? "unknown",
    title: sessionTitle(events, "Сессия без названия"),
    cwd: header?.cwd ?? workspace,
    firstAt: Math.min(...times),
    lastAt: Math.max(...times),
    isSubagent: (header?.delegationDepth ?? 0) > 0,
    turns,
    userMessages: uniqueStrings(userMessages).slice(0, 20),
    assistantNotes: uniqueStrings(assistantNotes).slice(-12),
    files: uniqueStrings(files).slice(0, 60),
    commands: uniqueStrings(commands).slice(0, 30),
    failedCommands: uniqueStrings(failedCommands).slice(0, 10),
    deliverables: uniqueStrings(deliverables).slice(0, 10),
    compactionSummaries: uniqueStrings(compactionSummaries).slice(-3),
  };
}

export interface CollectSessionsOptions {
  sessionsRoot: string;
  workspace: string;
  sinceMs: number;
  untilMs: number;
}

/** Найти сессии этого рабочего пространства и собрать по ним дайджесты. */
export function collectSessions(options: CollectSessionsOptions): SessionDigest[] {
  if (typeof zstd.zstdDecompressSync !== "function") {
    throw new Error("Для чтения сессий DSH нужен Node 24+ (zlib.zstdDecompressSync)");
  }
  const workspacePath = path.resolve(options.workspace);
  const digests: SessionDigest[] = [];
  for (const file of findSessionFiles(options.sessionsRoot, options.sinceMs)) {
    const header = readSessionHeader(file.filePath);
    if (!header?.cwd || path.resolve(header.cwd) !== workspacePath) continue;

    let frames: string[];
    try {
      frames = decodeSessionFrames(fs.readFileSync(file.filePath));
    } catch {
      continue;
    }
    const parsed = parseSessionContent(frames);
    const digest = extractSessionDigest(parsed.header ?? header, parsed.events, {
      sinceMs: options.sinceMs,
      untilMs: options.untilMs,
      workspace: workspacePath,
    });
    if (digest) digests.push(digest);
  }
  return digests.sort((left, right) => left.firstAt - right.firstAt);
}
