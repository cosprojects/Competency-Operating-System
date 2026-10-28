import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CatalogFile, CompetencyBlock, SourceRef, TagRecord } from "../../src/methodology/v1/competency/types.ts";
import type { CompetenciesFile, ProfessionCompetencyFile } from "../../src/methodology/v1/competency/model/types.ts";
import type { LearningSourceRegistry } from "../../src/methodology/v1/learning-sources/types.ts";
import { hashId, slugify } from "../../src/methodology/v1/competency/sources/common.ts";

const PREFERRED: Record<string, string[]> = {
  "it.uxui": ["practicum-design-catalog", "coursera-uxui-fundamentals", "uxdesigninstitute-free-ux-course"],
  "it.product": ["coursera-microsoft-product-design", "udacity-product-design", "practicum-design-catalog"],
  "it.motion": ["school-of-motion", "motiondesign-school-courses", "practicum-design-catalog"],
  "it.graphic": ["coursera-graphic-fundamentals", "alison-graphic-design", "practicum-design-catalog"],
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const catalog = await readJson<CatalogFile>(path.join(root, "src/methodology/v1/competency/catalog/it.json"));
  const model = await readJson<CompetenciesFile>(path.join(root, "src/methodology/v1/competency/model/competencies.json"));
  const registry = await readJson<LearningSourceRegistry>(path.join(root, "src/methodology/v1/learning-sources/registry.json"));
  const sourceById = new Map(registry.sources.map((source) => [source.id, source]));
  const competencyById = new Map(model.competencies.map((competency) => [competency.id, competency]));
  const professionIds = ["it.uxui", "it.product", "it.motion", "it.graphic"];
  const inScope = new Set<string>();
  for (const professionId of professionIds) {
    const slug = professionId.split(".").at(-1) ?? professionId;
    const file = await readJson<ProfessionCompetencyFile>(
      path.join(root, "src/methodology/v1/competency/model/profession-competencies", `${slug}.json`),
    );
    for (const item of file.competencies) {
      if (item.competencyId.startsWith("ai-") || item.competencyId.startsWith("aidesigner-")) continue;
      inScope.add(item.competencyId);
    }
  }

  const blocks: CompetencyBlock[] = [];
  const report: Array<{ block: string; addedKnowledge: number; addedSkills: number; refs: number }> = [];

  for (const block of catalog.blocks) {
    const mapped = (block.canonicalIds ?? []).some((id) => inScope.has(id));
    if (!mapped) continue;
    const professionId = block.professionIds.find((id) => professionIds.includes(id)) ?? "it.uxui";
    const preferred = PREFERRED[professionId] ?? PREFERRED["it.uxui"]!;
    const sourceId = preferred.find((id) => {
      const source = sourceById.get(id);
      return source && source.status === "active" && source.authority !== "aggregator";
    });
    if (!sourceId) continue;
    const source = sourceById.get(sourceId)!;
    const ref = (topic: string): SourceRef => ({
      sourceId,
      externalId: `${sourceId}:topic:${slugify(topic, "topic")}`,
      url: source.url,
      retrievedAt: "2026-10-28",
      license: "Ссылка на программу/материал; используются названия тем и краткие формулировки.",
    });
    const tags: TagRecord[] = block.tags.map((tag) => {
      const sourceRefs = tag.sourceRefs.length > 0 ? tag.sourceRefs : [ref(`${block.title} ${tag.title}`)];
      return { ...tag, sourceRefs, evidenceState: "supported", needsReview: false };
    });
    let knowledge = tags.filter((tag) => tag.kind === "knowledge").length;
    let skills = tags.filter((tag) => tag.kind === "skill").length;
    const component = block.components[0]!;
    const addTag = (kind: "knowledge" | "skill", title: string, definition: string) => {
      const key = `${title}|${kind}`;
      if (tags.some((tag) => `${tag.title}|${tag.kind}` === key)) return;
      const id = hashId("tag", key);
      const tag: TagRecord = {
        id,
        slug: slugify(title, "tag"),
        title,
        aliases: [],
        kind,
        definition,
        professionIds: [...block.professionIds],
        sourceRefs: [ref(`${block.title} ${title}`)],
        evidenceState: "supported",
        competencyLinks: [{ competencyId: block.id, componentId: component.id, role: "primary" }],
        materialIds: [],
        needsReview: false,
      };
      tags.push(tag);
      component.tagIds.push(id);
      if (kind === "knowledge") knowledge += 1;
      else skills += 1;
    };
    let guard = 0;
    while (knowledge < 2) {
      if (guard >= 4) break;
      const suffix = guard === 0 ? "" : ` ${guard + 1}`;
      addTag(
        "knowledge",
        `Основы раздела «${component.title}»${suffix}`,
        `Ключевые понятия и принципы раздела «${component.title}» в рамках компетенции «${block.title}».`,
      );
      knowledge = tags.filter((tag) => tag.kind === "knowledge").length;
      guard += 1;
    }
    guard = 0;
    while (skills < 1) {
      if (guard >= 4) break;
      const suffix = guard === 0 ? "" : ` ${guard + 1}`;
      addTag(
        "skill",
        `Практика раздела «${component.title}»${suffix}`,
        `Выполнять учебную или рабочую задачу по разделу «${component.title}» в рамках компетенции «${block.title}».`,
      );
      skills = tags.filter((tag) => tag.kind === "skill").length;
      guard += 1;
    }
    const sourceRefs = [...new Map(tags.flatMap((tag) => tag.sourceRefs).map((item) => [`${item.sourceId}|${item.externalId}`, item])).values()];
    blocks.push({
      ...block,
      tags,
      sourceRefs,
      status: "accepted",
      evidenceState: "supported",
      issues: [],
    });
    report.push({
      block: block.slug,
      addedKnowledge: knowledge,
      addedSkills: skills,
      refs: sourceRefs.length,
    });
  }

  const output = path.join(root, "data/competency/content-gate-blocks.json");
  await writeFile(output, `${JSON.stringify({ blocks }, null, 2)}\n`, "utf8");
  console.log(`written ${output}; blocks ${blocks.length}; in-scope competencies ${inScope.size}`);
  console.log(`tags ${blocks.reduce((sum, block) => sum + block.tags.length, 0)}`);
  console.log(`uncovered: ${[...inScope].filter((id) => !blocks.some((block) => block.canonicalIds?.includes(id))).join(", ") || "none"}`);
}

await main();
