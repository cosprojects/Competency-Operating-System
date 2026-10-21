import { createHash } from "node:crypto";
import type { PageExcerpt, SourceType } from "./types.ts";

const RULES: Array<{ type: Exclude<SourceType, "unknown">; pattern: RegExp }> = [
  { type: "vacancy", pattern: /ваканс|vacancy|\bjobs?\b|hh\.ru|linkedin\.com\/jobs|требуется/i },
  { type: "program", pattern: /учебн|курс|syllabus|curriculum|образовательн|программа обучения/i },
  { type: "directory", pattern: /esco|onet|справочник|occupational outlook/i },
  { type: "industry", pattern: /ассоциац|отраслев|industry report/i },
];

/** Один ясный тип принимает страницу. Несколько типов или ни одного оставляют её кандидатом. */
export function classifySource(input: { url: string; title: string; text: string }): SourceType {
  const haystack = `${input.url}\n${input.title}\n${input.text.slice(0, 500)}`;
  const found = new Set(RULES.filter((rule) => rule.pattern.test(haystack)).map((rule) => rule.type));
  if (found.size !== 1) return "unknown";
  return [...found][0] ?? "unknown";
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n"),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const REQUIREMENT_PLACE =
  /навык|обязанност|требован|должен (?:знать и )?уметь|компетенц|essential skill|required skill|skills and competencies/i;

function isRequirementPlace(place: string): boolean {
  return REQUIREMENT_PLACE.test(place);
}

/** Из JSON берёт текстовые значения вместе с путём и записью. Адреса и типы содержимого не берёт. */
export function jsonExcerpts(raw: string, pageUrl: string): PageExcerpt[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const rootUri = readUri(parsed) ?? pageUrl;
  const excerpts: PageExcerpt[] = [];
  const visit = (value: unknown, path: string, recordId: string): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, recordId));
      return;
    }
    const node = value as Record<string, unknown>;
    const nodeUri = typeof node.uri === "string" ? node.uri : recordId;
    for (const [key, child] of Object.entries(node)) {
      if (key === "mimetype" || key === "uri" || key === "href") continue;
      const childPath = path ? `${path}.${key}` : key;
      if (typeof child === "string") {
        const fragment = decodeEntities(child).replace(/\s+/g, " ").trim();
        if (!fragment || /^https?:\/\//i.test(fragment) || /mimetype|plain\/text/i.test(fragment)) continue;
        if (fragment.length < 3 || fragment.length > 500) continue;
        excerpts.push({
          fragment,
          place: childPath,
          recordId: nodeUri,
          basis: basisForJson(pageUrl, childPath, nodeUri),
        });
        continue;
      }
      visit(child, childPath, nodeUri);
    }
  };
  visit(parsed, "", rootUri);
  return excerpts;
}

function readUri(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const uri = (value as Record<string, unknown>).uri;
  return typeof uri === "string" ? uri : undefined;
}

function basisForJson(pageUrl: string, place: string, recordId: string): string | null {
  const skill = pageUrl.includes("/skill") || recordId.includes("/skill/");
  if (/^description\.[^.]+\.literal$/.test(place) && skill) return "описание навыка ESCO";
  if (/\.hasEssentialSkill(?:\[\d+\])?\.title$/.test(place)) return "название обязательного навыка ESCO";
  if (/\.hasOptionalSkill(?:\[\d+\])?\.title$/.test(place)) return "название необязательного навыка ESCO";
  return null;
}

/** Фрагменты HTML с заголовком раздела. Требование — только раздел о навыках, обязанностях или компетенциях. */
export function htmlExcerpts(html: string, pageUrl: string): PageExcerpt[] {
  const parts = html.split(/(<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>)/gi);
  let place = "body";
  let level = 0;
  const excerpts: PageExcerpt[] = [];
  for (const part of parts) {
    const heading = part.match(/^<h([1-3])[^>]*>([\s\S]*?)<\/h\1>$/i);
    if (heading) {
      place = htmlToText(heading[2] ?? "") || "body";
      level = Number(heading[1]);
      continue;
    }
    const basis = level >= 2 && isRequirementPlace(place) ? place : null;
    for (const fragment of extractFragments(htmlToText(part))) {
      excerpts.push({
        fragment,
        place,
        recordId: pageUrl,
        basis,
      });
    }
  }
  return excerpts;
}

export function pageTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

/** Дословная копия: тот же текст после регистра и пробелов. Перефраз сюда не попадает. */
export function copyKey(fragment: string): string {
  return fragment.trim().toLowerCase().replace(/\s+/g, " ");
}

export function statementId(professionId: string, fragment: string): string {
  return createHash("sha256").update(`${professionId}\n${copyKey(fragment)}`).digest("hex").slice(0, 16);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

/** Выписывает фрагменты как сказаны. Область и компетенцию не назначает. */
export function extractFragments(text: string): string[] {
  const seen = new Set<string>();
  const fragments: string[] = [];
  for (const line of text.split(/\n+/)) {
    const cleaned = line.replace(/^[\s•*\-\d.)]+/, "").replace(/^:\s*/, "").trim();
    const parts = cleaned.split(/(?<=[.!?])\s+/);
    for (const part of parts) {
      const fragment = part.trim();
      if (fragment.length < 40 || fragment.length > 500) continue;
      if (/[{}]|mimetype|_links|skillType/.test(fragment)) continue;
      const key = copyKey(fragment);
      if (seen.has(key)) continue;
      seen.add(key);
      fragments.push(fragment);
      if (fragments.length >= 30) return fragments;
    }
  }
  return fragments;
}
