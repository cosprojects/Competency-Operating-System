import path from "node:path";
import { readFile } from "node:fs/promises";
import type { CompetenciesFile, ProfessionCompetencyFile } from "../../competency/model/types.ts";
import type { CatalogFile } from "../../competency/types.ts";
import type { CompetencyContext, SourceIntent } from "./types.ts";
import { SOURCE_INTENTS } from "./types.ts";

/** Контекст компетенций профессии для авто-расширения ресурсной базы. */
export async function loadCompetencyContexts(
  root: string,
  domain: string,
  professionId: string,
): Promise<CompetencyContext[]> {
  const slug = professionId.slice(professionId.indexOf(".") + 1);
  const modelDir = path.join(root, "src/methodology/v1/competency/model");
  const [competencies, professionCompetencies, catalog] = await Promise.all([
    readFile(path.join(modelDir, "competencies.json"), "utf8").then(
      (raw) => JSON.parse(raw) as CompetenciesFile,
    ),
    readFile(path.join(modelDir, "profession-competencies", `${slug}.json`), "utf8").then(
      (raw) => JSON.parse(raw) as ProfessionCompetencyFile,
    ),
    readFile(path.join(root, "src/methodology/v1/competency/catalog", `${domain}.json`), "utf8").then(
      (raw) => JSON.parse(raw) as CatalogFile,
    ),
  ]);
  const competencyById = new Map(competencies.competencies.map((item) => [item.id, item]));
  const blocksByCanonicalId = new Map<string, string[]>();
  for (const block of catalog.blocks) {
    for (const canonicalId of block.canonicalIds ?? []) {
      const list = blocksByCanonicalId.get(canonicalId) ?? [];
      list.push(block.id);
      blocksByCanonicalId.set(canonicalId, list);
    }
  }
  const componentsById = new Map(catalog.blocks.map((block) => [block.id, block.components]));
  const contexts: CompetencyContext[] = [];
  for (const competency of professionCompetencies.competencies) {
    const global = competencyById.get(competency.competencyId);
    if (!global) continue;
    const components = (blocksByCanonicalId.get(competency.competencyId) ?? [])
      .flatMap((blockId) => componentsById.get(blockId) ?? [])
      .map((component) => component.title);
    contexts.push({
      competencyId: competency.competencyId,
      professionId,
      title: global.title,
      ...(global.titleEn ? { titleEn: global.titleEn } : {}),
      definition: global.definition,
      components: [...new Set(components)].slice(0, 4),
      tier: competency.tier,
    });
  }
  return contexts;
}

/** Поисковые запросы по компетенции для провайдеров расширения. */
export function queriesForContext(context: CompetencyContext, intents: SourceIntent[] = SOURCE_INTENTS): Array<{
  query: string;
  intent: SourceIntent["id"];
  language: "ru" | "en";
}> {
  const queries: Array<{ query: string; intent: SourceIntent["id"]; language: "ru" | "en" }> = [];
  for (const intent of intents) {
    queries.push({ query: `${context.title} ${intent.suffixRu}`, intent: intent.id, language: "ru" });
    if (context.titleEn) {
      queries.push({ query: `${context.titleEn} ${intent.suffixEn}`, intent: intent.id, language: "en" });
    }
  }
  return queries;
}

/** Запросы для Wikipedia: только тема (без «курс/видео»), ru и en. */
export function articleQueries(context: CompetencyContext): Array<{ query: string; language: "ru" | "en" }> {
  const queries: Array<{ query: string; language: "ru" | "en" }> = [{ query: context.title, language: "ru" }];
  if (context.titleEn) queries.push({ query: context.titleEn, language: "en" });
  for (const component of context.components.slice(0, 2)) {
    queries.push({ query: component, language: "ru" });
  }
  return queries;
}
