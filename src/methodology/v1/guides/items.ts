/**
 * Выборка пунктов (знаний и навыков) для прогона агента разборов.
 *
 * Пункты берутся из публикации (`apps/web/src/content/generated/beta-1.json`), уникальные по id:
 * один и тот же тег может встречаться в нескольких компетенциях и профессиях, поэтому
 * `pickItems` дедуплицирует его внутри профессии, а прогон `--profession all --skip-existing` —
 * между профессиями (через кластер разборов).
 */

import type { ItemInput, ItemKind } from "./types.ts";

export interface PublicItem {
  id: string;
  title: string;
  definition?: string;
}

export interface PublicCompetency {
  id: string;
  title: string;
  knowledge: PublicItem[];
  skills: PublicItem[];
}

export interface PublicProfession {
  slug: string;
  sections: Array<{ title: string; competencies: PublicCompetency[] }>;
}

export interface PublicContent {
  professions: PublicProfession[];
}

function interleave(
  knowledge: PublicItem[],
  skills: PublicItem[],
): Array<PublicItem & { kind: ItemKind }> {
  const result: Array<PublicItem & { kind: ItemKind }> = [];
  const max = Math.max(knowledge.length, skills.length);
  for (let index = 0; index < max; index += 1) {
    const known = knowledge[index];
    if (known) result.push({ ...known, kind: "knowledge" });
    const skill = skills[index];
    if (skill) result.push({ ...skill, kind: "skill" });
  }
  return result;
}

/**
 * Уникальные пункты по кругу между компетенциями: покрытие тем и оба типа.
 * `skip` отбрасывает уже покрытые пункты, но не мешает пройти следующие круги,
 * поэтому лимит считается только по реально выбранным пунктам.
 */
export function pickItems(
  profession: PublicProfession,
  limit: number,
  skip?: (id: string) => boolean,
): ItemInput[] {
  const queues = profession.sections.flatMap((section) =>
    section.competencies.map((competency) => ({
      sectionTitle: section.title,
      competencyTitle: competency.title,
      items: interleave(competency.knowledge, competency.skills),
    })),
  );
  const result: ItemInput[] = [];
  const seen = new Set<string>();
  // Идём до конца самой длинной очереди, а не до круга, где не нашлось новых пунктов:
  // общий для нескольких компетенций тег может «закрыть» круг, за которым ещё есть пункты.
  const maxLength = queues.reduce((max, queue) => Math.max(max, queue.items.length), 0);
  for (let round = 0; round < maxLength; round += 1) {
    for (const queue of queues) {
      const item = queue.items[round];
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      if (skip?.(item.id)) continue;
      result.push({
        id: item.id,
        kind: item.kind,
        title: item.title,
        definition: item.definition ?? "",
        competencyTitle: queue.competencyTitle,
        sectionTitle: queue.sectionTitle,
      });
      if (result.length >= limit) return result;
    }
  }
  return result;
}

/** Порядок профессий для полного прогона: продуктовая Beta 1 первой, остальные — как в публикации. */
export function professionOrder(professions: Array<{ slug: string }>): string[] {
  const slugs = professions.map((profession) => profession.slug);
  return ["uxui", ...slugs.filter((slug) => slug !== "uxui")];
}
