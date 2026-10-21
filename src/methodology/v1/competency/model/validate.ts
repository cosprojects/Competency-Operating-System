import type {
  CompetenciesFile,
  ProfessionCompetencyFile,
  ProfessionsFile,
  ProfessionSourceFile,
  SpheresFile,
  SphereSourceFile,
} from "./types.ts";

export function validateModel(input: {
  spheres: SpheresFile;
  professions: ProfessionsFile;
  competencies: CompetenciesFile;
  professionCompetencies: ProfessionCompetencyFile;
  sphereSource?: SphereSourceFile;
  professionSource?: ProfessionSourceFile;
}): string[] {
  const errors: string[] = [];
  const sphereIds = new Set(input.spheres.spheres.map((sphere) => sphere.id));
  const professionIds = new Set(input.professions.professions.map((profession) => profession.id));
  const competencyIds = new Set(input.competencies.competencies.map((competency) => competency.id));

  for (const sphere of input.spheres.spheres) {
    for (const professionId of sphere.professionIds) {
      if (!professionIds.has(professionId)) errors.push(`sphere «${sphere.id}»: профессия «${professionId}» не объявлена`);
    }
  }
  for (const profession of input.professions.professions) {
    if (!sphereIds.has(profession.sphereId)) errors.push(`profession «${profession.id}»: неизвестная сфера «${profession.sphereId}»`);
  }
  if (new Set(input.competencies.competencies.map((item) => item.id)).size !== input.competencies.competencies.length) {
    errors.push("competencies: повторяющиеся id");
  }
  const file = input.professionCompetencies;
  if (!professionIds.has(file.professionId)) errors.push(`profession-competencies: неизвестная профессия «${file.professionId}»`);
  const seenOrders = new Set<number>();
  const seenCompetencies = new Set<string>();
  for (const item of file.competencies) {
    if (!competencyIds.has(item.competencyId)) errors.push(`profession-competencies: неизвестная компетенция «${item.competencyId}»`);
    if (seenCompetencies.has(item.competencyId)) errors.push(`profession-competencies: повтор компетенции «${item.competencyId}»`);
    seenCompetencies.add(item.competencyId);
    if (!Number.isInteger(item.order) || item.order <= 0) errors.push(`profession-competencies «${item.competencyId}»: плохой order`);
    if (seenOrders.has(item.order)) errors.push(`profession-competencies: повтор order ${item.order}`);
    seenOrders.add(item.order);
    for (const prerequisite of item.prerequisites) {
      if (!competencyIds.has(prerequisite)) errors.push(`profession-competencies «${item.competencyId}»: неизвестный prerequisite «${prerequisite}»`);
    }
  }
  if (input.sphereSource && !sphereIds.has(input.sphereSource.sphereId)) {
    errors.push(`sphere-source: неизвестная сфера «${input.sphereSource.sphereId}»`);
  }
  if (input.professionSource) {
    if (!professionIds.has(input.professionSource.professionId)) errors.push(`profession-source: неизвестная профессия «${input.professionSource.professionId}»`);
    if (!sphereIds.has(input.professionSource.sphereId)) errors.push(`profession-source: неизвестная сфера «${input.professionSource.sphereId}»`);
  }
  return errors;
}
