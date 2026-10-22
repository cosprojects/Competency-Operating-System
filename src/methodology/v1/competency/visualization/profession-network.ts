import type { CompetencyBlock } from "../types.ts";
import type { GlobalCompetency } from "../model/types.ts";
import type { ProfessionView } from "../model/profession-view.ts";
import { layoutCompetencies } from "../canvas/layout.ts";
import type { StudyPriorityMark } from "../priority/types.ts";
import { buildVisualizationPageData } from "./page.ts";
import type { VisualizationConfig } from "./types.ts";

function syntheticBlock(
  competency: GlobalCompetency,
  view: ProfessionView,
  source?: CompetencyBlock,
): CompetencyBlock {
  return {
    id: competency.id,
    slug: competency.id,
    title: competency.title,
    ...(competency.titleEn ? { titleEn: competency.titleEn } : {}),
    aliases: [],
    definition: competency.definition,
    scope: "profession",
    professionIds: [view.professionId],
    components: source?.components ?? [],
    tags: source?.tags ?? [],
    sourceRefs: source?.sourceRefs ?? [],
    evidenceState: source?.evidenceState ?? "needs_review",
    status: source?.status ?? "accepted",
    llmMeta: source?.llmMeta ?? { promptVersion: "view-v1", model: "profession-view", inputHash: "view", costUsd: 0 },
    issues: source?.issues ?? [],
    methodologyVersion: "0.1.0",
  };
}

export function buildProfessionNetworkPage(
  view: ProfessionView,
  competencies: GlobalCompetency[],
  sourceBlocks: CompetencyBlock[],
  generatedOn: string,
) {
  const byCompetency = new Map(competencies.map((competency) => [competency.id, competency]));
  const sourceByCanonical = new Map<string, CompetencyBlock>();
  for (const block of sourceBlocks) {
    for (const canonicalId of block.canonicalIds ?? []) sourceByCanonical.set(canonicalId, block);
  }
  const blocks: CompetencyBlock[] = [];
  const marks: StudyPriorityMark[] = [];
  const configNodes: VisualizationConfig["nodes"] = [];
  let order = 0;
  for (const section of view.sections) {
    let previous: string | undefined;
    for (const item of section.competencies) {
      const competency = byCompetency.get(item.competencyId);
      if (!competency) continue;
      order += 1;
      const block = syntheticBlock(competency, view, sourceByCanonical.get(item.competencyId));
      blocks.push(block);
      const prerequisites = item.prerequisites ?? (previous ? [previous] : []);
      const mark: StudyPriorityMark = {
        competencyId: item.competencyId,
        tier: item.tier,
        order,
        prerequisites,
        rationale: competency.definition,
        confidence: "low",
        reviewer: "profession-view",
        reviewedAt: generatedOn,
      };
      marks.push(mark);
      configNodes.push({
        competencyId: item.competencyId,
        tier: item.tier,
        order,
        prerequisites,
        shortDescription: competency.definition,
        branch: view.title,
        section: section.title,
      });
      previous = item.competencyId;
    }
  }
  const layout = layoutCompetencies({
    domain: "it",
    professionId: view.professionId,
    blocks,
    marks,
    viewport: { width: 1200, height: 800 },
  });
  const config: VisualizationConfig = {
    visualizationVersion: "0.1.0",
    domain: "it",
    professionId: view.professionId,
    status: "draft",
    note: `${view.title}: профессио-специфичная сеть, собранная из единого массива компетенций.`,
    nodes: configNodes,
  };
  const data = buildVisualizationPageData({ layout, blocks, config, generatedOn });
  data.title = view.title;
  data.subtitle = "Сеть компетенций: разделы, связи и приоритеты профессии";
  data.note = `${config.note} Tier/order специфичны для профессии; компетенции переиспользуются.`;
  return data;
}
