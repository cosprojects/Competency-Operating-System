import path from "node:path";
import type { ProfessionSourceFile } from "../model/types.ts";
import type { ProfessionTarget } from "../types.ts";

export async function loadProfessionSource(
  root: string,
  domain: string,
  professionId: string,
  readJson: <T>(file: string) => Promise<T>,
): Promise<ProfessionSourceFile | undefined> {
  try {
    return await readJson<ProfessionSourceFile>(
      path.join(root, "src/methodology/v1/competency/sources/professions", `${professionId}.json`),
    );
  } catch {
    return undefined;
  }
}

/**
 * Применяет source-файл профессии к target:
 * - разрешает только объявленные occupation sources;
 * - подставляет query для ESCO и slug для Практикума.
 */
export function applyProfessionSource(
  target: ProfessionTarget,
  source: ProfessionSourceFile | undefined,
): ProfessionTarget {
  if (!source) return target;
  const allowed = new Set(source.occupationSources.map((item) => item.sourceId));
  const query = (sourceId: string): string | undefined =>
    source.occupationSources.find((item) => item.sourceId === sourceId)?.query;
  const escoQuery = query("esco");
  const practicumQuery = query("practicum");
  const result: ProfessionTarget = {
    ...target,
    ...(target.esco && allowed.has("esco")
      ? { esco: { ...target.esco, ...(escoQuery ? { search: escoQuery } : {}) } }
      : { esco: undefined }),
    ...(target.onet && allowed.has("onet") ? { onet: target.onet } : { onet: undefined }),
    ...(target.practicum && allowed.has("practicum")
      ? { practicum: { ...target.practicum, ...(practicumQuery ? { slug: practicumQuery } : {}) } }
      : { practicum: undefined }),
  };
  return result;
}
