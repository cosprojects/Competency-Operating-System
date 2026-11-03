import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { LlmBudget, LlmPolicy } from "../llm/policy.ts";
import type { LlmTransport } from "../llm/transport.ts";
import type { CacheOptions } from "../../profile/cache.ts";
import { runStructuredStep } from "../llm/run.ts";
import { descriptionResponseSchema } from "../llm/schemas.ts";
import { buildCompetencyDescriptionPrompt, buildProfessionDescriptionPrompt, DESCRIPTION_PROMPT_VERSION } from "../llm/prompts.ts";
import { isDescriptionValid, summarizeIssues, validateDescription } from "./validate.ts";
import { applyDescriptionUpdates } from "./apply.ts";
import type { DescriptionFailure, DescriptionReport, DescriptionSuggestion } from "./types.ts";

interface ViewCompetency {
  competencyId: string;
  tier: string;
}

interface ViewSection {
  id: string;
  title: string;
  definition: string;
  competencies: ViewCompetency[];
}

interface ProfessionViewFile {
  professionId: string;
  title: string;
  titleEn?: string;
  description?: string;
  sections: ViewSection[];
}

interface ModelCompetency {
  id: string;
  title: string;
  titleEn?: string;
  definition: string;
}

interface CatalogTag {
  id: string;
  title: string;
  kind: "knowledge" | "skill";
  definition: string;
}

interface CatalogBlock {
  title: string;
  definition: string;
  canonicalIds?: string[];
  components?: Array<{ title: string; definition: string }>;
  tags?: CatalogTag[];
}

interface CatalogFile {
  blocks: CatalogBlock[];
}

interface LearningSource {
  id: string;
  title: string;
  summary?: string;
}

export interface DescriptionAgentInput {
  root: string;
  professionIds: string[];
  all: boolean;
  includeAllCompetencies?: boolean;
  write: boolean;
  limit?: number;
  transport: LlmTransport;
  policy: LlmPolicy;
  budget: LlmBudget;
  cache?: CacheOptions;
  generatedAt?: string;
}

interface JobProfession {
  kind: "profession";
  view: ProfessionViewFile;
  sourceTitles: string[];
}

interface JobCompetency {
  kind: "competency";
  profession: { id: string; title: string };
  competency: ModelCompetency;
  blocks: CatalogBlock[];
  tags: Array<CatalogTag & { blockTitle: string }>;
  sourceTitles: string[];
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function loadSources(root: string): Promise<{
  views: Map<string, ProfessionViewFile>;
  competencies: Map<string, ModelCompetency>;
  blocksByCompetency: Map<string, CatalogBlock[]>;
  sourceTitlesByCompetency: Map<string, string[]>;
  sourceTitlesByProfession: Map<string, string[]>;
}> {
  const base = path.join(root, "src/methodology/v1/competency");
  const viewsDir = path.join(base, "model/professions/views");
  const viewFiles = (await readdir(viewsDir)).filter((file) => file.endsWith(".json"));
  const descriptionsFile = path.join(base, "model/professions/descriptions.json");
  let descriptionsPayload: { descriptions?: Record<string, string> } = {};
  try {
    descriptionsPayload = await readJson<{ descriptions?: Record<string, string> }>(descriptionsFile);
  } catch {
    descriptionsPayload = {};
  }
  const views = new Map<string, ProfessionViewFile>();
  for (const file of viewFiles) {
    const view = await readJson<ProfessionViewFile>(path.join(viewsDir, file));
    const slug = view.professionId.split(".").pop() ?? view.professionId;
    const stored = descriptionsPayload.descriptions?.[view.professionId];
    if (stored) view.description = stored;
    views.set(slug, view);
  }
  if (!views.has("uxui")) {
    const competenciesFile = await readJson<{
      professionId: string;
      competencies: Array<{ competencyId: string; tier: string; sectionId?: string; sectionTitle?: string }>;
    }>(path.join(base, "model/profession-competencies/uxui.json"));
    const canonical = await readJson<{
      branches: Array<{ sections: Array<{ id: string; title: string; definition: string }> }>;
    }>(path.join(base, "canonical/uxui.json"));
    const sectionDefinitions = new Map<string, { title: string; definition: string }>();
    for (const branch of canonical.branches) {
      for (const section of branch.sections) sectionDefinitions.set(section.id, { title: section.title, definition: section.definition });
    }
    const sections = new Map<string, ViewSection>();
    for (const item of competenciesFile.competencies) {
      const sectionId = item.sectionId ?? "ux-general";
      const sectionTitle = item.sectionTitle ?? "UX/UI";
      const section = sections.get(sectionId) ?? {
        id: sectionId,
        title: sectionDefinitions.get(sectionId)?.title ?? sectionTitle,
        definition: sectionDefinitions.get(sectionId)?.definition ?? "",
        competencies: [],
      };
      section.competencies.push({ competencyId: item.competencyId, tier: item.tier });
      sections.set(sectionId, section);
    }
    views.set("uxui", {
      professionId: "it.uxui",
      title: "UX/UI-дизайнер",
      ...(descriptionsPayload.descriptions?.["it.uxui"] ? { description: descriptionsPayload.descriptions["it.uxui"] } : {}),
      sections: [...sections.values()],
    });
  }
  const model = await readJson<{ competencies: ModelCompetency[] }>(path.join(base, "model/competencies.json"));
  const competencies = new Map(model.competencies.map((item) => [item.id, item]));
  const catalog = await readJson<CatalogFile>(path.join(base, "catalog/it.json"));
  const blocksByCompetency = new Map<string, CatalogBlock[]>();
  for (const block of catalog.blocks) {
    for (const id of block.canonicalIds ?? []) {
      const list = blocksByCompetency.get(id) ?? [];
      list.push(block);
      blocksByCompetency.set(id, list);
    }
  }
  const links = await readJson<{ links: Array<{ competencyId: string; sourceIds: string[] }> }>(
    path.join(base, "model/learning-source-links.json"),
  );
  const registry = await readJson<{ sources: LearningSource[] }>(
    path.join(root, "src/methodology/v1/learning-sources/registry.json"),
  );
  const sourceById = new Map(registry.sources.map((source) => [source.id, source]));
  const sourceTitlesByCompetency = new Map<string, string[]>();
  for (const link of links.links) {
    sourceTitlesByCompetency.set(
      link.competencyId,
      link.sourceIds.map((id) => sourceById.get(id)?.title).filter((title): title is string => Boolean(title)),
    );
  }
  const sourceTitlesByProfession = new Map<string, string[]>();
  for (const [slug, view] of views) {
    const titles = new Set<string>();
    for (const section of view.sections) {
      for (const competency of section.competencies) {
        for (const title of sourceTitlesByCompetency.get(competency.competencyId) ?? []) titles.add(title);
      }
    }
    sourceTitlesByProfession.set(slug, [...titles]);
  }
  return { views, competencies, blocksByCompetency, sourceTitlesByCompetency, sourceTitlesByProfession };
}

function tagsForBlocks(blocks: CatalogBlock[]): Array<CatalogTag & { blockTitle: string }> {
  const tags = new Map<string, CatalogTag & { blockTitle: string }>();
  for (const block of blocks) {
    for (const tag of block.tags ?? []) {
      if (!tags.has(tag.id)) tags.set(tag.id, { ...tag, blockTitle: block.title });
    }
  }
  return [...tags.values()];
}

export async function runDescriptionAgent(input: DescriptionAgentInput): Promise<DescriptionReport> {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const sources = await loadSources(input.root);
  const suggestions: DescriptionSuggestion[] = [];
  const failures: DescriptionFailure[] = [];
  const professionUpdates = new Map<string, string>();
  const competencyUpdates = new Map<string, string>();
  const tagUpdates = new Map<string, string>();

  const requested = input.professionIds
    .map((id) => id.split(".").pop() ?? id)
    .filter((slug) => sources.views.has(slug));
  const unknown = input.professionIds.filter((id) => !sources.views.has(id.split(".").pop() ?? id));
  for (const slug of unknown) failures.push({ entity: "profession", id: slug, reason: "нет profession view" });

  const jobs: Array<JobProfession | JobCompetency> = [];
  const seenCompetencies = new Set<string>();

  for (const slug of requested) {
    const view = sources.views.get(slug)!;
    const professionSources = sources.sourceTitlesByProfession.get(slug) ?? [];
    const current = (view.description ?? "").trim();
    const professionTitle = view.title;
    if (input.all || !isDescriptionValid(current, { kind: "profession", title: professionTitle })) {
      jobs.push({ kind: "profession", view, sourceTitles: professionSources });
    }
    const competencyIds = view.sections.flatMap((section) => section.competencies.map((item) => item.competencyId));
    for (const competencyId of competencyIds) {
      if (seenCompetencies.has(competencyId)) continue;
      seenCompetencies.add(competencyId);
      const competency = sources.competencies.get(competencyId);
      if (!competency) continue;
      const blocks = sources.blocksByCompetency.get(competencyId) ?? [];
      const tags = tagsForBlocks(blocks);
      const needsCompetency =
        input.all || !isDescriptionValid(competency.definition, { kind: "competency", title: competency.title });
      const needsTags = input.all || tags.some((tag) => !isDescriptionValid(tag.definition, { kind: tag.kind, title: tag.title }));
      if (!needsCompetency && !needsTags) continue;
      jobs.push({
        kind: "competency",
        profession: { id: view.professionId, title: view.title },
        competency,
        blocks,
        tags,
        sourceTitles: sources.sourceTitlesByCompetency.get(competencyId) ?? [],
      });
    }
  }

  if (input.includeAllCompetencies) {
    for (const [competencyId] of sources.competencies) {
      if (seenCompetencies.has(competencyId)) continue;
      seenCompetencies.add(competencyId);
      const competency = sources.competencies.get(competencyId)!;
      const blocks = sources.blocksByCompetency.get(competencyId) ?? [];
      if (blocks.length === 0) continue;
      const tags = tagsForBlocks(blocks);
      const needsCompetency =
        input.all || !isDescriptionValid(competency.definition, { kind: "competency", title: competency.title });
      const needsTags = input.all || tags.some((tag) => !isDescriptionValid(tag.definition, { kind: tag.kind, title: tag.title }));
      if (!needsCompetency && !needsTags) continue;
      jobs.push({
        kind: "competency",
        profession: { id: "it.uxui", title: "UX/UI-дизайнер" },
        competency,
        blocks,
        tags,
        sourceTitles: sources.sourceTitlesByCompetency.get(competencyId) ?? [],
      });
    }
  }
  const selectedJobs = input.limit ? jobs.slice(0, input.limit) : jobs;
  for (const job of selectedJobs) {
    if (job.kind === "profession") {
      const prompt = buildProfessionDescriptionPrompt({
        profession: {
          id: job.view.professionId,
          title: job.view.title,
          ...(job.view.titleEn ? { titleEn: job.view.titleEn } : {}),
        },
        ...(job.view.description ? { currentDescription: job.view.description } : {}),
        sections: job.view.sections.map((section) => ({
          title: section.title,
          definition: section.definition,
          competencies: section.competencies.map((item) => {
            const competency = sources.competencies.get(item.competencyId);
            return { title: competency?.title ?? item.competencyId, definition: competency?.definition ?? "" };
          }),
        })),
        sourceTitles: job.sourceTitles,
      });
      const result = await runStructuredStep({
        transport: input.transport,
        prompt,
        schema: descriptionResponseSchema,
        policy: input.policy,
        budget: input.budget,
        ...(input.cache ? { cache: input.cache } : {}),
        allowRepair: true,
      });
      const text = result.data?.professionDescription?.trim();
      const issues = text
        ? validateDescription(text, { kind: "profession", title: job.view.title })
        : [{ code: "missing", message: result.issues.join("; ") || "нет professionDescription" }];
      if (!text || issues.length > 0) {
        failures.push({ entity: "profession", id: job.view.professionId, reason: summarizeIssues(issues) });
        continue;
      }
      suggestions.push({
        entity: "profession",
        id: job.view.professionId,
        title: job.view.title,
        before: job.view.description ?? "",
        after: text,
        promptVersion: DESCRIPTION_PROMPT_VERSION,
        model: input.policy.model,
        generatedAt,
        validation: [],
        applied: input.write,
      });
      professionUpdates.set(job.view.professionId.split(".").pop() ?? job.view.professionId, text);
      continue;
    }

    const prompt = buildCompetencyDescriptionPrompt({
      profession: job.profession,
      competency: {
        id: job.competency.id,
        title: job.competency.title,
        ...(job.competency.titleEn ? { titleEn: job.competency.titleEn } : {}),
        definition: job.competency.definition,
      },
      blocks: job.blocks.map((block) => ({
        title: block.title,
        definition: block.definition,
        components: (block.components ?? []).map((component) => ({
          title: component.title,
          definition: component.definition,
        })),
      })),
      tags: job.tags.map((tag) => ({
        id: tag.id,
        title: tag.title,
        kind: tag.kind,
        definition: tag.definition,
        blockTitle: tag.blockTitle,
      })),
      sourceTitles: job.sourceTitles,
    });
    const result = await runStructuredStep({
      transport: input.transport,
      prompt,
      schema: descriptionResponseSchema,
      policy: input.policy,
      budget: input.budget,
      ...(input.cache ? { cache: input.cache } : {}),
      allowRepair: true,
    });
    if (!result.data) {
      failures.push({ entity: "competency", id: job.competency.id, reason: result.issues.join("; ") || "нет ответа" });
      continue;
    }
    if (result.data.competencyDefinition) {
      const definition = result.data.competencyDefinition.trim();
      const issues = validateDescription(definition, {
        kind: "competency",
        title: job.competency.title,
      });
      if (issues.length === 0) {
        suggestions.push({
          entity: "competency",
          id: job.competency.id,
          title: job.competency.title,
          before: job.competency.definition,
          after: definition,
          promptVersion: DESCRIPTION_PROMPT_VERSION,
          model: input.policy.model,
          generatedAt,
          validation: [],
          applied: input.write,
        });
        competencyUpdates.set(job.competency.id, definition);
      } else {
        failures.push({ entity: "competency", id: job.competency.id, reason: summarizeIssues(issues) });
      }
    }
    const tagById = new Map(job.tags.map((tag) => [tag.id, tag]));
    for (const item of result.data.tags ?? []) {
      const tag = tagById.get(item.id);
      if (!tag) {
        failures.push({ entity: "tag", id: item.id, reason: "тег не из контекста" });
        continue;
      }
      const definition = item.definition.trim();
      const issues = validateDescription(definition, { kind: tag.kind, title: tag.title });
      if (issues.length > 0) {
        failures.push({ entity: "tag", id: tag.id, reason: summarizeIssues(issues) });
        continue;
      }
      suggestions.push({
        entity: "tag",
        id: tag.id,
        title: tag.title,
        before: tag.definition,
        after: definition,
        promptVersion: DESCRIPTION_PROMPT_VERSION,
        model: input.policy.model,
        generatedAt,
        validation: [],
        applied: input.write,
      });
      tagUpdates.set(tag.id, definition);
    }
  }

  if (input.write && (professionUpdates.size > 0 || competencyUpdates.size > 0 || tagUpdates.size > 0)) {
    const applied = await applyDescriptionUpdates(input.root, {
      professions: professionUpdates,
      competencies: competencyUpdates,
      tags: tagUpdates,
    });
    for (const id of applied.missing) {
      failures.push({ entity: "competency", id, reason: "не найден в canonical/extra или каталоге" });
    }
  }

  return {
    generatedAt,
    scope: input.professionIds,
    mode: input.write ? "write" : "dry-run",
    suggestions,
    failures,
    budget: { calls: input.budget.calls, costUsd: input.budget.costUsd },
  };
}
