/**
 * COS-ARCH-172 — единый ключ ресурса и защита от дублей.
 *
 * Дубль — это не только «тот же URL». Один и тот же курс встречается под разными
 * адресами (с utm-метками, www, другой схемой) и под разными заголовками.
 * Поэтому ключей три уровня:
 *   1) canonical URL          — точный дубль;
 *   2) домен + похожий заголовок — тот же ресурс по другому адресу;
 *   3) (тип, нормализованный заголовок / пересечение алиасов) — дубль узла онтологии.
 */

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "source",
  "fbclid",
  "gclid",
  "yclid",
];

export function canonicalUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.protocol = "https:";
    for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return undefined;
  }
}

export function domainOfUrl(raw: string | undefined): string | undefined {
  const canonical = canonicalUrl(raw);
  if (!canonical) return undefined;
  try {
    return new URL(canonical).hostname;
  } catch {
    return undefined;
  }
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(" ").filter((token) => token.length > 2));
}

/** Доля общих значимых слов (Жаккар). 1 — заголовки совпадают по смыслу. */
export function titleSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export type ResourceLike = {
  url?: string;
  title: string;
  provider?: string;
  domain?: string;
};

export function resourceKey(resource: ResourceLike): string {
  const canonical = canonicalUrl(resource.url);
  if (canonical) return `url:${canonical}`;
  return `title:${normalizeTitle(resource.title)}|${(resource.provider ?? "").toLowerCase()}`;
}

export type DuplicateKind = "exact_url" | "same_title_domain" | "same_provider_title";

export type DuplicateMatch<T, E = T> = {
  candidate: T;
  match: E;
  kind: DuplicateKind;
  score: number;
};

export type DedupeOptions = {
  /** Порог похожести заголовков для одного домена. */
  titleThreshold?: number;
  /** Порог похожести для одного провайдера на разных доменах. */
  providerTitleThreshold?: number;
};

const DEFAULTS: Required<DedupeOptions> = {
  titleThreshold: 0.85,
  providerTitleThreshold: 0.92,
};

/** Ищет существующий ресурс, совпадающий с кандидатом. */
export function findDuplicate<T extends ResourceLike, E extends ResourceLike = T>(
  candidate: T,
  existing: E[],
  options: DedupeOptions = {},
): DuplicateMatch<T, E> | undefined {
  const config = { ...DEFAULTS, ...options };
  const candidateUrl = canonicalUrl(candidate.url);
  const candidateDomain = candidate.domain ?? domainOfUrl(candidate.url);

  for (const item of existing) {
    const itemUrl = canonicalUrl(item.url);
    if (candidateUrl && itemUrl && candidateUrl === itemUrl) {
      return { candidate, match: item, kind: "exact_url", score: 1 };
    }
    const itemDomain = item.domain ?? domainOfUrl(item.url);
    const similarity = titleSimilarity(candidate.title, item.title);
    if (candidateDomain && itemDomain && candidateDomain === itemDomain && similarity >= config.titleThreshold) {
      return { candidate, match: item, kind: "same_title_domain", score: similarity };
    }
    const sameProvider =
      candidate.provider &&
      item.provider &&
      candidate.provider.toLowerCase() === item.provider.toLowerCase();
    if (sameProvider && similarity >= config.providerTitleThreshold) {
      return { candidate, match: item, kind: "same_provider_title", score: similarity };
    }
  }
  return undefined;
}

export type DedupeResult<T, E = T> = {
  unique: T[];
  duplicates: Array<DuplicateMatch<T, E>>;
};

/**
 * Дедупликация потока: сравниваем и с уже существующими, и внутри пачки.
 * Возвращает только то, что действительно новое.
 */
export function dedupeResources<T extends ResourceLike, E extends ResourceLike = T>(
  candidates: T[],
  existing: E[] = [],
  options: DedupeOptions = {},
): DedupeResult<T, E> {
  const unique: T[] = [];
  const duplicates: Array<DuplicateMatch<T, E>> = [];
  // Новые кандидаты сравниваются и между собой: приводим их к типу пула.
  const pool: Array<E | T> = [...existing];

  for (const candidate of candidates) {
    const match = findDuplicate(candidate, pool as E[], options);
    if (match) {
      duplicates.push(match as DuplicateMatch<T, E>);
      continue;
    }
    unique.push(candidate);
    pool.push(candidate);
  }
  return { unique, duplicates };
}

export type NodeLike = {
  id: string;
  type: string;
  title: string;
  aliases?: string[];
  definition?: string;
};

export type NodeDuplicate = {
  a: string;
  b: string;
  kind: "same_title" | "alias_overlap" | "title_alias";
  /**
   * strong — названия и определения совпадают: это дубль, узлы нужно слить.
   * weak — название совпадает, определения разные: вероятно, разные понятия.
   */
  strength: "strong" | "weak";
  score: number;
};

/**
 * Дубли узлов онтологии: одинаковые названия и алиасы внутри одного типа.
 * Id разные — значит, это два узла про одно и то же.
 */
export function findNodeDuplicates(nodes: NodeLike[]): NodeDuplicate[] {
  const result: NodeDuplicate[] = [];
  const byType = new Map<string, NodeLike[]>();
  for (const node of nodes) {
    const bucket = byType.get(node.type) ?? [];
    bucket.push(node);
    byType.set(node.type, bucket);
  }

  for (const bucket of byType.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const left = bucket[i];
        const right = bucket[j];
        if (!left || !right) continue;
        const leftTitle = normalizeTitle(left.title);
        const rightTitle = normalizeTitle(right.title);
        const leftDefinition = normalizeTitle(left.definition ?? "");
        const rightDefinition = normalizeTitle(right.definition ?? "");
        const strength: NodeDuplicate["strength"] =
          leftDefinition.length > 0 &&
          rightDefinition.length > 0 &&
          (leftDefinition === rightDefinition ||
            titleSimilarity(leftDefinition, rightDefinition) >= 0.9)
            ? "strong"
            : "weak";
        if (leftTitle === rightTitle) {
          result.push({ a: left.id, b: right.id, kind: "same_title", strength, score: 1 });
          continue;
        }
        const leftAliases = new Set((left.aliases ?? []).map(normalizeTitle));
        const rightAliases = new Set((right.aliases ?? []).map(normalizeTitle));
        for (const alias of leftAliases) {
          if (rightAliases.has(alias)) {
            result.push({ a: left.id, b: right.id, kind: "alias_overlap", strength, score: 1 });
            break;
          }
          if (rightTitle === alias || leftTitle === rightAliases.values().next().value) {
            result.push({ a: left.id, b: right.id, kind: "title_alias", strength, score: 0.9 });
            break;
          }
        }
      }
    }
  }
  return result;
}
