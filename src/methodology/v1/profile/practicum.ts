import type { FetchLike } from "../candidate-parser/types.ts";
import { cachedText, fetchText, type CacheOptions } from "./cache.ts";

export const PRACTICUM_SOURCE_ID = "practicum-design";
export const PRACTICUM_CATALOG_URL = "https://practicum.yandex.ru/catalog/design/";
export const PRACTICUM_LICENSE =
  "© Яндекс Практикум. Извлекаются только названия навыков и короткие цитаты; полные тексты не копируются. robots.txt разрешает /catalog/design/ и страницы профессий без query-параметров.";

export interface PracticumProfession {
  slug: string;
  name: string;
  description: string;
  url: string;
  tags: string[];
}

export interface PracticumProfessionPage {
  slug: string;
  url: string;
  tools: string[];
  lessons: string[];
  skills: string[];
}

export interface PracticumDesignJournal {
  journalVersion: "1.0.0";
  writesToGraph: false;
  source: {
    id: string;
    url: string;
    license: string;
    robots: string;
    retrievedOn: string;
  };
  professions: Array<
    PracticumProfession & {
      tools: string[];
      lessons: string[];
      skills: string[];
    }
  >;
}

interface RawTag {
  name?: string;
  tag_type?: string;
  hidden?: boolean;
  slug?: string;
}

interface RawProfession {
  slug?: string;
  name?: string;
  description?: string;
  tags?: RawTag[];
}

/** Достаёт JS-объект из `window.__GLOBAL_STATE__ = {...};` со скобочным балансом. */
export function extractGlobalState(html: string): unknown | undefined {
  const marker = "window.__GLOBAL_STATE__";
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const start = html.indexOf("{", markerIndex);
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as unknown;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

/** Достаёт массив после `"key":` без разбора всего состояния: оно может содержать undefined. */
export function extractArrayAfterMarker(html: string, marker: string): unknown[] | undefined {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const start = html.indexOf("[", markerIndex);
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          const value = JSON.parse(html.slice(start, i + 1)) as unknown;
          return Array.isArray(value) ? value : undefined;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

/** Разворачивает \u003c/\u003e и \" в сериализованном HTML из состояния страницы. */
export function decodeSerializedHtml(raw: string): string {
  return raw
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u002f/gi, "/")
    .replace(/\\"/g, '"');
}

function findKey(value: unknown, key: string, depth = 0): unknown {
  if (depth > 12 || value === null || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findKey(item, key, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (key in record) return record[key];
  for (const item of Object.values(record)) {
    const found = findKey(item, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function collectHtmlStrings(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 14 || value === null) return out;
  if (typeof value === "string") {
    if (value.includes('class="tool-item"') || value.includes('class="lesson"')) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHtmlStrings(item, out, depth + 1);
    return out;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectHtmlStrings(item, out, depth + 1);
    }
  }
  return out;
}

export function stripTags(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
  return text.replace(/\s+/g, " ").trim();
}

function extractList(html: string, tagClass: string): string[] {
  const items: string[] = [];
  const pattern = new RegExp(`<[^>]*class="[^"]*${tagClass}[^"]*"[^>]*>(.*?)</[^>]+>`, "gs");
  for (const match of html.matchAll(pattern)) {
    const text = stripTags(match[1] ?? "");
    if (text && !items.includes(text)) items.push(text);
  }
  return items;
}

export function extractSkillsFromHtml(html: string): { tools: string[]; lessons: string[] } {
  return {
    tools: extractList(html, "tool-item"),
    lessons: extractList(html, "lesson"),
  };
}

export function parsePracticumCatalog(html: string): PracticumProfession[] {
  const state = extractGlobalState(html);
  const fromState = state ? findKey(state, "getV2CatalogProfessions") : undefined;
  const raw = Array.isArray(fromState)
    ? fromState
    : extractArrayAfterMarker(html, '"getV2CatalogProfessions":');
  if (!Array.isArray(raw)) return [];
  const professions: PracticumProfession[] = [];
  for (const item of raw as RawProfession[]) {
    const slug = item.slug?.trim();
    const name = item.name?.trim();
    if (!slug || !name) continue;
    const tags = item.tags ?? [];
    const isDesign = tags.some((tag) => tag.tag_type === "head" && tag.slug === "design");
    if (!isDesign) continue;
    professions.push({
      slug,
      name,
      description: item.description?.trim() ?? "",
      url: `https://practicum.yandex.ru/${slug}/`,
      tags: tags
        .filter((tag) => tag.tag_type === "skills" && !tag.hidden && tag.name)
        .map((tag) => tag.name as string),
    });
  }
  professions.sort((a, b) => a.name.localeCompare(b.name));
  return professions;
}

export function parsePracticumProfessionPage(html: string, slug: string): PracticumProfessionPage {
  const state = extractGlobalState(html);
  const strings = state ? collectHtmlStrings(state) : [];
  strings.push(decodeSerializedHtml(html));
  const tools: string[] = [];
  const lessons: string[] = [];
  for (const chunk of strings) {
    const parsed = extractSkillsFromHtml(chunk);
    for (const item of parsed.tools) if (!tools.includes(item)) tools.push(item);
    for (const item of parsed.lessons) if (!lessons.includes(item)) lessons.push(item);
  }
  const skills = [...tools, ...lessons.filter((item) => !tools.includes(item))];
  return {
    slug,
    url: `https://practicum.yandex.ru/${slug}/`,
    tools,
    lessons,
    skills,
  };
}

export async function readPracticumCatalog(
  fetchImpl: FetchLike,
  url = PRACTICUM_CATALOG_URL,
): Promise<PracticumProfession[]> {
  const html = await fetchText(fetchImpl, url, "text/html");
  return parsePracticumCatalog(html);
}

export async function readPracticumProfessionSkills(
  fetchImpl: FetchLike,
  slug: string,
): Promise<PracticumProfessionPage> {
  const html = await fetchText(fetchImpl, `https://practicum.yandex.ru/${slug}/`, "text/html");
  return parsePracticumProfessionPage(html, slug);
}

export async function collectPracticumDesign(input: {
  fetchImpl: FetchLike;
  retrievedOn: string;
  cache?: CacheOptions;
  catalogUrl?: string;
  professionSlugs?: string[];
}): Promise<PracticumDesignJournal> {
  const catalogUrl = input.catalogUrl ?? PRACTICUM_CATALOG_URL;
  const catalogHtml = await cachedText(input.cache, "practicum-catalog", "html", () =>
    fetchText(input.fetchImpl, catalogUrl, "text/html"),
  );
  const catalog = parsePracticumCatalog(catalogHtml);
  const selected = input.professionSlugs
    ? catalog.filter((item) => input.professionSlugs?.includes(item.slug))
    : catalog;

  const pages: Array<PracticumProfession & { tools: string[]; lessons: string[]; skills: string[] }> = [];
  for (const profession of selected) {
    try {
      const html = await cachedText(input.cache, `practicum-${profession.slug}`, "html", () =>
        fetchText(input.fetchImpl, profession.url, "text/html"),
      );
      const page = parsePracticumProfessionPage(html, profession.slug);
      pages.push({ ...profession, tools: page.tools, lessons: page.lessons, skills: page.skills });
    } catch (error) {
      const message = error instanceof Error ? error.message : "страница не получена";
      pages.push({ ...profession, tools: [], lessons: [`ошибка: ${message}`], skills: [] });
    }
  }

  return {
    journalVersion: "1.0.0",
    writesToGraph: false,
    source: {
      id: PRACTICUM_SOURCE_ID,
      url: catalogUrl,
      license: PRACTICUM_LICENSE,
      robots: "https://practicum.yandex.ru/robots.txt: /*?* запрещён, поэтому запросы без query; /catalog/design/ и страницы профессий разрешены.",
      retrievedOn: input.retrievedOn,
    },
    professions: pages,
  };
}

export function renderPracticumMarkdown(journal: PracticumDesignJournal): string {
  const lines: string[] = [];
  lines.push("# Яндекс Практикум — дизайнерские профессии и навыки");
  lines.push("");
  lines.push(`> ${journal.source.url} · ${journal.source.retrievedOn} · \`writesToGraph: false\``);
  lines.push(">");
  lines.push(`> ${journal.source.license}`);
  lines.push(">");
  lines.push(`> ${journal.source.robots}`);
  lines.push("");
  lines.push(`Профессий: ${journal.professions.length}. Навыки — теги каталога, инструменты и темы уроков со страницы профессии.`);
  lines.push("");
  for (const profession of journal.professions) {
    lines.push(`## ${profession.name} (/${profession.slug}/)`);
    lines.push("");
    if (profession.description) {
      lines.push(`_${profession.description}_`);
      lines.push("");
    }
    lines.push(`- Страница: ${profession.url}`);
    if (profession.tags.length > 0) {
      lines.push(`- Теги навыков: ${profession.tags.join("; ")}`);
    }
    lines.push("");
    if (profession.tools.length > 0) {
      lines.push("**Инструменты**");
      lines.push("");
      for (const tool of profession.tools) lines.push(`- ${tool}`);
      lines.push("");
    }
    if (profession.lessons.length > 0) {
      lines.push(`**Темы и навыки (${profession.lessons.length})**`);
      lines.push("");
      for (const lesson of profession.lessons) lines.push(`- ${lesson}`);
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}
