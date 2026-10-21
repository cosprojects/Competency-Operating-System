import type { FetchLike } from "../../candidate-parser/types.ts";
import { cachedText, fetchText, type CacheOptions } from "../../profile/cache.ts";
import { parseCsv } from "../../profile/onet.ts";
import type { SourceRef, TagKind } from "../types.ts";
import { cleanText, normalizeTitle } from "./common.ts";

const ONET_BASE = "https://www.onetcenter.org/dl_files/database/db_31_0_csv/";
const ONET_LICENSE = "CC BY 4.0";

export interface OnetProfessionHit {
  socCode: string;
  title: string;
  url: string;
}

export interface OnetTagHit {
  sourceRef: SourceRef;
  title: string;
  definition: string;
  kind: TagKind;
  table: "software_skills" | "essential_skills" | "knowledge";
}

type Table = Record<string, string>[];

const tableCache = new Map<string, Promise<Table>>();

async function readTable(
  fetchImpl: FetchLike,
  cache: CacheOptions | undefined,
  file: string,
): Promise<Table> {
  const key = `${file}@${ONET_BASE}`;
  const existing = tableCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const csv = await cachedText(cache, `onet-31-${file}`, "csv", () =>
      fetchText(fetchImpl, `${ONET_BASE}${file}.csv`, "text/csv", 180_000),
    );
    const rows = parseCsv(csv);
    const header = rows[0] ?? [];
    const columns = new Map(header.map((name, index) => [name.trim(), index]));
    return rows.slice(1).map((row) => {
      const record: Record<string, string> = {};
      for (const [name, index] of columns) record[name] = row[index] ?? "";
      return record;
    });
  })();
  tableCache.set(key, promise);
  return promise;
}

function matchesTitle(title: string, includes: string[] | undefined): boolean {
  if (!includes || includes.length === 0) return true;
  const normalized = normalizeTitle(title);
  return includes.some((part) => normalized.includes(normalizeTitle(part)));
}

export async function searchOnetOccupations(
  fetchImpl: FetchLike,
  cache: CacheOptions | undefined,
  query: { socCodes?: string[]; titleIncludes?: string[] },
): Promise<OnetProfessionHit[]> {
  const rows = await readTable(fetchImpl, cache, "occupation_data");
  const socSet = new Set(query.socCodes ?? []);
  const hits = rows.filter((row) => {
    const code = (row["O*NET-SOC Code"] ?? "").trim();
    const title = (row["Title"] ?? "").trim();
    if (!code || !title) return false;
    return socSet.has(code) || matchesTitle(title, query.titleIncludes);
  });
  const seen = new Set<string>();
  return hits
    .filter((row) => {
      const code = (row["O*NET-SOC Code"] ?? "").trim();
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    })
    .map((row) => {
      const socCode = (row["O*NET-SOC Code"] ?? "").trim();
      return {
        socCode,
        title: (row["Title"] ?? "").trim(),
        url: `https://www.onetonline.org/link/summary/${socCode}`,
      };
    });
}

function onetSourceRef(socCode: string, externalId: string, retrievedOn: string): SourceRef {
  return {
    sourceId: "onet",
    externalId: `${socCode}:${externalId}`,
    url: `https://www.onetonline.org/link/summary/${socCode}`,
    retrievedAt: retrievedOn,
    license: ONET_LICENSE,
  };
}

export async function collectOnetTags(
  fetchImpl: FetchLike,
  cache: CacheOptions | undefined,
  socCode: string,
  retrievedOn: string,
): Promise<OnetTagHit[]> {
  const [software, essential, knowledge] = await Promise.all([
    readTable(fetchImpl, cache, "software_skills"),
    readTable(fetchImpl, cache, "essential_skills"),
    readTable(fetchImpl, cache, "knowledge"),
  ]);

  const hits: OnetTagHit[] = [];
  const seen = new Set<string>();

  for (const row of software) {
    if ((row["O*NET-SOC Code"] ?? "").trim() !== socCode) continue;
    const title = cleanText(row["Workplace Example"]);
    if (!title) continue;
    const key = `${normalizeTitle(title)}|tool`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hot = (row["Hot Technology"] ?? "").toUpperCase() === "Y" ? "Hot Technology" : "";
    const demand = (row["In Demand"] ?? "").toUpperCase() === "Y" ? "In Demand" : "";
    const flags = [hot, demand].filter(Boolean).join(", ");
    hits.push({
      sourceRef: onetSourceRef(socCode, `software:${title}`, retrievedOn),
      title,
      definition: `O*NET Software Skills: ${title}${flags ? ` (${flags})` : ""}`,
      kind: "tool",
      table: "software_skills",
    });
  }

  const addElements = (rows: Table, table: "essential_skills" | "knowledge", kind: TagKind): void => {
    const selected = new Map<string, Record<string, string>>();
    for (const row of rows) {
      if ((row["O*NET-SOC Code"] ?? "").trim() !== socCode) continue;
      const name = cleanText(row["Element Name"]);
      if (!name) continue;
      const scale = (row["Scale ID"] ?? "").trim();
      if (scale === "LV") continue;
      if (!selected.has(name) || scale === "IM") selected.set(name, row);
    }
    for (const [name, row] of selected) {
      const key = `${normalizeTitle(name)}|${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const importance = cleanText(row["Data Value"]);
      hits.push({
        sourceRef: onetSourceRef(socCode, `${table}:${name}`, retrievedOn),
        title: name,
        definition: `O*NET ${table === "knowledge" ? "Knowledge" : "Skills"}: ${name}${importance ? ` (importance ${importance})` : ""}`,
        kind,
        table,
      });
    }
  };

  addElements(essential, "essential_skills", "skill");
  addElements(knowledge, "knowledge", "knowledge");
  return hits;
}
