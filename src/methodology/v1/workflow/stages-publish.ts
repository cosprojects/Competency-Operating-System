/**
 * `release.publish` — иммутабельный артефакт релиза.
 *
 * Публикуется снимок онтологии + статистика + версия политики приёмки.
 * Хэш считается по канонически отсортированным узлам и рёбрам: одинаковый
 * контент даёт одинаковый хэш независимо от порядка загрузки.
 */
import { createHash } from "node:crypto";
import { loadOntologySnapshot } from "../contracts/load.ts";
import { stageInputSchema, stageOutputSchema } from "../contracts/workflow.ts";
import { findNodeDuplicates } from "../dedupe/resources.ts";
import { DEFAULT_REVIEW_POLICY } from "../review/policy.ts";
import { PUBLICATION_VERSION, type PublicationStore } from "../release/publication.ts";
import type { StageHandler } from "./runner.ts";

function canonicalHash(nodes: unknown[], edges: unknown[], key: "id"): string {
  const sortById = (items: unknown[]): unknown[] =>
    [...items].sort((a, b) =>
      String((a as Record<string, unknown>)[key]).localeCompare(String((b as Record<string, unknown>)[key])),
    );
  return createHash("sha256")
    .update(JSON.stringify({ nodes: sortById(nodes), edges: sortById(edges) }))
    .digest("hex");
}

export function publishReleaseHandler(
  root: string = process.cwd(),
  options: { publications?: PublicationStore } = {},
): StageHandler {
  return async ({ input }) => {
    const parsed = stageInputSchema.shape["release.publish"].parse(input);
    const { snapshot, catalog } = loadOntologySnapshot(root, {
      releaseId: parsed.releaseId,
      generatedAt: new Date().toISOString(),
    });

    const nodeDuplicates = findNodeDuplicates(
      snapshot.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        title: node.title,
        aliases: node.aliases,
        definition: node.definition,
      })),
    );

    const snapshotHash = canonicalHash(snapshot.nodes, snapshot.edges, "id");
    const stats = {
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      materials: catalog.materials.length,
      nodeDuplicates: nodeDuplicates.length,
      nodeDuplicatesStrong: nodeDuplicates.filter(
        (duplicate) => duplicate.strength === "strong",
      ).length,
      nodeDuplicatesWeak: nodeDuplicates.filter(
        (duplicate) => duplicate.strength === "weak",
      ).length,
    };

    const publication = options.publications
      ? await options.publications.publish({
          publicationVersion: PUBLICATION_VERSION,
          releaseId: parsed.releaseId,
          snapshotHash,
          publishedAt: new Date().toISOString(),
          policyVersion: DEFAULT_REVIEW_POLICY.version,
          stats,
          snapshot,
        })
      : undefined;

    return {
      output: stageOutputSchema.shape["release.publish"].parse({
        releaseId: parsed.releaseId,
        snapshotHash,
        ...(publication
          ? {
              publication: {
                releaseId: parsed.releaseId,
                snapshotHash,
                path: publication.path,
                currentPath: publication.currentPath,
                created: publication.created,
              },
            }
          : {}),
        policyVersion: DEFAULT_REVIEW_POLICY.version,
        stats,
        snapshot,
      }),
    };
  };
}
