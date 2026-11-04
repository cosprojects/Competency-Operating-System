import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalUrl,
  dedupeResources,
  findDuplicate,
  findNodeDuplicates,
  normalizeTitle,
  resourceKey,
  titleSimilarity,
} from "../src/methodology/v1/dedupe/resources.ts";

describe("каноникализация ссылок", () => {
  it("убирает utm, www, хвостовой слэш и приводит схему", () => {
    assert.equal(
      canonicalUrl("http://www.Example.com:80/course/?utm_source=tg&utm_medium=post#top"),
      "https://example.com/course",
    );
  });

  it("разные ссылки на один ресурс дают один ключ", () => {
    const a = resourceKey({ url: "https://habr.com/ru/articles/1/", title: "Статья" });
    const b = resourceKey({ url: "http://habr.com/ru/articles/1?utm_campaign=x", title: "Другое название" });
    assert.equal(a, b);
  });

  it("невалидный url не ломает ключ", () => {
    assert.equal(canonicalUrl("не ссылка"), undefined);
    assert.ok(resourceKey({ title: "Курс", provider: "Skillbox" }).startsWith("title:"));
  });
});

describe("похожесть заголовков", () => {
  it("нормализует регистр и пунктуацию", () => {
    assert.equal(normalizeTitle("  Курс: «Дизайн-мышление»! "), "курс дизайн мышление");
  });

  it("одинаковые по смыслу заголовки близки", () => {
    const score = titleSimilarity(
      "Курс по дизайн-мышлению для продуктовых команд",
      "Курс по дизайн мышлению для продуктовых команд",
    );
    assert.ok(score > 0.9);
  });
});

describe("поиск дублей ресурсов", () => {
  const existing: Array<{ url?: string; title: string; provider?: string }> = [
    { url: "https://habr.com/ru/articles/1/", title: "Анализ требований", provider: "Хабр" },
  ];

  it("точный дубль по канонической ссылке", () => {
    const match = findDuplicate(
      { url: "http://habr.com/ru/articles/1?utm_source=x", title: "Совсем другое название" },
      existing,
    );
    assert.equal(match?.kind, "exact_url");
  });

  it("тот же ресурс на том же домене под другим адресом", () => {
    const match = findDuplicate(
      { url: "https://habr.com/ru/articles/1/comments", title: "Анализ требований", provider: "Хабр" },
      existing,
    );
    assert.ok(match?.kind === "same_title_domain" || match?.kind === "exact_url");
  });

  it("похожий заголовок у другого провайдера — не дубль", () => {
    const match = findDuplicate(
      { url: "https://skillbox.ru/course", title: "Анализ требований", provider: "Skillbox" },
      existing,
    );
    assert.equal(match, undefined);
  });
});

describe("дедупликация потока", () => {
  it("внутри пачки дубли тоже схлопываются", () => {
    const { unique, duplicates } = dedupeResources([
      { url: "https://habr.com/a", title: "Анализ требований", provider: "Хабр" },
      { url: "https://habr.com/a?utm_source=x", title: "Анализ требований", provider: "Хабр" },
      { url: "https://skillbox.ru/b", title: "SQL для аналитиков", provider: "Skillbox" },
    ]);
    assert.equal(unique.length, 2);
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0]?.kind, "exact_url");
  });

  it("существующие материалы учитываются", () => {
    const { unique, duplicates } = dedupeResources(
      [{ url: "https://habr.com/a", title: "Анализ требований" }],
      [{ url: "https://habr.com/a/", title: "Анализ требований" }],
    );
    assert.equal(unique.length, 0);
    assert.equal(duplicates.length, 1);
  });
});

describe("дубли узлов онтологии", () => {
  it("ловит одинаковые названия внутри типа", () => {
    const duplicates = findNodeDuplicates([
      { id: "ux-a", type: "competency", title: "Дизайн-мышление" },
      { id: "ux-b", type: "competency", title: "Дизайн мышление" },
      { id: "ux-c", type: "knowledge", title: "Дизайн-мышление" },
    ]);
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0]?.kind, "same_title");
    assert.equal(duplicates[0]?.strength, "weak");
  });

  it("различает сильные и слабые дубли по определению", () => {
    const duplicates = findNodeDuplicates([
      { id: "a", type: "knowledge", title: "Git", definition: "Понимание: Git." },
      { id: "b", type: "knowledge", title: "Git", definition: "Понимание: Git." },
      {
        id: "c",
        type: "knowledge",
        title: "Git",
        definition: "Ветвление, слияние, разрешение конфликтов и стратегии работы с историей.",
      },
    ]);
    assert.equal(duplicates.filter((duplicate) => duplicate.strength === "strong").length, 1);
    assert.equal(duplicates.filter((duplicate) => duplicate.strength === "weak").length, 2);
  });

  it("ловит пересечение алиасов", () => {
    const duplicates = findNodeDuplicates([
      { id: "a", type: "competency", title: "Колористика", aliases: ["Теория цвета"] },
      { id: "b", type: "competency", title: "Цветовая гармония", aliases: ["теория цвета"] },
    ]);
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0]?.kind, "alias_overlap");
  });
});
