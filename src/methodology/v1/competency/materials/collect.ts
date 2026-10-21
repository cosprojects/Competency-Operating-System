import type { FetchLike } from "../../candidate-parser/types.ts";
import type { CompetencyBlock, Material, MaterialKind } from "../types.ts";
import { hashId } from "../sources/common.ts";
import {
  searchInternetArchive,
  searchStepik,
  searchWikipedia,
  searchYoutube,
  type MaterialDraft,
} from "./sources.ts";

export interface MaterialCollectInput {
  competencies: CompetencyBlock[];
  fetchImpl: FetchLike;
  retrievedOn: string;
  sourceIds?: string[];
  limitPerCompetency?: number;
  youtubeApiKey?: string;
}

export interface MaterialCoverage {
  competencyId: string;
  title: string;
  materials: number;
  kinds: Partial<Record<MaterialKind, number>>;
  noMaterialState?: "no_material" | "source_unavailable" | "blocked";
}

export interface MaterialCollectResult {
  materials: Material[];
  coverage: MaterialCoverage[];
  notes: string[];
}

interface Adapter {
  id: string;
  search: (query: string) => Promise<MaterialDraft[]>;
}

export function materialIdFor(draft: MaterialDraft): string {
  return hashId("material", `${draft.provider}|${draft.sourceRef.externalId}`);
}

function toMaterial(draft: MaterialDraft, competencyId: string): Material {
  return {
    id: materialIdFor(draft),
    slug: hashId("mat", draft.canonicalUrl),
    kind: draft.kind,
    title: draft.title,
    provider: draft.provider,
    url: draft.url,
    canonicalUrl: draft.canonicalUrl,
    language: draft.language,
    access: draft.access,
    ...(draft.price ? { price: draft.price } : {}),
    description: draft.description,
    ...(draft.snippet ? { snippet: draft.snippet } : {}),
    license: draft.license,
    sourceRef: draft.sourceRef,
    ...(draft.publishedAt ? { publishedAt: draft.publishedAt } : {}),
    retrievedAt: draft.retrievedAt,
    links: [],
    discoveredFor: [competencyId],
    status: "candidate",
    issues: [],
  };
}

export async function collectMaterials(input: MaterialCollectInput): Promise<MaterialCollectResult> {
  const limit = input.limitPerCompetency ?? 3;
  const selected = new Set(
    input.sourceIds ?? ["wikipedia", "internet-archive", "stepik", "youtube"],
  );
  const allAdapters: Adapter[] = [
    {
      id: "wikipedia",
      search: (query) => searchWikipedia(input.fetchImpl, query, input.retrievedOn, limit),
    },
    {
      id: "internet-archive",
      search: (query) => searchInternetArchive(input.fetchImpl, query, input.retrievedOn, limit),
    },
    {
      id: "stepik",
      search: (query) => searchStepik(input.fetchImpl, query, input.retrievedOn, limit),
    },
    {
      id: "youtube",
      search: (query) =>
        searchYoutube(input.fetchImpl, query, input.retrievedOn, input.youtubeApiKey, limit),
    },
  ];
  const adapters = allAdapters.filter((adapter) => selected.has(adapter.id));

  const byUrl = new Map<string, Material>();
  const coverage: MaterialCoverage[] = [];
  const notes: string[] = [];

  for (const competency of input.competencies) {
    const kinds: Partial<Record<MaterialKind, number>> = {};
    let found = 0;
    for (const adapter of adapters) {
      try {
        const drafts = await adapter.search(competency.title);
        for (const draft of drafts) {
          const key = draft.canonicalUrl || draft.url;
          const existing = byUrl.get(key);
          if (existing) {
            if (!existing.discoveredFor.includes(competency.id)) {
              existing.discoveredFor.push(competency.id);
            }
            found += 1;
            kinds[draft.kind] = (kinds[draft.kind] ?? 0) + 1;
            continue;
          }
          byUrl.set(key, toMaterial(draft, competency.id));
          found += 1;
          kinds[draft.kind] = (kinds[draft.kind] ?? 0) + 1;
        }
      } catch (error) {
        notes.push(
          `${competency.title} / ${adapter.id}: ${error instanceof Error ? error.message : "ошибка источника"}`,
        );
      }
    }
    coverage.push({
      competencyId: competency.id,
      title: competency.title,
      materials: found,
      kinds,
      ...(found === 0
        ? { noMaterialState: notes.length > 0 ? ("source_unavailable" as const) : ("no_material" as const) }
        : {}),
    });
  }

  return {
    materials: [...byUrl.values()].sort((a, b) => a.title.localeCompare(b.title)),
    coverage,
    notes,
  };
}
