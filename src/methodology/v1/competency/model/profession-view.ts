import type { GlobalCompetency, ProfessionCompetencyFile } from "./types.ts";

export interface ProfessionViewCompetency {
  competencyId: string;
  tier: "foundation" | "core" | "optional";
  order: number;
  prerequisites?: string[];
}

export interface ProfessionViewSection {
  id: string;
  title: string;
  definition: string;
  competencies: ProfessionViewCompetency[];
}

export interface ProfessionView {
  viewVersion: "1.0.0";
  professionId: string;
  sphereId: string;
  title: string;
  titleEn?: string;
  sections: ProfessionViewSection[];
}

export function buildProfessionCompetenciesFromView(
  view: ProfessionView,
  competencies: GlobalCompetency[],
): ProfessionCompetencyFile {
  const existing = new Set(competencies.map((item) => item.id));
  const list = [];
  const seen = new Set<string>();
  for (const section of view.sections) {
    for (const competency of section.competencies) {
      if (!existing.has(competency.competencyId)) throw new Error(`view ${view.professionId}: неизвестная компетенция «${competency.competencyId}»`);
      if (seen.has(competency.competencyId)) throw new Error(`view ${view.professionId}: повтор компетенции «${competency.competencyId}»`);
      seen.add(competency.competencyId);
      list.push({
        competencyId: competency.competencyId,
        tier: competency.tier,
        order: competency.order,
        prerequisites: [],
        sectionId: section.id,
        sectionTitle: section.title,
      });
    }
  }
  return { professionId: view.professionId, sphereId: view.sphereId, competencies: list };
}

export function validateProfessionView(view: ProfessionView, competencies: GlobalCompetency[]): string[] {
  const errors: string[] = [];
  if (view.viewVersion !== "1.0.0") errors.push(`view ${view.professionId}: неверная viewVersion`);
  if (!view.professionId || !view.sphereId || !view.title) errors.push(`view: нет professionId/sphereId/title`);
  const existing = new Set(competencies.map((item) => item.id));
  const orders = new Set<number>();
  const seen = new Set<string>();
  for (const section of view.sections) {
    if (!section.id || !section.title) errors.push(`view ${view.professionId}: секция без id/title`);
    for (const item of section.competencies) {
      if (!existing.has(item.competencyId)) errors.push(`view ${view.professionId}: неизвестная компетенция «${item.competencyId}»`);
      if (seen.has(item.competencyId)) errors.push(`view ${view.professionId}: повтор компетенции «${item.competencyId}»`);
      seen.add(item.competencyId);
      if (!Number.isInteger(item.order) || item.order <= 0) errors.push(`view ${view.professionId} «${item.competencyId}»: плохой order`);
      if (orders.has(item.order)) errors.push(`view ${view.professionId}: повтор order ${item.order}`);
      orders.add(item.order);
    }
  }
  return errors;
}
