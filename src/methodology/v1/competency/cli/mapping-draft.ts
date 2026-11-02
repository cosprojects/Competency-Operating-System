import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { ProfessionView } from "../model/profession-view.ts";
import type { TagRecord } from "../types.ts";
import type { MappingEntry, TagMappingFile } from "../mapping/types.ts";
import { dataDir, flagValue, readJson } from "./common.ts";
import { normalizeTitle } from "../sources/common.ts";

const STOP = new Set([
  "и", "в", "на", "для", "по", "с", "как", "что", "это", "или", "из", "к", "у", "о", "об",
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "you", "are", "not",
  "a", "an", "of", "to", "in", "on", "is", "as", "at", "by", "or", "be",
]);

function tokens(value: string): string[] {
  return value.toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9]+/).filter((token) => token.length >= 3 && !STOP.has(token));
}

function overlap(tag: TagRecord, view: ProfessionView, competencyId: string, titles: Map<string, string>): number {
  const title = `${titles.get(competencyId) ?? ""}`;
  const tagTokens = new Set([...tokens(tag.title), ...tokens(tag.definition)]);
  const target = [...tokens(title)];
  let score = 0;
  for (const token of target) {
    if (tagTokens.has(token)) score += 3;
    else if ([...tagTokens].some((item) => item.startsWith(token) || token.startsWith(item))) score += 1;
  }
  const normalizedTag = tag.title.toLowerCase();
  if (title && (normalizedTag.includes(title.toLowerCase()) || title.toLowerCase().includes(normalizedTag))) score += 4;
  return score;
}

function writeMapping(professionId: string, view: ProfessionView, tags: TagRecord[], titles: Map<string, string>): TagMappingFile {
  const competencyIds = view.sections.flatMap((section) => section.competencies.map((item) => item.competencyId));
  const toolTitles = new Set(tags.filter((tag) => tag.kind === "tool").map((tag) => normalizeTitle(tag.title)));
  const candidates = tags
    .filter((tag) => (tag.kind === "knowledge" || tag.kind === "skill") && !toolTitles.has(normalizeTitle(tag.title)))
    .map((tag) => {
      let best = { id: competencyIds[0]!, score: 0 };
      for (const id of competencyIds) {
        const score = overlap(tag, view, id, titles);
        if (score > best.score) best = { id, score };
      }
      return { tag, ...best };
    });
  const assigned = new Map<string, Array<{ title: string; relation: "direct" | "adjacent" }>>();
  const excluded: Array<{ title: string; reason: string }> = [];
  for (const item of candidates) {
    if (item.score >= 2) {
      const list = assigned.get(item.id) ?? [];
      list.push({ title: item.tag.title, relation: item.score >= 5 ? "direct" : "adjacent" });
      assigned.set(item.id, list);
    } else {
      excluded.push({
        title: item.tag.title,
        reason: "Нет устойчивого совпадения с компетенцией; тег оставлен как контекст и требует ручного review.",
      });
    }
  }
  const entries: MappingEntry[] = competencyIds.map((competencyId) => ({
    competencyId,
    tags: assigned.get(competencyId) ?? [],
    rationale:
      assigned.has(competencyId)
        ? "Черновая эвристическая привязка собранных тегов к компетенции; требуется human-review."
        : "Прямых тегов в собранном Practicum-наборе нет; нужна дополнительная evidence-проверка.",
  }));
  return {
    mappingVersion: "1.0.0",
    domain: "it",
    professionId,
    updatedOn: new Date().toISOString().slice(0, 10),
    status: "draft",
    description: "Черновой heuristic mapping собранных Practicum-тегов к profession view; не приёмка.",
    entries,
    excludedTags: excluded,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const profession = flagValue(argv, "--profession");
  const all = argv.includes("--all");
  const model = await readJson<{ competencies: Array<{ id: string; title: string }> }>(
    path.join(root, "src/methodology/v1/competency/model/competencies.json"),
  );
  const titles = new Map(model.competencies.map((item) => [item.id, item.title]));
  const professions = all
    ? (await readJson<{ professions: Array<{ id: string }> }>(path.join(root, "src/methodology/v1/competency/model/professions.json"))).professions
    : profession ? [{ id: profession.includes(".") ? profession : `it.${profession}` }] : [];
  if (professions.length === 0) throw new Error("Нужен --profession <slug> или --all");
  for (const item of professions) {
    const slug = item.id.split(".").pop()!;
    const view = await readJson<ProfessionView>(path.join(root, "src/methodology/v1/competency/model/professions/views", `${slug}.json`));
    const tagsFile = await readJson<{ tags: TagRecord[] }>(path.join(dataDir(root), `tags-it-${slug}.json`)).catch(() => undefined);
    if (!tagsFile) {
      console.log(`${item.id}: нет tags-it-${slug}.json; пропуск`);
      continue;
    }
    const mapping = writeMapping(item.id, view, tagsFile.tags, titles);
    const out = path.join(root, "src/methodology/v1/competency/mapping", `${item.id}.json`);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
    const direct = mapping.entries.reduce((n, entry) => n + entry.tags.filter((tag) => tag.relation === "direct").length, 0);
    const adjacent = mapping.entries.reduce((n, entry) => n + entry.tags.filter((tag) => tag.relation === "adjacent").length, 0);
    const none = mapping.entries.filter((entry) => entry.tags.length === 0).length;
    console.log(`${item.id}: competencies ${mapping.entries.length}; direct ${direct}; adjacent ${adjacent}; none ${none}; excluded ${mapping.excludedTags?.length ?? 0}`);
    console.log(out);
  }
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
