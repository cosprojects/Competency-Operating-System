import path from "node:path";
import type { ProfessionSourceFile } from "../competency/model/types.ts";

export async function loadMaterialSourceIds(
  root: string,
  professionId: string,
  readJson: <T>(file: string) => Promise<T>,
): Promise<string[] | undefined> {
  try {
    const file = path.join(root, "src/methodology/v1/competency/sources/professions", `${professionId}.json`);
    const source = await readJson<ProfessionSourceFile>(file);
    return source.materialSourceIds;
  } catch {
    return undefined;
  }
}
