/**
 * Окно логирования: с момента последнего логирования до запрошенного времени.
 *
 * Основная точка отсчёта — `.changelog/state.json`, который пишет apply после
 * успешной записи. Если состояния ещё нет (первый запуск), берём более позднее
 * из двух: начало дня последней записи и время коммита, добавившего запись.
 * Время изменения файла намеренно не используем: его трогает и сам агент.
 */
import fs from "node:fs";
import path from "node:path";
import { latestEntryDate, readChangelog } from "./changelog-file.ts";
import { lastCommitIsoForPath } from "./git.ts";
import { localDateString, localDateTimeString, parseDateArgument } from "./shared.ts";

export interface LogState {
  lastLoggedAt: string;
  lastEntryDate?: string;
  entries?: number;
  updatedAt?: string;
}

export function readState(filePath: string): LogState | undefined {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object") return undefined;
    const state = parsed as LogState;
    if (typeof state.lastLoggedAt !== "string" || Number.isNaN(new Date(state.lastLoggedAt).getTime())) return undefined;
    return state;
  } catch {
    return undefined;
  }
}

export function writeState(filePath: string, state: LogState): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export interface ResolveWindowOptions {
  statePath: string;
  changelogPath: string;
  cwd: string;
  until: Date;
}

export interface ResolveWindowResult {
  since: Date;
  source: string;
  state?: LogState;
}

function startOfLocalDay(isoDate: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(isoDate)) return undefined;
  const date = parseDateArgument(isoDate, "последняя запись");
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function resolveWindow(options: ResolveWindowOptions): ResolveWindowResult {
  const state = readState(options.statePath);
  if (state) {
    const since = new Date(state.lastLoggedAt);
    if (since.getTime() < options.until.getTime()) {
      return {
        since,
        source: `state.json — последнее логирование ${localDateTimeString(since)}`,
        state,
      };
    }
    throw new Error(
      `state.json указывает на будущее (${state.lastLoggedAt}) относительно конца окна ${localDateTimeString(
        options.until,
      )}. Укажи --since вручную или поправь state.`,
    );
  }

  const entries = readChangelog(options.changelogPath);
  const lastDate = latestEntryDate(entries);
  const dayStart = startOfLocalDay(lastDate);
  if (!dayStart) throw new Error(`Не удалось определить дату последней записи (${lastDate})`);

  const candidates: Array<{ at: Date; label: string }> = [
    { at: dayStart, label: `начало дня последней записи ${lastDate}` },
  ];
  const commitIso = lastCommitIsoForPath(options.cwd, path.relative(options.cwd, options.changelogPath));
  if (commitIso) {
    candidates.push({ at: new Date(commitIso), label: "коммит, добавивший последнюю запись" });
  }
  const valid = candidates.filter((candidate) => candidate.at.getTime() < options.until.getTime());
  const best = valid.sort((left, right) => right.at.getTime() - left.at.getTime())[0] ?? candidates[0];
  if (!best) throw new Error("Не удалось определить начало окна");
  return {
    since: best.at,
    source: `${best.label} (${localDateTimeString(best.at)}), state.json ещё нет`,
  };
}

/** Состояние после записи: до какого момента считаем работу залогированной. */
export function stateAfterLog(until: Date, lastEntryDate: string, entries: number): LogState {
  return {
    lastLoggedAt: until.toISOString(),
    lastEntryDate,
    entries,
    updatedAt: new Date().toISOString(),
  };
}

/** Человекочитаемая дата записи для отчёта агента. */
export function entryDateForWindow(until: Date): string {
  return localDateString(until);
}
