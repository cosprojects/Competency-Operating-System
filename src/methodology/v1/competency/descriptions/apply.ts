import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

export interface DescriptionUpdates {
  /** slug profession view → новое описание профессии. */
  professions: Map<string, string>;
  /** competencyId → новое определение. */
  competencies: Map<string, string>;
  /** tagId → новое определение знания/навыка. */
  tags: Map<string, string>;
}

export interface ApplyResult {
  views: number;
  canonical: number;
  extra: number;
  tags: number;
  missing: string[];
}

interface ExtraFile {
  competencies: Array<{ id: string; definition: string }>;
}

interface CanonicalFile {
  branches: Array<{ sections: Array<{ competencies: Array<{ id: string; definition: string }> }> }>;
}

interface CatalogFile {
  blocks: Array<{ tags?: Array<{ id: string; definition: string }> }>;
}

/** Обновляет описание профессии в view-файле. */
export async function applyProfessionDescriptions(
  root: string,
  descriptions: Map<string, string>,
): Promise<number> {
  const base = path.join(root, "src/methodology/v1/competency");
  const mapFile = path.join(base, "model/professions/descriptions.json");
  let payload: { descriptions?: Record<string, string> } = {};
  try {
    payload = await readJson<{ descriptions?: Record<string, string> }>(mapFile);
  } catch {
    payload = {};
  }
  const map = { ...(payload.descriptions ?? {}) };
  let changed = 0;
  for (const [slug, description] of descriptions) {
    const professionId = slug.includes(".") ? slug : `it.${slug}`;
    if (map[professionId] === description) continue;
    map[professionId] = description;
    changed += 1;
    const viewFile = path.join(base, "model/professions/views", `${slug}.json`);
    try {
      const view = await readJson<Record<string, unknown>>(viewFile);
      if (view.description !== description) {
        view.description = description;
        await writeJsonAtomic(viewFile, view);
      }
    } catch {
      // UX/UI не имеет view-файла — описание хранится только в descriptions.json.
    }
  }
  if (changed > 0) await writeJsonAtomic(mapFile, { descriptions: map });
  return changed;
}

/** Обновляет определения компетенций в canonical/uxui.json или competencies-extra.json. */
export async function applyCompetencyDescriptions(
  root: string,
  descriptions: Map<string, string>,
): Promise<{ canonical: number; extra: number; missing: string[] }> {
  const base = path.join(root, "src/methodology/v1/competency");
  const extraPath = path.join(base, "model/competencies-extra.json");
  const canonicalPath = path.join(base, "canonical/uxui.json");
  const extra = await readJson<ExtraFile>(extraPath);
  const canonical = await readJson<CanonicalFile>(canonicalPath);
  const extraById = new Map(extra.competencies.map((item) => [item.id, item]));
  let canonicalChanged = 0;
  let extraChanged = 0;
  const missing: string[] = [];
  for (const [id, definition] of descriptions) {
    const extraItem = extraById.get(id);
    if (extraItem) {
      if (extraItem.definition !== definition) {
        extraItem.definition = definition;
        extraChanged += 1;
      }
      continue;
    }
    let found = false;
    for (const branch of canonical.branches) {
      for (const section of branch.sections) {
        for (const competency of section.competencies) {
          if (competency.id !== id) continue;
          found = true;
          if (competency.definition !== definition) {
            competency.definition = definition;
            canonicalChanged += 1;
          }
        }
      }
    }
    if (!found) missing.push(id);
  }
  if (extraChanged > 0) await writeJsonAtomic(extraPath, extra);
  if (canonicalChanged > 0) await writeJsonAtomic(canonicalPath, canonical);
  return { canonical: canonicalChanged, extra: extraChanged, missing };
}

/** Обновляет определения знаний/навыков во всех accepted-блоках каталога. */
export async function applyTagDescriptions(
  root: string,
  descriptions: Map<string, string>,
): Promise<{ tags: number; missing: string[] }> {
  const file = path.join(root, "src/methodology/v1/competency/catalog/it.json");
  const catalog = await readJson<CatalogFile>(file);
  const seen = new Set<string>();
  let changed = 0;
  for (const block of catalog.blocks) {
    for (const tag of block.tags ?? []) {
      const definition = descriptions.get(tag.id);
      if (definition === undefined) continue;
      seen.add(tag.id);
      if (tag.definition !== definition) {
        tag.definition = definition;
        changed += 1;
      }
    }
  }
  const missing = [...descriptions.keys()].filter((id) => !seen.has(id));
  if (changed > 0) await writeJsonAtomic(file, catalog);
  return { tags: changed, missing };
}

export async function applyDescriptionUpdates(root: string, updates: DescriptionUpdates): Promise<ApplyResult> {
  const views = await applyProfessionDescriptions(root, updates.professions);
  const comps = await applyCompetencyDescriptions(root, updates.competencies);
  const tags = await applyTagDescriptions(root, updates.tags);
  return {
    views,
    canonical: comps.canonical,
    extra: comps.extra,
    tags: tags.tags,
    missing: [...comps.missing, ...tags.missing],
  };
}
