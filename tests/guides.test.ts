import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fallbackQueries,
  hostOf,
  isDeniedUrl,
  isTopicRelevant,
  isUsableSource,
  keywordRelevance,
  normalizeTitle,
  pickCandidates,
  scoreHit,
  searchPhrase,
  sourceLang,
} from "../src/methodology/v1/guides/plan.ts";
import { parseGuideContent, renderGuideText, validateGuideDoc } from "../src/methodology/v1/guides/validate.ts";
import type { GuideDoc, ItemInput, SearchHit } from "../src/methodology/v1/guides/types.ts";

const skill: ItemInput = {
  id: "tag_1",
  kind: "skill",
  title: "Сборка сайта в Tilda по макету из Figma",
  definition: "Переносить макет в рабочую сборку.",
  competencyTitle: "Figma: компоненты",
  sectionTitle: "Инструменты",
};

const hit = (overrides: Partial<SearchHit> & { url: string }): SearchHit => ({
  title: "Статья",
  description: "Подробное объяснение темы с примерами и шагами, достаточно длинное описание.",
  lang: "ru",
  score: 1,
  query: "запрос",
  queryLang: "ru",
  ...overrides,
});

const section = (heading: string, text: string) => ({ heading, text });

const goodDoc: GuideDoc = {
  status: "ok",
  sections: [
    section(
      "Что это",
      "Гипотеза — проверяемое предположение о поведении пользователя, которое можно подтвердить или опровергнуть на исследовании. Она задаёт рамки проверки и помогает не развивать продукт вслепую, опираясь на догадки вместо данных.",
    ),
    section(
      "Зачем в работе",
      "Дизайнеру гипотеза нужна, чтобы связать правки интерфейса с измеримым результатом и заранее договориться с командой о критериях проверки. Без неё обсуждение сводится к вкусовым предпочтениям, а решение сложно защитить перед заказчиком.",
    ),
    section(
      "Как применять",
      "Сначала формулируют проблему и цель исследования, затем записывают предположение по структуре «если сделать X, получим Y, потому что Z». После этого выбирают метод проверки и фиксируют критерии заранее, а по итогам сессии сравнивают наблюдаемое поведение с ожидаемым.",
    ),
    section(
      "Пример",
      "В источнике приведён пример: «Если добавить кнопку „Поделиться“ на странице сайта, количество новых пользователей увеличится». В формулировке есть действие, аудитория и измеримый результат, поэтому её можно проверить на прототипе.",
    ),
  ],
};

describe("guides plan", () => {
  it("нормализует служебные префиксы названий", () => {
    assert.equal(normalizeTitle("Понятие: Автолейауты"), "Автолейауты");
    assert.equal(normalizeTitle("  Работа с  изображениями  "), "изображениями");
  });

  it("строит короткую фразу для запроса и fallback-интент", () => {
    assert.equal(searchPhrase("Понятие: Автолейауты"), "Автолейауты");
    const query = fallbackQueries(skill);
    assert.match(query.ru, /^как /);
  });

  it("фильтрует вакансии и соцсети, но не профильные источники", () => {
    assert.equal(isDeniedUrl("https://career.habr.com/vacancies/1"), true);
    assert.equal(isDeniedUrl("https://hh.ru/vacancy/1"), true);
    assert.equal(isDeniedUrl("https://habr.com/ru/articles/1/"), false);
  });

  it("поднимает профильные домены и дедуплицирует кандидатов", () => {
    const good = scoreHit({ title: "Хабр", url: "https://habr.com/ru/articles/1/", description: "разбор темы", query: "q", queryLang: "ru" }, 0);
    const other = scoreHit({ title: "Какой-то блог", url: "https://example.com/post", description: "разбор темы", query: "q", queryLang: "ru" }, 0);
    assert.ok(good > other);
    const picked = pickCandidates(
      [hit({ url: "https://habr.com/ru/articles/1/" }), hit({ url: "https://habr.com/ru/articles/1/" }), hit({ url: "https://hh.ru/vacancy/1" })],
      5,
    );
    assert.equal(picked.length, 1);
    assert.equal(hostOf(picked[0]?.url ?? ""), "habr.com");
  });

  it("проверяет тему источника по названию пункта", () => {
    const page = { title: "Как настраивать автолейаут в Figma", text: "Автолейаут и его настройки." };
    assert.ok(keywordRelevance(page, { title: "Автолейауты" }) >= 0.34);
    assert.ok(isTopicRelevant(page, { title: "Автолейауты" }));
    assert.equal(isTopicRelevant(page, { title: "Юзабилити-тестирование" }), false);
  });

  it("определяет язык источника и пригодность по объёму", () => {
    assert.equal(sourceLang(0.9), "ru");
    assert.equal(sourceLang(0.1), "en");
    assert.equal(isUsableSource({ chars: 5000, cyrShare: 0.9 }), true);
    assert.equal(isUsableSource({ chars: 300, cyrShare: 0.9 }), false);
  });
});

describe("guides validate", () => {
  it("принимает подробный разбор из 3–5 разделов", () => {
    assert.equal(validateGuideDoc(goodDoc).ok, true);
    assert.match(renderGuideText(goodDoc), /Что это/);
  });

  it("отклоняет малое число разделов, короткие разделы, ссылки и обещания уровня", () => {
    assert.equal(validateGuideDoc({ status: "ok", sections: goodDoc.sections.slice(0, 2) }).ok, false);
    const short = {
      status: "ok" as const,
      sections: goodDoc.sections.map((item, index) => (index === 0 ? { ...item, text: "Коротко." } : item)),
    };
    assert.equal(validateGuideDoc(short).ok, false);
    const linked = {
      status: "ok" as const,
      sections: goodDoc.sections.map((item, index) => (index === 0 ? { ...item, text: `${item.text} Подробнее: https://example.com` } : item)),
    };
    assert.equal(validateGuideDoc(linked).ok, false);
    const banned = {
      status: "ok" as const,
      sections: goodDoc.sections.map((item, index) => (index === 0 ? { ...item, text: `${item.text} Это повысит твой уровень.` } : item)),
    };
    assert.equal(validateGuideDoc(banned).ok, false);
  });

  it("разбирает JSON модели и понимает no_data", () => {
    const parsed = parseGuideContent(
      JSON.stringify({ status: "ok", sections: [{ heading: "Что это", text: "Текст раздела." }] }),
    );
    assert.equal(parsed?.status, "ok");
    const noData = parseGuideContent('{"status":"no_data"}');
    assert.equal(noData?.status, "no_data");
    assert.equal(parseGuideContent("не json"), null);
  });
});
