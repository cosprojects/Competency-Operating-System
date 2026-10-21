import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CatalogFile, TagRecord } from "./types.ts";

export function emptyCatalog(domain: string, updatedOn: string): CatalogFile {
  return {
    catalogVersion: "0.1.0",
    domain,
    updatedOn,
    blocks: [],
    tags: [],
    materials: [],
  };
}

export async function loadCatalog(root: string, domain: string): Promise<CatalogFile> {
  const file = path.join(root, "src/methodology/v1/competency/catalog", `${domain}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as CatalogFile;
  } catch {
    return emptyCatalog(domain, new Date().toISOString().slice(0, 10));
  }
}

export function validateCatalog(catalog: CatalogFile, tagsById?: Map<string, TagRecord>): string[] {
  const errors: string[] = [];
  if (!catalog.catalogVersion) errors.push("catalogVersion не задан");
  if (!catalog.domain) errors.push("domain не задан");
  if (!catalog.updatedOn) errors.push("updatedOn не задан");
  if (!Array.isArray(catalog.blocks)) errors.push("blocks не массив");
  if (!Array.isArray(catalog.tags)) errors.push("tags не массив");
  if (!Array.isArray(catalog.materials)) errors.push("materials не массив");

  const blockIds = new Set<string>();
  const blockSlugs = new Set<string>();
  const tagIds = new Set<string>((catalog.tags ?? []).map((tag) => tag.id));
  for (const block of catalog.blocks ?? []) {
    if (!block.id || !block.slug || !block.title) errors.push("block: нет id/slug/title");
    if (blockIds.has(block.id)) errors.push(`block: повтор id «${block.id}»`);
    if (blockSlugs.has(block.slug)) errors.push(`block: повтор slug «${block.slug}»`);
    blockIds.add(block.id);
    blockSlugs.add(block.slug);
    if (block.status !== "accepted") errors.push(`block «${block.slug}»: в каталоге только accepted`);
    if (!block.definition || block.definition.length < 20) errors.push(`block «${block.slug}»: короткое definition`);
    if (block.components.length < 2) errors.push(`block «${block.slug}»: меньше 2 компонентов`);
    const componentIds = new Set<string>();
    for (const component of block.components) {
      if (componentIds.has(component.id)) errors.push(`block «${block.slug}»: повтор компонента «${component.id}»`);
      componentIds.add(component.id);
      if (!component.title || !component.definition) errors.push(`component «${component.id}»: пустые поля`);
      for (const tagId of component.tagIds) {
        if (!tagIds.has(tagId) && tagsById && !tagsById.has(tagId)) {
          errors.push(`block «${block.slug}»: тег «${tagId}» не найден`);
        }
      }
    }
    for (const tag of block.tags ?? []) {
      if (!tagIds.has(tag.id)) errors.push(`block «${block.slug}»: tags[] не содержит «${tag.id}»`);
    }
  }

  const materialIds = new Set<string>();
  for (const material of catalog.materials ?? []) {
    if (!material.id || !material.title || !material.url) errors.push("material: нет id/title/url");
    if (materialIds.has(material.id)) errors.push(`material: повтор id «${material.id}»`);
    materialIds.add(material.id);
    if (material.status !== "accepted") errors.push(`material «${material.id}»: в каталоге только accepted`);
    if (!/^https?:\/\//.test(material.canonicalUrl)) errors.push(`material «${material.id}»: плохой canonicalUrl`);
    for (const link of material.links) {
      if (!blockIds.has(link.competencyId)) {
        errors.push(`material «${material.id}»: компетенции «${link.competencyId}» нет в каталоге`);
      }
    }
  }

  return errors;
}
