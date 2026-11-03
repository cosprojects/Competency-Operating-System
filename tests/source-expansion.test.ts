import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LearningSourceRegistry } from "../src/methodology/v1/learning-sources/types.ts";
import type { CompetencyContext } from "../src/methodology/v1/learning-sources/discovery/types.ts";
import type { RawProviderHit } from "../src/methodology/v1/learning-sources/discovery/wikipedia.ts";
import {
  buildCandidates,
  canonicalizeSourceUrl,
  classifyKind,
  domainOf,
  isBannedDomain,
  scoreCandidate,
} from "../src/methodology/v1/learning-sources/discovery/candidates.ts";

const context: CompetencyContext = {
  competencyId: "motion-animation-principles",
  professionId: "it.motion",
  title: "Принципы анимации",
  titleEn: "Animation principles",
  definition: "Двенадцать принципов анимации: тайминг, спайсинг, вес и выразительность движения.",
  components: ["Тайминг", "Спайсинг"],
  tier: "foundation",
};

const registry: LearningSourceRegistry = {
  registryVersion: "1.0.0",
  updatedAt: "2026-10-28",
  sources: [
    {
      id: "figma-design-basics",
      title: "Figma Learn",
      url: "https://help.figma.com/hc/en-us",
      kind: "reference",
      professionIds: ["it.uxui"],
      languages: ["en"],
      access: "free",
      authority: "primary",
      status: "active",
      topics: ["figma"],
      discoveredBy: "user",
      lastChecked: "2026-10-28",
    },
  ],
};

function hit(overrides: Partial<RawProviderHit> = {}): RawProviderHit {
  return {
    url: "https://www.alanbecker.net/12principles/",
    title: "12 принципов анимации",
    snippet: "Разбор принципов анимации: тайминг, спайсинг, вес.",
    provider: "wikipedia-extlinks",
    competencyId: "motion-animation-principles",
    competencyTitle: "Принципы анимации",
    query: "Принципы анимации",
    language: "ru",
    ...overrides,
  };
}

describe("нормализация кандидатов", () => {
  it("приводит URL к https, убирает query/hash и завершающий слэш", () => {
    assert.equal(canonicalizeSourceUrl("http://www.Example.com/a/?utm=1#test"), "https://example.com/a");
    assert.equal(canonicalizeSourceUrl("https://example.com/"), "https://example.com/");
    assert.equal(canonicalizeSourceUrl("ftp://example.com/file"), undefined);
  });

  it("определяет домен и банит энциклопедии/соцсети/магазины", () => {
    assert.equal(domainOf("https://www.schoolofmotion.com/courses/"), "schoolofmotion.com");
    assert.equal(isBannedDomain("ru.wikipedia.org"), true);
    assert.equal(isBannedDomain("amazon.com"), true);
    assert.equal(isBannedDomain("schoolofmotion.com"), false);
  });

  it("классифицирует вид источника по домену и пути", () => {
    assert.equal(classifyKind("coursera.org", "/learn/design", "Design"), "course-platform");
    assert.equal(classifyKind("youtube.com", "/playlist/list=1", "Playlist"), "video-playlist");
    assert.equal(classifyKind("vimeo.com", "/channel", "Channel"), "video-channel");
    assert.equal(classifyKind("behance.net", "/gallery/1", "Case"), "portfolio-case");
    assert.equal(classifyKind("nngroup.com", "/articles/1", "Article"), "blog");
    assert.equal(classifyKind("schoolofmotion.com", "/courses", "Courses"), "school");
    assert.equal(classifyKind("example.edu", "/", "University"), "school");
  });
});

describe("скоринг релевантности", () => {
  it("тематический материал получает больший скор, чем шум", () => {
    const relevant = scoreCandidate({
      title: "12 принципов анимации: тайминг и спайсинг",
      snippet: "Разбор принципов анимации с примерами движения.",
      domain: "alanbecker.net",
      path: "/12principles",
      context,
      kind: "course-platform",
    });
    const noise = scoreCandidate({
      title: "Купить хостинг со скидкой",
      snippet: "Тарифы и промокоды.",
      domain: "hosting.example",
      path: "/sale",
      context,
      kind: "blog",
    });
    assert.ok(relevant > noise);
    assert.ok(relevant >= 0.35);
  });
});

describe("сборка кандидатов", () => {
  const options = { minScore: 0.2, limitPerCompetency: 3 };

  it("отбрасывает запрещённые домены и дубли, связывает существующие", () => {
    const hits: RawProviderHit[] = [
      hit({ url: "https://ru.wikipedia.org/wiki/Анимация" }),
      hit({ url: "https://help.figma.com/hc/en-us/articles/1" }),
      hit({ url: "https://www.alanbecker.net/12principles/" }),
      hit({ url: "https://www.alanbecker.net/12principles/?ref=1" }),
      hit({ url: "https://www.alanbecker.net/other-page/" }),
    ];
    const candidates = buildCandidates(
      hits,
      new Map([[context.competencyId, context]]),
      registry,
      options,
    );
    assert.ok(!candidates.some((candidate) => candidate.domain === "wikipedia.org"));
    const existing = candidates.find((candidate) => candidate.domain === "help.figma.com");
    assert.equal(existing?.existingSourceId, "figma-design-basics");
    const alan = candidates.filter((candidate) => candidate.domain === "alanbecker.net");
    assert.equal(alan.length, 1);
  });

  it("ограничивает число кандидатов на компетенцию", () => {
    const hits = [
      hit({ url: "https://site-a.example/learn/1", title: "Принципы анимации" }),
      hit({ url: "https://site-b.example/learn/2", title: "Принципы анимации" }),
      hit({ url: "https://site-c.example/learn/3", title: "Принципы анимации" }),
      hit({ url: "https://site-d.example/learn/4", title: "Принципы анимации" }),
    ];
    const candidates = buildCandidates(
      hits,
      new Map([[context.competencyId, context]]),
      registry,
      { minScore: 0.2, limitPerCompetency: 2 },
    );
    assert.equal(candidates.length, 2);
  });
});

describe("Brave Search провайдер", () => {
  it("преобразует веб-результаты в кандидатов и передаёт ключ", async () => {
    const { discoverWithBrave } = await import(
      "../src/methodology/v1/learning-sources/discovery/brave.ts"
    );
    const calls: string[] = [];
    const fakeFetch = async (url: string, init?: { headers?: Record<string, string> }) => {
      calls.push(url);
      if (init?.headers?.["x-subscription-token"] !== "test-key") {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          web: {
            results: [
              {
                url: "https://school.example/learn/animation",
                title: "Animation principles course",
                description: "Тайминг и спайсинг с примерами.",
              },
            ],
          },
        }),
      };
    };
    const hits = await discoverWithBrave(fakeFetch, [context], {
      apiKey: "test-key",
      perContext: 1,
      queriesPerContext: 1,
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]!.provider, "brave-search");
    assert.equal(hits[0]!.url, "https://school.example/learn/animation");
    assert.ok(calls[0]!.startsWith("https://api.search.brave.com/res/v1/web/search"));
  });
});
