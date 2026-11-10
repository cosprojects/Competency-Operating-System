import type { PrismaClient } from "@prisma/client";

export type MaterialDecisionAction = "APPROVE" | "BLOCK";
export type MaterialDecisions = Map<string, MaterialDecisionAction>;

/** Активные решения владельца по материалам: sourceId → APPROVE | BLOCK. */
export async function loadMaterialDecisions(
  db: PrismaClient,
  sourceIds: string[],
): Promise<MaterialDecisions> {
  const result: MaterialDecisions = new Map();
  if (sourceIds.length === 0) return result;
  try {
    const rows = await db.materialDecision.findMany({
      where: { sourceId: { in: sourceIds }, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { sourceId: true, action: true },
    });
    for (const row of rows) {
      if (!result.has(row.sourceId)) result.set(row.sourceId, row.action as MaterialDecisionAction);
    }
  } catch {
    // Preview без БД: публичные страницы работают без решений.
  }
  return result;
}
