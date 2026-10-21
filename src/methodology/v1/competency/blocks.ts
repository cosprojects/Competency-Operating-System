import type { CacheOptions } from "../profile/cache.ts";
import type {
  CompetencyBlock,
  CompetencyCandidate,
  CompetencyComponent,
  LlmMeta,
  SourceRef,
  TagRecord,
} from "./types.ts";
import { hashId, normalizeTitle, slugify, uniqueBy } from "./sources/common.ts";
import type { BlockResponse } from "./llm/schemas.ts";
import { blockResponseSchema } from "./llm/schemas.ts";
import { buildBlockPrompt } from "./llm/prompts.ts";
import { runStructuredStep } from "./llm/run.ts";
import type { LlmPolicy } from "./llm/policy.ts";
import { BudgetExceededError, type LlmBudget } from "./llm/policy.ts";
import type { LlmTransport } from "./llm/transport.ts";

export interface ValidatedBlockItem {
  title: string;
  kind: "knowledge" | "skill";
  definition: string;
  evidenceTagIds: string[];
  modelProposal: boolean;
}

export interface ValidatedBlockComponent {
  title: string;
  definition: string;
  items: ValidatedBlockItem[];
}

export interface ValidatedBlock {
  title: string;
  titleEn?: string;
  aliases: string[];
  definition: string;
  scope: "universal" | "profession";
  components: ValidatedBlockComponent[];
  unresolved: string[];
  issues: string[];
  coverage: number;
}

const BANNED_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /\b(гарантир|доказанн|научно подтвержд)/i,
];

export function validateBlockResponse(
  response: BlockResponse,
  input: {
    allowedTagIds: Set<string>;
    existingTitles: string[];
  },
): ValidatedBlock {
  const issues: string[] = [];
  const normalizedTitle = normalizeTitle(response.title);
  if (input.existingTitles.some((title) => normalizeTitle(title) === normalizedTitle)) {
    issues.push("компетенция с таким названием уже есть в каталоге или среди блоков");
  }
  const componentTitles = new Set<string>();
  const itemTitles = new Set<string>();
  const used = new Set<string>();
  const components: ValidatedBlockComponent[] = [];

  for (const component of response.components) {
    const componentKey = normalizeTitle(component.title);
    if (componentTitles.has(componentKey)) issues.push(`дубль компонента «${component.title}»`);
    componentTitles.add(componentKey);
    const items: ValidatedBlockItem[] = [];
    for (const item of component.items) {
      const itemIssues: string[] = [];
      const itemKey = `${normalizeTitle(item.title)}|${item.kind}`;
      if (itemTitles.has(itemKey)) itemIssues.push(`дубль тега «${item.title}»`);
      itemTitles.add(itemKey);
      if (!item.modelProposal && item.evidenceTagIds.length === 0) {
        itemIssues.push("modelProposal=false, но evidenceTagIds пуст");
      }
      const evidenceTagIds: string[] = [];
      for (const tagId of item.evidenceTagIds) {
        if (!input.allowedTagIds.has(tagId)) {
          itemIssues.push(`неизвестный evidenceTagId «${tagId}»`);
          continue;
        }
        evidenceTagIds.push(tagId);
        used.add(tagId);
      }
      if (BANNED_PATTERNS.some((pattern) => pattern.test(item.definition))) {
        itemIssues.push("в определении запрещённая формулировка или URL");
      }
      if (itemIssues.length > 0) {
        issues.push(...itemIssues.map((issue) => `${component.title} / ${item.title}: ${issue}`));
        continue;
      }
      items.push({
        title: item.title,
        kind: item.kind,
        definition: item.definition,
        evidenceTagIds,
        modelProposal: item.modelProposal,
      });
    }
    if (items.length > 0) {
      components.push({ title: component.title, definition: component.definition, items });
    }
  }

  const allowedCount = input.allowedTagIds.size;
  const coverage = allowedCount === 0 ? 0 : used.size / allowedCount;
  if (coverage < 0.5) {
    issues.push(`покрытие входных тегов ${Math.round(coverage * 100)}% < 50%`);
  }
  if (components.length < 2) issues.push("после валидации осталось меньше 2 компонентов");

  return {
    title: response.title,
    ...(response.titleEn ? { titleEn: response.titleEn } : {}),
    aliases: response.aliases,
    definition: response.definition,
    scope: response.scope,
    components,
    unresolved: response.unresolved,
    issues,
    coverage,
  };
}

export interface BlockBuildInput {
  domain: string;
  candidates: CompetencyCandidate[];
  tags: TagRecord[];
  professionTitles?: Record<string, string>;
  transport: LlmTransport;
  policy: LlmPolicy;
  budget: LlmBudget;
  cache?: CacheOptions;
  existingCatalogTitles?: string[];
  limit?: number;
  allowRepair?: boolean;
}

export interface BlockBuildResult {
  blocks: CompetencyBlock[];
  tags: TagRecord[];
  issues: string[];
  runs: LlmMeta[];
}

function sourceRefsOf(tags: TagRecord[]): SourceRef[] {
  return uniqueBy(
    tags.flatMap((tag) => tag.sourceRefs),
    (ref) => `${ref.sourceId}|${ref.externalId}`,
  );
}

export async function buildBlocks(input: BlockBuildInput): Promise<BlockBuildResult> {
  const tagsById = new Map(input.tags.map((tag) => [tag.id, tag]));
  const tagsByKey = new Map(input.tags.map((tag) => [`${normalizeTitle(tag.title)}|${tag.kind}`, tag]));
  const createdTags = new Map<string, TagRecord>();
  const existingTitles = [...(input.existingCatalogTitles ?? [])];
  const blocks: CompetencyBlock[] = [];
  const issues: string[] = [];
  const runs: LlmMeta[] = [];
  const selected = input.limit ? input.candidates.slice(0, input.limit) : input.candidates;

  for (const candidate of selected) {
    const candidateTags = candidate.tagIds
      .map((tagId) => tagsById.get(tagId))
      .filter((tag): tag is TagRecord => tag !== undefined);
    if (candidateTags.length < 2) {
      issues.push(`кандидат «${candidate.title}»: меньше 2 известных тегов`);
      continue;
    }
    const allowedTagIds = new Set(candidateTags.map((tag) => tag.id));
    const prompt = buildBlockPrompt({
      candidateTitle: candidate.title,
      candidateDefinition: candidate.definition,
      scopeHint: candidate.scopeHint,
      professionTitles: candidate.professionIds.map((id) => input.professionTitles?.[id] ?? id),
      tags: candidateTags,
      existingCatalogTitles: existingTitles,
    });
    let step;
    try {
      step = await runStructuredStep({
        transport: input.transport,
        prompt,
        schema: blockResponseSchema,
        policy: input.policy,
        budget: input.budget,
        ...(input.cache ? { cache: input.cache } : {}),
        ...(input.allowRepair === false ? { allowRepair: false } : {}),
      });
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        issues.push(error.message);
        break;
      }
      throw error;
    }
    runs.push(step.meta);
    if (!step.data) {
      issues.push(...step.issues.map((issue) => `${candidate.title}: ${issue}`));
      continue;
    }
    const validated = validateBlockResponse(step.data as BlockResponse, { allowedTagIds, existingTitles });
    issues.push(...validated.issues.map((issue) => `${candidate.title}: ${issue}`));
    if (validated.components.length < 2) continue;

    const blockId = hashId("comp", normalizeTitle(validated.title));
    const blockSlug = slugify(validated.title, "competency");
    const blockTags: TagRecord[] = [];
    const components: CompetencyComponent[] = [];

    for (const component of validated.components) {
      const componentId = `${blockSlug}.${slugify(component.title, "component")}`;
      const componentTagIds: string[] = [];
      for (const item of component.items) {
        const evidenceTags = item.evidenceTagIds
          .map((tagId) => tagsById.get(tagId))
          .filter((tag): tag is TagRecord => tag !== undefined);
        const key = `${normalizeTitle(item.title)}|${item.kind}`;
        let tag = tagsByKey.get(key);
        if (!tag) {
          tag = {
            id: hashId("tag", key),
            slug: slugify(item.title, "tag"),
            title: item.title,
            aliases: [],
            kind: item.kind,
            definition: item.definition,
            professionIds: [...candidate.professionIds],
            sourceRefs: sourceRefsOf(evidenceTags),
            evidenceState: item.modelProposal
              ? "needs_review"
              : sourceRefsOf(evidenceTags).length > 0
                ? "supported"
                : "needs_review",
            competencyLinks: [],
            materialIds: [],
            needsReview: item.modelProposal || sourceRefsOf(evidenceTags).length === 0,
          };
          tagsByKey.set(key, tag);
          createdTags.set(tag.id, tag);
        }
        if (!tag.competencyLinks.some((link) => link.competencyId === blockId && link.componentId === componentId)) {
          tag.competencyLinks.push({ competencyId: blockId, componentId, role: "primary" });
        }
        for (const professionId of candidate.professionIds) {
          if (!tag.professionIds.includes(professionId)) tag.professionIds.push(professionId);
        }
        if (!tag.definition && item.definition) tag.definition = item.definition;
        const refs = sourceRefsOf(evidenceTags);
        for (const ref of refs) {
          if (!tag.sourceRefs.some((item) => `${item.sourceId}|${item.externalId}` === `${ref.sourceId}|${ref.externalId}`)) {
            tag.sourceRefs.push(ref);
          }
        }
        if (tag.sourceRefs.length > 0) tag.evidenceState = "supported";
        if (!blockTags.some((item) => item.id === tag.id)) blockTags.push(tag);
        componentTagIds.push(tag.id);
      }
      components.push({
        id: componentId,
        slug: slugify(component.title, "component"),
        title: component.title,
        definition: component.definition,
        order: components.length + 1,
        tagIds: componentTagIds,
      });
    }

    const allEvidence = uniqueBy(
      blockTags.flatMap((tag) => tag.sourceRefs),
      (ref) => `${ref.sourceId}|${ref.externalId}`,
    );
    const modelOnly = blockTags.some((tag) => tag.needsReview || tag.evidenceState === "needs_review");
    const block: CompetencyBlock = {
      id: blockId,
      slug: blockSlug,
      title: validated.title,
      ...(validated.titleEn ? { titleEn: validated.titleEn } : {}),
      aliases: validated.aliases,
      definition: validated.definition,
      scope: validated.scope,
      professionIds: [...candidate.professionIds],
      components,
      tags: blockTags,
      sourceRefs: allEvidence,
      evidenceState: modelOnly ? "needs_review" : "supported",
      status: "needs_review",
      llmMeta: step.meta,
      issues: validated.issues,
      methodologyVersion: "0.1.0",
    };
    blocks.push(block);
    existingTitles.push(validated.title);
  }

  return {
    blocks: blocks.sort((a, b) => a.title.localeCompare(b.title)),
    tags: [...createdTags.values()].sort((a, b) => a.title.localeCompare(b.title)),
    issues,
    runs,
  };
}
