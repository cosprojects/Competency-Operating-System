import type { PrismaClient } from "@prisma/client";
import type { ContentProfession } from "./content-types";
import {
  resolveBaseStatus,
  resolveSourceReviewStatus,
  type SourceReviewAction,
  type SourceReviewStatus,
} from "./source-review";
import { loadMaterialDecisions } from "./material-decisions";

/**
 * Серверная часть подтверждений материалов: считает активную базу, собирает голоса
 * и раздаёт итоговые статусы странице профессии и API.
 */

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVE_CACHE_MS = 60 * 60 * 1000;

let activeUsersCache: { value: number; at: number } | null = null;

/** Активные залогиненные за 30 дней: различные userId с событиями аналитики. */
export async function getActiveLoggedInUsers(db: PrismaClient): Promise<number> {
  if (activeUsersCache && Date.now() - activeUsersCache.at < ACTIVE_CACHE_MS) {
    return activeUsersCache.value;
  }
  try {
    const rows = await db.analyticsEvent.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) },
        userId: { not: null },
      },
      distinct: ["userId"],
      select: { userId: true },
    });
    const value = Math.max(rows.length, 1);
    activeUsersCache = { value, at: Date.now() };
    return value;
  } catch {
    return Math.max(activeUsersCache?.value ?? 1, 1);
  }
}

export interface SourceReviewView {
  status: SourceReviewStatus;
  confirms: number;
  blocks: number;
  myAction: SourceReviewAction | null;
}

export interface ProfessionReviewIndex {
  /** Ключ `компетенция|источник` → статус и счётчики. */
  byPair: Map<string, SourceReviewView>;
  /** Пары, которые не нужно рендерить (заблокированы). */
  hidden: Set<string>;
}

interface Counts {
  confirms: number;
  blocks: number;
}

function emptyCounts(): Counts {
  return { confirms: 0, blocks: 0 };
}

function addVote(target: Counts, action: SourceReviewAction): void {
  if (action === "BLOCK") target.blocks += 1;
  else target.confirms += 1;
}

/** Собирает статусы подтверждения для всех источников профессии. */
export async function loadProfessionSourceReviews(
  db: PrismaClient,
  profession: ContentProfession,
  userId: string | null,
): Promise<ProfessionReviewIndex> {
  const baseByPair = new Map<string, "auto_accepted" | "needs_confirmation">();
  const sourceIds = new Set<string>();
  for (const section of profession.sections) {
    for (const competency of section.competencies) {
      for (const source of competency.sources) {
        baseByPair.set(`${competency.id}|${source.id}`, resolveBaseStatus(source.reviewStatus, source.id));
        sourceIds.add(source.id);
      }
    }
  }
  const byPair = new Map<string, SourceReviewView>();
  const hidden = new Set<string>();
  if (sourceIds.size === 0) return { byPair, hidden };

  let reviews;
  let activeUsers;
  let decisions;
  try {
    [reviews, activeUsers, decisions] = await Promise.all([
    db.sourceReview.findMany({
      where: { sourceId: { in: [...sourceIds] } },
      select: {
        sourceId: true,
        competencyId: true,
        scope: true,
        action: true,
        actorKey: true,
        reason: true,
      },
    }),
      getActiveLoggedInUsers(db),
      loadMaterialDecisions(db, [...sourceIds]),
    ]);
  } catch {
    // Demo/preview без БД: публичные страницы должны работать без review-статусов.
    return { byPair, hidden };
  }
  const actorKey = userId ? `u:${userId}` : null;
  const pairCounts = new Map<string, Counts>();
  const sourceCounts = new Map<string, Counts>();
  const votes = new Map<string, SourceReviewAction>();

  for (const review of reviews) {
    const pairKey = `${review.competencyId}|${review.sourceId}`;
    if (review.scope === "source") {
      const counts = sourceCounts.get(review.sourceId) ?? emptyCounts();
      addVote(counts, review.action);
      sourceCounts.set(review.sourceId, counts);
    } else {
      const counts = pairCounts.get(pairKey) ?? emptyCounts();
      addVote(counts, review.action);
      pairCounts.set(pairKey, counts);
    }
    if (actorKey && review.actorKey === actorKey) votes.set(pairKey, review.action);
  }

  for (const [pairKey, baseStatus] of baseByPair) {
    const separator = pairKey.lastIndexOf("|");
    const sourceId = pairKey.slice(separator + 1);
    const own = pairCounts.get(pairKey) ?? emptyCounts();
    const wide = sourceCounts.get(sourceId) ?? emptyCounts();
    const counts = { confirms: own.confirms, blocks: own.blocks + wide.blocks };
    const decision = decisions?.get(sourceId);
    const status: SourceReviewStatus =
      decision === "APPROVE"
        ? "confirmed"
        : decision === "BLOCK"
          ? "blocked"
          : resolveSourceReviewStatus({ baseStatus, counts, activeUsers });
    byPair.set(pairKey, {
      status,
      confirms: counts.confirms,
      blocks: counts.blocks,
      myAction: votes.get(pairKey) ?? null,
    });
    if (status === "blocked") hidden.add(pairKey);
  }
  return { byPair, hidden };
}
