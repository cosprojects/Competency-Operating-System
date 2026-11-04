/**
 * `materials.attach` — привязка принятых материалов к компетенциям без дублей.
 *
 * Состояние живёт в хранилище (БД в проде, файл локально): материалы уникальны
 * по канонической ссылке, связи — по паре «материал × компетенция».
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { catalogFileSchema } from "../contracts/adapters.ts";
import { stageInputSchema, stageOutputSchema } from "../contracts/workflow.ts";
import { canonicalUrl, dedupeResources, domainOfUrl } from "../dedupe/resources.ts";
import { FileMaterialsStore } from "../materials/store-file.ts";
import type { MaterialsStore } from "../materials/store.ts";
import { StageError } from "./errors.ts";
import type { StageHandler } from "./runner.ts";

export function materialIdFor(url: string): string {
  return `material_${createHash("sha1").update(canonicalUrl(url) ?? url).digest("hex").slice(0, 12)}`;
}

type PoolResource = {
  id: string;
  url: string;
  title: string;
  provider?: string;
  domain?: string;
};

type Candidate = {
  url: string;
  title: string;
  domain?: string;
  decision: { materialId: string; nodeId: string; title?: string };
};

export function attachMaterialsHandler(
  root: string = process.cwd(),
  options: { store?: MaterialsStore } = {},
): StageHandler {
  return async ({ input }) => {
    const parsed = stageInputSchema.shape["materials.attach"].parse(input);
    const catalog = catalogFileSchema.parse(
      JSON.parse(
        readFileSync(resolve(root, "src/methodology/v1/competency/catalog/it.json"), "utf8"),
      ),
    );
    const store =
      options.store ?? new FileMaterialsStore(resolve(root, "data/workflow/attached-materials.json"));

    // Что уже есть: связи каталога и материалы хранилища.
    const blockToCanonical = new Map<string, string>();
    for (const block of catalog.blocks) {
      if ((block.canonicalIds ?? []).length === 1 && block.canonicalIds?.[0]) {
        blockToCanonical.set(block.id, block.canonicalIds[0]);
      }
    }
    const catalogLinks = new Set<string>();
    const catalogResources: PoolResource[] = [];
    for (const material of catalog.materials) {
      if (material.url) {
        catalogResources.push({
          id: material.id,
          url: material.url,
          title: material.title,
          ...(material.provider ? { provider: material.provider } : {}),
          domain: domainOfUrl(material.url),
        });
      }
      for (const link of (material.links ?? []) as Array<{ competencyId: string }>) {
        const canonical = blockToCanonical.get(link.competencyId) ?? link.competencyId;
        catalogLinks.add(`${material.id}|${canonical}`);
      }
    }

    const stored = await store.listMaterials();
    const pool: PoolResource[] = [
      ...catalogResources,
      ...stored.map((material) => ({
        id: material.id,
        url: material.url,
        title: material.title,
        ...(material.provider ? { provider: material.provider } : {}),
        domain: domainOfUrl(material.url),
      })),
    ];

    const accepted = parsed.decisions.filter((decision) => decision.status !== "rejected");
    if (accepted.length === 0) {
      throw new StageError("нет принятых материалов для привязки", "no_materials", false);
    }

    const candidates: Candidate[] = accepted.map((decision) => ({
      url: decision.materialId,
      title: decision.title ?? decision.materialId,
      domain: domainOfUrl(decision.materialId),
      decision: {
        materialId: decision.materialId,
        nodeId: decision.nodeId,
        ...(decision.title ? { title: decision.title } : {}),
      },
    }));

    const { unique, duplicates } = dedupeResources(candidates, pool);
    const links: Array<{ materialId: string; nodeId: string; newMaterial: boolean; reused: boolean }> = [];
    const duplicateLinks: Array<{ materialId: string; nodeId: string; reason: string }> = [];

    // Связи, созданные в этом прогоне: их не считаем повторными дублями —
    // материал-дубль уже учтён на уровне ресурса.
    const linkedThisRun = new Set<string>();
    const linkOrSkip = async (
      materialId: string,
      nodeId: string,
    ): Promise<"linked" | "duplicate"> => {
      const key = `${materialId}|${nodeId}`;
      if (catalogLinks.has(key) || (await store.hasLink(materialId, nodeId))) {
        duplicateLinks.push({ materialId, nodeId, reason: "link_exists" });
        return "duplicate";
      }
      await store.addLink(materialId, nodeId);
      linkedThisRun.add(key);
      return "linked";
    };

    for (const candidate of unique) {
      const materialId = materialIdFor(candidate.url);
      const canonical = canonicalUrl(candidate.url) ?? candidate.url;
      await store.addMaterial({
        id: materialId,
        canonicalUrl: canonical,
        url: candidate.decision.materialId,
        title: candidate.decision.title ?? candidate.decision.materialId,
      });
      if ((await linkOrSkip(materialId, candidate.decision.nodeId)) === "linked") {
        links.push({ materialId, nodeId: candidate.decision.nodeId, newMaterial: true, reused: false });
      }
    }

    for (const duplicate of duplicates) {
      // Дубль может совпасть как с материалом хранилища/каталога (у него есть id),
      // так и с другим кандидатом этой же пачки — тогда id выводим из ссылки.
      const match = duplicate.match as { id?: string; url: string };
      const materialId = match.id ?? materialIdFor(match.url);
      if (linkedThisRun.has(`${materialId}|${duplicate.candidate.decision.nodeId}`)) continue;
      if ((await linkOrSkip(materialId, duplicate.candidate.decision.nodeId)) === "linked") {
        links.push({
          materialId,
          nodeId: duplicate.candidate.decision.nodeId,
          newMaterial: false,
          reused: true,
        });
      }
    }

    return {
      output: stageOutputSchema.shape["materials.attach"].parse({
        linked: links,
        duplicates: [
          ...duplicates.map((duplicate) => {
            const match = duplicate.match as { id?: string; url: string };
            return {
              materialId: duplicate.candidate.decision.materialId,
              matchId: match.id ?? materialIdFor(match.url),
              kind: duplicate.kind,
              score: duplicate.score,
            };
          }),
          ...duplicateLinks.map((item) => ({
            materialId: item.materialId,
            matchId: item.nodeId,
            kind: item.reason,
            score: 1,
          })),
        ],
        stats: {
          input: parsed.decisions.length,
          accepted: accepted.length,
          linked: links.length,
          newMaterials: links.filter((link) => link.newMaterial).length,
          duplicates: duplicates.length + duplicateLinks.length,
        },
      }),
    };
  };
}
