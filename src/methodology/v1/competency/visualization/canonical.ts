import type { CompetencyBlock } from "../types.ts";
import type { CanonicalMap } from "../canonical/types.ts";
import type { StudyPriorityMark } from "../priority/types.ts";
import type { VisualizationConfig, VisualizationNodeConfig } from "./types.ts";

export interface CanonicalVisualization {
  blocks: CompetencyBlock[];
  config: VisualizationConfig;
  marks: StudyPriorityMark[];
  statusCounts: { covered: number; partial: number; gap: number };
}

function tierOf(hint: "foundation" | "core" | "optional"): "foundation" | "core" | "optional" {
  return hint;
}

export function buildCanonicalVisualization(map: CanonicalMap, sourceBlocks: CompetencyBlock[]): CanonicalVisualization {
  const sourceById = new Map(sourceBlocks.map((block) => [block.id, block]));
  const blocks: CompetencyBlock[] = [];
  const nodes: VisualizationNodeConfig[] = [];
  const marks: StudyPriorityMark[] = [];
  const statusCounts = { covered: 0, partial: 0, gap: 0 };
  let order = 0;

  for (const branch of map.branches) {
    for (const section of branch.sections) {
      let previousCompetencyId: string | undefined;
      for (const competency of section.competencies) {
        order += 1;
        const covered = competency.coveredBy
          .map((id) => sourceById.get(id))
          .find((block): block is CompetencyBlock => block !== undefined);
        const prerequisites = competency.prerequisites ?? (previousCompetencyId ? [previousCompetencyId] : []);
        const block: CompetencyBlock = {
          id: competency.id,
          slug: competency.id,
          title: competency.title,
          ...(competency.titleEn ? { titleEn: competency.titleEn } : {}),
          aliases: [],
          definition: competency.definition,
          scope: "profession",
          professionIds: [map.professionId],
          components: covered?.components ?? [],
          tags: covered?.tags ?? [],
          sourceRefs: covered?.sourceRefs ?? [],
          evidenceState: covered?.evidenceState ?? "needs_review",
          status: covered?.status ?? "needs_review",
          llmMeta: covered?.llmMeta ?? { promptVersion: "canonical-v1", model: "canonical-map", inputHash: "canonical", costUsd: 0 },
          issues: covered?.issues ?? [],
          canonicalIds: [competency.id],
          methodologyVersion: "0.1.0",
        };
        blocks.push(block);
        statusCounts[competency.status] += 1;
        nodes.push({
          competencyId: competency.id,
          tier: tierOf(competency.priorityHint),
          order,
          prerequisites,
          shortDescription: competency.definition,
          branch: branch.title,
          section: section.title,
        });
        marks.push({
          competencyId: competency.id,
          tier: tierOf(competency.priorityHint),
          order,
          prerequisites,
          rationale: competency.definition,
          confidence: "low",
          reviewer: "canonical-visual",
          reviewedAt: map.updatedOn,
        });
        previousCompetencyId = competency.id;
      }
    }
  }

  return {
    blocks,
    marks,
    statusCounts,
    config: {
      visualizationVersion: "0.1.0",
      domain: map.domain,
      professionId: map.professionId,
      status: "draft",
      note: "Каноническая карта UX/UI: два блока, 9 разделов, 34 компетенции. Связи — учебная последовательность внутри разделов; статусы coverage видны в отчёте.",
      nodes,
    },
  };
}
