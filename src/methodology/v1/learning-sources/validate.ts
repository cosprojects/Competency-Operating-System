import type { LearningSourceRegistry } from "./types.ts";

export function validateLearningSources(registry: LearningSourceRegistry): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const source of registry.sources) {
    if (ids.has(source.id)) errors.push(`duplicate source id: ${source.id}`);
    ids.add(source.id);
    if (!source.url.startsWith("https://")) errors.push(`${source.id}: url must be https`);
    if (source.professionIds.length === 0) errors.push(`${source.id}: no professionIds`);
    if (source.status === "duplicate" && !source.duplicateOf) errors.push(`${source.id}: duplicate without duplicateOf`);
    if (source.duplicateOf && !registry.sources.some((item) => item.id === source.duplicateOf)) {
      errors.push(`${source.id}: duplicateOf target not found`);
    }
    if (source.discoveryOnly && source.authority === "primary") {
      errors.push(`${source.id}: discoveryOnly не может быть primary источником`);
    }
    if (source.status === "blocked" && source.authority === "primary") {
      errors.push(`${source.id}: blocked primary source needs review`);
    }
  }
  return errors;
}
