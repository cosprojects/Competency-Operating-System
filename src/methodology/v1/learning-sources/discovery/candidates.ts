import type { LearningSourceKind, LearningSourceRegistry } from "../types.ts";
import type { RawProviderHit } from "./wikipedia.ts";
import type { CompetencyContext, SourceCandidate } from "./types.ts";

/** Нормализация, скоринг и фильтрация кандидатов в реестр источников. */

const BANNED_DOMAINS = [
  "wikipedia.org",
  "wikimedia.org",
  "wikidata.org",
  "amazon.",
  "google.",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "pinterest.",
  "reddit.com",
  "quora.com",
  "t.me",
  "telegram.me",
  "vk.com",
  "ok.ru",
  "doi.org",
  "jstor.org",
  "sciencedirect.com",
  "springer.com",
  "books.google.",
  "web.archive.org",
  "archive.org",
];

const TRUSTED_DOMAINS = [
  "figma.com",
  "nngroup.com",
  "smashingmagazine.com",
  "alistapart.com",
  "interaction-design.org",
  "uxdesigninstitute.com",
  "coursera.org",
  "edx.org",
  "stepik.org",
  "udemy.com",
  "skillshare.com",
  "pluralsight.com",
  "udacity.com",
  "alison.com",
  "futurelearn.com",
  "schoolofmotion.com",
  "motiondesign.school",
  "blender.org",
  "developer.mozilla.org",
  "learn.microsoft.com",
];

const SCHOOL_DOMAIN_HINTS = ["school", "academy", "institute", "university", "college", "школ", "академ", "институт"];
const VIDEO_DOMAINS = ["youtube.com", "youtu.be", "vimeo.com", "rutube.ru"];
const COURSE_DOMAINS = [
  "coursera.org",
  "edx.org",
  "stepik.org",
  "udemy.com",
  "skillshare.com",
  "pluralsight.com",
  "udacity.com",
  "alison.com",
  "futurelearn.com",
  "open.edu",
  "openculture.com",
  "khanacademy.org",
  "freecodecamp.org",
];
const BLOG_DOMAINS = ["medium.com", "dev.to", "habr.com", "smashingmagazine.com", "alistapart.com", "nngroup.com"];
const PORTFOLIO_DOMAINS = ["behance.net", "dribbble.com", "artstation.com"];

export function isBannedCandidateTitle(title: string): boolean {
  return BANNED_TITLE.test(title);
}

const BANNED_TITLE =
  /(курсов(ая|ой|ую|ые|ых)|диплом|реферат|essay|dissertation|шпаргал|заказать|ваканс|резюме|зарплат|новост|пресс-релиз)/i;

const FILE_EXTENSIONS = /\.(pdf|jpe?g|png|gif|svg|zip|rar|docx?|pptx?|xlsx?|mp4|mov|avi|webm)$/i;

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function canonicalizeSourceUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.protocol = "https:";
    url.hash = "";
    url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${path}`;
  } catch {
    return undefined;
  }
}

export function isBannedDomain(domain: string): boolean {
  return BANNED_DOMAINS.some((banned) => domain === banned || domain.endsWith(`.${banned}`) || domain.includes(banned));
}

export function classifyKind(domain: string, path: string, title: string): LearningSourceKind {
  const haystack = `${domain} ${path} ${title}`.toLowerCase();
  if (PORTFOLIO_DOMAINS.some((item) => domain.endsWith(item))) return "portfolio-case";
  if (VIDEO_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`))) {
    return path.includes("playlist") ? "video-playlist" : "video-channel";
  }
  if (domain.includes("classcentral") || domain.includes("coursetrain") || domain.includes("coursehunter")) {
    return "aggregator";
  }
  if (COURSE_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`))) return "course-platform";
  if (SCHOOL_DOMAIN_HINTS.some((hint) => domain.includes(hint))) return "school";
  if (BLOG_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`))) return "blog";
  if (/\/(courses?|tutorials?|learn|academy|training)\b/.test(path)) return "course-platform";
  if (/\/(docs?|documentation|reference|manual|wiki)\b/.test(path)) return "reference";
  if (/\/(blog|articles?|posts?|guides?)\b/.test(path)) return "blog";
  if (domain.endsWith(".edu") || domain.includes(".edu.")) return "school";
  if (haystack.includes("course") || haystack.includes("курс")) return "course-platform";
  if (haystack.includes("guide") || haystack.includes("гайд") || haystack.includes("documentation")) return "reference";
  return "blog";
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
}

/** Насколько кандидат совпадает с контекстом компетенции (0..1). */
export function scoreCandidate(input: {
  title: string;
  snippet?: string;
  domain: string;
  path: string;
  context: CompetencyContext;
  kind: LearningSourceKind;
  stars?: number;
}): number {
  const contextWords = new Set(
    words(
      [input.context.title, input.context.titleEn ?? "", input.context.definition, ...input.context.components].join(" "),
    ),
  );
  const targetWords = new Set(words(`${input.title} ${input.snippet ?? ""} ${input.domain} ${input.path}`));
  const titleWords = new Set(words(input.title));
  let matched = 0;
  let titleMatched = 0;
  for (const word of contextWords) {
    if (targetWords.has(word)) matched += 1;
    if (titleWords.has(word)) titleMatched += 1;
  }
  const overlap = contextWords.size > 0 ? matched / Math.min(contextWords.size, 12) : 0;
  const titleOverlap = contextWords.size > 0 ? titleMatched / Math.min(contextWords.size, 8) : 0;
  const pathSignal = /\/(learn|course|courses|tutorial|tutorials|guides?|docs?|documentation|blog|articles?)\b/.test(
    input.path,
  )
    ? 0.15
    : 0;
  const trusted = TRUSTED_DOMAINS.some((item) => input.domain === item || input.domain.endsWith(`.${item}`)) ? 0.2 : 0;
  const formatBonus = input.kind === "course-platform" || input.kind === "video-channel" ? 0.05 : 0;
  const starsBonus = input.stars ? Math.min(0.15, Math.log10(input.stars + 1) / 20) : 0;
  return Math.min(
    1,
    Math.max(0, titleOverlap * 0.5 + overlap * 0.3 + pathSignal + trusted + formatBonus + starsBonus),
  );
}

export interface BuildCandidatesOptions {
  minScore?: number;
  limitPerCompetency?: number;
  includeExistingDomains?: boolean;
}

export function buildCandidates(
  hits: RawProviderHit[],
  contexts: Map<string, CompetencyContext>,
  registry: LearningSourceRegistry,
  options: BuildCandidatesOptions = {},
): SourceCandidate[] {
  const minScore = options.minScore ?? 0.35;
  const limit = options.limitPerCompetency ?? 3;
  const includeExisting = options.includeExistingDomains ?? true;
  const existingByCanonical = new Map<string, string>();
  const existingByDomain = new Map<string, string>();
  for (const source of registry.sources) {
    const canonical = canonicalizeSourceUrl(source.url);
    if (canonical) existingByCanonical.set(canonical, source.id);
    existingByDomain.set(domainOf(source.url), source.id);
  }

  const byCompetency = new Map<string, SourceCandidate[]>();
  for (const hit of hits) {
    const context = contexts.get(hit.competencyId);
    if (!context) continue;
    const canonicalUrl = canonicalizeSourceUrl(hit.url);
    if (!canonicalUrl) continue;
    const domain = domainOf(canonicalUrl);
    if (!domain || isBannedDomain(domain)) continue;
    if (isBannedCandidateTitle(hit.title)) continue;
    const { pathname } = new URL(canonicalUrl);
    if (FILE_EXTENSIONS.test(pathname)) continue;
    const kind = classifyKind(domain, pathname, hit.title);
    const score = scoreCandidate({
      title: hit.title,
      ...(hit.snippet ? { snippet: hit.snippet } : {}),
      domain,
      path: pathname,
      context,
      kind,
      ...(hit.stars ? { stars: hit.stars } : {}),
    });
    if (score < minScore) continue;
    const existingSourceId = existingByCanonical.get(canonicalUrl) ?? existingByDomain.get(domain);
    if (existingSourceId && !includeExisting) continue;
    const reasonParts = [`совпадение с «${context.title}»`, `формат ${kind}`, `score ${score.toFixed(2)}`];
    if (existingSourceId) reasonParts.push(`домен уже в реестре: ${existingSourceId}`);
    const candidate: SourceCandidate = {
      url: hit.url,
      canonicalUrl,
      domain,
      title: hit.title,
      ...(hit.snippet ? { snippet: hit.snippet } : {}),
      provider: hit.provider,
      competencyId: hit.competencyId,
      competencyTitle: hit.competencyTitle,
      query: hit.query,
      kind,
      languages: [hit.language],
      score,
      reason: reasonParts.join(", "),
      ...(existingSourceId ? { existingSourceId } : {}),
    };
    const list = byCompetency.get(hit.competencyId) ?? [];
    if (list.some((item) => item.canonicalUrl === candidate.canonicalUrl || item.domain === candidate.domain)) {
      continue;
    }
    list.push(candidate);
    byCompetency.set(hit.competencyId, list);
  }

  const result: SourceCandidate[] = [];
  for (const list of byCompetency.values()) {
    result.push(...list.sort((a, b) => b.score - a.score).slice(0, limit));
  }
  return result.sort((a, b) => a.competencyId.localeCompare(b.competencyId) || b.score - a.score);
}

/** Кандидат, у которого домен уже есть в реестре: можно связать с компетенцией без новой записи. */
export function existingSourceIdFor(candidate: SourceCandidate, registry: LearningSourceRegistry): string | undefined {
  const canonical = canonicalizeSourceUrl(candidate.url);
  const domain = domainOf(candidate.url);
  for (const source of registry.sources) {
    if (canonical && canonicalizeSourceUrl(source.url) === canonical) return source.id;
    if (domain && domainOf(source.url) === domain) return source.id;
  }
  return undefined;
}
