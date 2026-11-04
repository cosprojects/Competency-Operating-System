/** Prisma-адаптер хранилища материалов (PostgreSQL в проде, SQLite локально). */
import type { PrismaClient } from "@prisma/client";
import type { MaterialsStore, ReviewBatch, StoredMaterial } from "./store.ts";

export class PrismaMaterialsStore implements MaterialsStore {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listMaterials(): Promise<StoredMaterial[]> {
    const rows = await this.prisma.material.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      canonicalUrl: row.canonicalUrl,
      url: row.url,
      title: row.title,
      ...(row.provider ? { provider: row.provider } : {}),
    }));
  }

  async findMaterialByCanonicalUrl(canonicalUrl: string): Promise<StoredMaterial | undefined> {
    const row = await this.prisma.material.findUnique({ where: { canonicalUrl } });
    if (!row) return undefined;
    return {
      id: row.id,
      canonicalUrl: row.canonicalUrl,
      url: row.url,
      title: row.title,
      ...(row.provider ? { provider: row.provider } : {}),
    };
  }

  async addMaterial(material: StoredMaterial): Promise<void> {
    await this.prisma.material.upsert({
      where: { id: material.id },
      create: {
        id: material.id,
        canonicalUrl: material.canonicalUrl,
        url: material.url,
        title: material.title,
        provider: material.provider ?? null,
      },
      update: { title: material.title, url: material.url },
    });
  }

  async hasLink(materialId: string, nodeId: string): Promise<boolean> {
    const row = await this.prisma.materialLink.findUnique({
      where: { materialId_nodeId: { materialId, nodeId } },
    });
    return Boolean(row);
  }

  async addLink(materialId: string, nodeId: string): Promise<void> {
    await this.prisma.materialLink.upsert({
      where: { materialId_nodeId: { materialId, nodeId } },
      create: { materialId, nodeId },
      update: {},
    });
  }

  async recordReviewDecisions(batch: ReviewBatch): Promise<void> {
    if (batch.decisions.length === 0) return;
    await this.prisma.reviewDecision.createMany({
      data: batch.decisions.map((decision) => ({
        runId: batch.runId,
        stepId: batch.stepId,
        materialUrl: decision.materialUrl,
        title: decision.title ?? null,
        competencyId: decision.competencyId ?? null,
        // В БД enum в UPPER_CASE, в контракте политики — snake_case.
        outcome: decision.outcome.toUpperCase() as never,
        decision: decision.decision,
        reason: decision.reason,
        policyVersion: batch.policyVersion,
        signalsJson: decision.signalsJson ?? null,
      })),
    });
  }
}
