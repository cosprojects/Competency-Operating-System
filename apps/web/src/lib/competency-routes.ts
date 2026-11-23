import { findCompetencies } from "./content";

/**
 * Адреса страниц компетенций.
 *
 * Одна компетенция может входить в несколько профессий: «Теория цвета» есть и у
 * UX/UI, и у 3D-дизайнера. Содержание (определение, знания, навыки, материалы)
 * у неё одно, поэтому каноническая страница тоже одна — первое вхождение в
 * модели. Остальные адреса открываются с картой своей профессии, но в метаданных
 * указывают canonical на основную страницу: иначе поисковик увидит полторы сотни
 * почти одинаковых документов и выберет из них случайный.
 */
export function competencyPath(professionSlug: string, competencyId: string): string {
  return `/professions/${professionSlug}/${competencyId}`;
}

/** Канонический адрес компетенции — первое вхождение в модели. */
export function primaryCompetencyPath(competencyId: string): string | undefined {
  const occurrence = findCompetencies(competencyId)[0];
  if (!occurrence) return undefined;
  return competencyPath(occurrence.profession.slug, occurrence.competency.id);
}
