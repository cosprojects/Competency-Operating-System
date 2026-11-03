/**
 * Git как вторая опора дайджеста: сессии говорят «что задумывали», а git —
 * «что реально изменилось». Используем только чтение, без побочных эффектов.
 */
import { execFileSync } from "node:child_process";

export interface GitCommitFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  date: string;
  subject: string;
  files: GitCommitFile[];
  additions: number;
  deletions: number;
}

export interface UncommittedFile {
  status: string;
  path: string;
  additions: number;
  deletions: number;
}

export interface GitDigest {
  available: boolean;
  branch: string;
  commits: GitCommit[];
  uncommitted: UncommittedFile[];
  diff: { files: number; additions: number; deletions: number };
}

function git(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).trimEnd();
  } catch {
    return undefined;
  }
}

function parseNumstat(output: string | undefined): { files: GitCommitFile[]; additions: number; deletions: number } {
  const files: GitCommitFile[] = [];
  let additions = 0;
  let deletions = 0;
  if (!output) return { files, additions, deletions };
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const [addedRaw, deletedRaw, ...pathParts] = line.split("\t");
    const filePath = pathParts.join("\t");
    if (!filePath) continue;
    const added = Number.parseInt(addedRaw ?? "", 10);
    const deleted = Number.parseInt(deletedRaw ?? "", 10);
    files.push({
      path: filePath,
      additions: Number.isFinite(added) ? added : 0,
      deletions: Number.isFinite(deleted) ? deleted : 0,
    });
    if (Number.isFinite(added)) additions += added;
    if (Number.isFinite(deleted)) deletions += deleted;
  }
  return { files, additions, deletions };
}

function parseCommits(output: string | undefined): GitCommit[] {
  const commits: GitCommit[] = [];
  if (!output) return commits;
  let current: GitCommit | undefined;
  for (const line of output.split("\n")) {
    if (line.startsWith("\u001e")) {
      const [hash = "", shortHash = "", date = "", subject = ""] = line.slice(1).split("\u001f");
      current = { hash, shortHash, date, subject, files: [], additions: 0, deletions: 0 };
      commits.push(current);
      continue;
    }
    if (!current || !line.trim()) continue;
    const parsed = parseNumstat(line);
    current.files.push(...parsed.files);
    current.additions += parsed.additions;
    current.deletions += parsed.deletions;
  }
  return commits;
}

function parseStatus(
  output: string | undefined,
  stats: Map<string, { additions: number; deletions: number }>,
): UncommittedFile[] {
  if (!output) return [];
  const files: UncommittedFile[] = [];
  for (const line of output.split("\n")) {
    if (line.length < 4) continue;
    const filePath = line.slice(3).trim();
    const extra = stats.get(filePath) ?? { additions: 0, deletions: 0 };
    files.push({
      status: line.slice(0, 2).trim() || "??",
      path: filePath,
      additions: extra.additions,
      deletions: extra.deletions,
    });
  }
  return files;
}

/** Снимок git за окно: коммиты, незакоммиченные файлы и суммарный diff. */
export function readGitDigest(cwd: string, since: Date, until: Date): GitDigest {
  const inside = git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  if (inside !== "true") {
    return { available: false, branch: "", commits: [], uncommitted: [], diff: { files: 0, additions: 0, deletions: 0 } };
  }
  const branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) ?? "";
  const log = git(cwd, [
    "log",
    `--since=${since.toISOString()}`,
    `--until=${until.toISOString()}`,
    "--numstat",
    "--pretty=format:%x1e%H%x1f%h%x1f%aI%x1f%s",
  ]);
  const commits = parseCommits(log).sort((left, right) => left.date.localeCompare(right.date));

  const unstaged = parseNumstat(git(cwd, ["diff", "--numstat"]));
  const staged = parseNumstat(git(cwd, ["diff", "--cached", "--numstat"]));
  const uncommittedStats = new Map<string, { additions: number; deletions: number }>();
  for (const file of [...unstaged.files, ...staged.files]) {
    const previous = uncommittedStats.get(file.path) ?? { additions: 0, deletions: 0 };
    uncommittedStats.set(file.path, {
      additions: previous.additions + file.additions,
      deletions: previous.deletions + file.deletions,
    });
  }
  const uncommitted = parseStatus(git(cwd, ["status", "--porcelain=v1"]), uncommittedStats);
  const changedPaths = new Set<string>([...unstaged.files, ...staged.files].map((file) => file.path));
  const diff = {
    files: changedPaths.size,
    additions: unstaged.additions + staged.additions,
    deletions: unstaged.deletions + staged.deletions,
  };
  return { available: true, branch, commits, uncommitted, diff };
}

/** Когда последний раз коммитили файл — запасная точка отсчёта логирования. */
export function lastCommitIsoForPath(cwd: string, relativePath: string): string | undefined {
  const output = git(cwd, ["log", "-1", "--format=%aI", "--", relativePath]);
  return output?.trim() || undefined;
}
