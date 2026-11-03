import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import {
  requiredVotes,
  resolveSourceReviewStatus,
  type SourceReviewAction,
} from "../../apps/web/src/lib/source-review.ts";

/**
 * Экспорт пользовательских подтверждений и блокировок материалов для пайплайна.
 *
 *   npm run reviews:export -- --out data/reviews/source-reviews.json
 *
 * Пишет агрегаты (без email и сырого IP): сколько подтверждений/блокировок
 * у пары «источник × компетенция» и итоговый статус при текущей активной базе.
 * Пайплайн использует `blocked` чтобы не публиковать заблокированное заново.
 */

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const out = flagValue(argv, "--out") ?? path.join(root, "data/reviews/source-reviews.json");
  const db = new PrismaClient();
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activeRows, reviews] = await Promise.all([
      db.analyticsEvent.findMany({
        where: { createdAt: { gte: since }, userId: { not: null } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      db.sourceReview.findMany({
        select: { sourceId: true, competencyId: true, scope: true, action: true },
      }),
    ]);
    const activeUsers = Math.max(activeRows.length, 1);
    const pairCounts = new Map<string, Counts>();
    const sourceCounts = new Map<string, Counts>();
    for (const review of reviews) {
      if (review.scope === "source") {
        const counts = sourceCounts.get(review.sourceId) ?? emptyCounts();
        addVote(counts, review.action as SourceReviewAction);
        sourceCounts.set(review.sourceId, counts);
      } else {
        const key = `${review.competencyId}|${review.sourceId}`;
        const counts = pairCounts.get(key) ?? emptyCounts();
        addVote(counts, review.action as SourceReviewAction);
        pairCounts.set(key, counts);
      }
    }
    const pairs = [...pairCounts.entries()].map(([key, own]) => {
      const separator = key.lastIndexOf("|");
      const competencyId = key.slice(0, separator);
      const sourceId = key.slice(separator + 1);
      const wide = sourceCounts.get(sourceId) ?? emptyCounts();
      const counts = { confirms: own.confirms, blocks: own.blocks + wide.blocks };
      const status = resolveSourceReviewStatus({
        baseStatus: "needs_confirmation",
        counts,
        activeUsers,
      });
      return { sourceId, competencyId, ...counts, status };
    });
    const blockedSourceIds = [...sourceCounts.entries()]
      .filter(([, counts]) => counts.blocks >= requiredVotes("BLOCK", activeUsers))
      .map(([sourceId]) => sourceId);
    const payload = {
      generatedAt: new Date().toISOString().slice(0, 10),
      activeUsers,
      totals: {
        reviews: reviews.length,
        pairs: pairs.length,
        blockedPairs: pairs.filter((pair) => pair.status === "blocked").length,
        confirmedPairs: pairs.filter((pair) => pair.status === "confirmed").length,
      },
      blockedSourceIds,
      pairs,
    };
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(
      `reviews:export: reviews ${payload.totals.reviews}; pairs ${payload.totals.pairs}; ` +
        `blocked ${payload.totals.blockedPairs}; confirmed ${payload.totals.confirmedPairs}; ` +
        `activeUsers ${activeUsers}`,
    );
    console.log(out);
  } finally {
    await db.$disconnect();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
