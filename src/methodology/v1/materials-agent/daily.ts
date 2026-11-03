import {
  COVERAGE_LIMITS,
  MATERIAL_FORMATS,
  type FormatCoverageStatus,
  type MaterialFormat,
} from "./limits.ts";

/**
 * Планировщик ежедневного добора материалов (COS-REL-009 §7.1).
 *
 * Цель: один прогон в день добавляет не больше одного материала в самый
 * дефицитный слот «профессия × компетенция × формат». Логика детерминирована:
 * при одинаковом состоянии и истории выбирается один и тот же слот.
 */

export type Tier = "foundation" | "core" | "optional";

export interface DailySlot {
  professionId: string;
  professionTitle: string;
  competencyId: string;
  competencyTitle: string;
  format: MaterialFormat;
  tier: Tier;
  accepted: number;
  target: number;
  min: number;
  attempts: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  status: FormatCoverageStatus;
  /** Сколько принятых материалов у профессии всего (0 = новая профессия). */
  professionAccepted: number;
}

export interface DailyHistoryEntry {
  date: string;
  professionId: string;
  competencyId: string;
  format: MaterialFormat;
  source: string;
  result: "accepted" | "no_material" | "rejected" | "error";
}

export interface DailyPlan {
  date: string;
  slot: DailySlot;
  source: string;
  reason: string;
  eligibleSlots: number;
  totalSlots: number;
}

export const DAILY_SOURCES = [
  "wikipedia",
  "habr",
  "stepik",
  "medium",
  "internet-archive",
  "learn-anything",
] as const;

const TIER_WEIGHT: Record<Tier, number> = {
  foundation: 3,
  core: 2,
  optional: 1,
};

function daysBetween(a: string, b: string): number {
  const first = new Date(`${a}T00:00:00Z`).getTime();
  const second = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((second - first) / 86_400_000);
}

/** Можно ли искать этот слот сегодня. */
export function isSlotEligible(slot: DailySlot, today: string): boolean {
  if (slot.accepted >= slot.target) return false;
  if (slot.lastAttemptAt === today) return false;
  if (slot.status === "insufficient") {
    return Boolean(slot.nextAttemptAt) && slot.nextAttemptAt! <= today;
  }
  if (slot.attempts >= COVERAGE_LIMITS.maxFormatRounds) {
    const last = slot.lastAttemptAt;
    if (!last) return true;
    return daysBetween(last, today) >= COVERAGE_LIMITS.cooldownDays;
  }
  return true;
}

/** Приоритет слота: tier, размер дефицита, новизна профессии, давность попытки. */
export function scoreSlot(slot: DailySlot): number {
  const deficit = (slot.target - slot.accepted) / Math.max(slot.target, 1);
  const newProfession = slot.professionAccepted === 0 ? 1 : 0;
  return TIER_WEIGHT[slot.tier] * 2 + deficit * 3 + newProfession * 2;
}

function historyIndex(history: DailyHistoryEntry[], predicate: (entry: DailyHistoryEntry) => boolean): number {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]!;
    if (predicate(entry)) return history.length - index;
  }
  return history.length + 1;
}

/** Детерминированный выбор следующего слота. null = всё закрыто, сеть не нужна. */
export function selectDailyTarget(
  slots: DailySlot[],
  history: DailyHistoryEntry[],
  today: string,
): DailyPlan | null {
  const eligible = slots.filter((slot) => isSlotEligible(slot, today));
  if (eligible.length === 0) return null;
  const ranked = [...eligible].sort((a, b) => {
    const scoreDiff = scoreSlot(b) - scoreSlot(a);
    if (scoreDiff !== 0) return scoreDiff;
    // Давно не пытались — вперёд.
    const aLast = a.lastAttemptAt ? daysBetween(a.lastAttemptAt, today) : 999;
    const bLast = b.lastAttemptAt ? daysBetween(b.lastAttemptAt, today) : 999;
    if (aLast !== bLast) return bLast - aLast;
    // Профессии, к которым давно не возвращались, вперёд.
    const aProf = historyIndex(history, (entry) => entry.professionId === a.professionId);
    const bProf = historyIndex(history, (entry) => entry.professionId === b.professionId);
    if (aProf !== bProf) return bProf - aProf;
    // Стабильный tie-break: без случайности.
    const aKey = `${a.professionId}|${a.competencyId}|${a.format}`;
    const bKey = `${b.professionId}|${b.competencyId}|${b.format}`;
    return aKey.localeCompare(bKey);
  });
  const slot = ranked[0]!;
  return {
    date: today,
    slot,
    source: pickDailySource(history),
    reason:
      `${slot.tier}: ${slot.accepted}/${slot.target} ${slot.format}; ` +
      `попыток ${slot.attempts}, профессия ${slot.professionTitle}`,
    eligibleSlots: eligible.length,
    totalSlots: slots.length,
  };
}

/** Ротация источников: берём тот, который дольше всех не использовался. */
export function pickDailySource(
  history: DailyHistoryEntry[],
  sources: readonly string[] = DAILY_SOURCES,
): string {
  if (sources.length === 0) return "wikipedia";
  const ranked = [...sources].sort((a, b) => {
    const aIndex = historyIndex(history, (entry) => entry.source === a);
    const bIndex = historyIndex(history, (entry) => entry.source === b);
    if (aIndex !== bIndex) return bIndex - aIndex;
    return a.localeCompare(b);
  });
  return ranked[0]!;
}

export interface DailyState {
  lastRunDate?: string;
  history: DailyHistoryEntry[];
}

/** Записать попытку в историю (хранится в data/materials-agent/daily-state.json). */
export function appendHistory(
  state: DailyState,
  entry: DailyHistoryEntry,
  maxEntries = 365,
): DailyState {
  return {
    lastRunDate: entry.date,
    history: [...state.history, entry].slice(-maxEntries),
  };
}

export const DAILY_FORMATS = MATERIAL_FORMATS;
