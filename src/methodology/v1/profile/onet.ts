import type { FetchLike } from "../candidate-parser/types.ts";

/** Строка O*NET Software Skills. */
export interface OnetSoftwareRow {
  socCode: string;
  occupationTitle: string;
  workplaceExample: string;
  hotTechnology: boolean;
  inDemand: boolean;
}

/** RFC 4180-подобный разбор: кавычки, удвоенные кавычки, запятые внутри поля. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      index += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
      continue;
    }
    if (char === "\r") {
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function requireText(response: { text?: () => Promise<string> }): Promise<string> {
  if (typeof response.text !== "function") {
    throw new Error("Ответ O*NET не дал текст CSV");
  }
  return response.text();
}

export async function readOnetSoftwareSkills(
  fetchImpl: FetchLike,
  csvUrl: string,
): Promise<OnetSoftwareRow[]> {
  const response = await fetchImpl(csvUrl, {
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`O*NET ответил ${response.status} на ${csvUrl}`);
  const text = await requireText(response as unknown as { text?: () => Promise<string> });
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) throw new Error("O*NET CSV пуст");
  const index = new Map<string, number>();
  for (let i = 0; i < header.length; i += 1) {
    const name = header[i]?.trim();
    if (name) index.set(name, i);
  }
  const soc = index.get("O*NET-SOC Code");
  const title = index.get("Title");
  const example = index.get("Workplace Example");
  const hot = index.get("Hot Technology");
  const demand = index.get("In Demand");
  if (soc === undefined || title === undefined || example === undefined) {
    throw new Error("O*NET CSV: нет обязательных колонок");
  }
  const out: OnetSoftwareRow[] = [];
  for (const row of rows.slice(1)) {
    const workplaceExample = row[example]?.trim();
    if (!workplaceExample) continue;
    out.push({
      socCode: (row[soc] ?? "").trim(),
      occupationTitle: (row[title] ?? "").trim(),
      workplaceExample,
      hotTechnology: hot !== undefined && (row[hot] ?? "").trim().toUpperCase() === "Y",
      inDemand: demand !== undefined && (row[demand] ?? "").trim().toUpperCase() === "Y",
    });
  }
  return out;
}
