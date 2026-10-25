import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractArrayAfterMarker,
  extractGlobalState,
  parsePracticumCatalog,
  parsePracticumProfessionPage,
  renderPracticumMarkdown,
  stripTags,
} from "../src/methodology/v1/profile/practicum.ts";
import type { PracticumDesignJournal } from "../src/methodology/v1/profile/practicum.ts";
import { isUsablePracticumTitle } from "../src/methodology/v1/competency/sources/practicum.ts";

const catalogHtml = `<html><body><script>
window.__GLOBAL_STATE__ = {"store":{"getV2CatalogProfessions":[
  {"slug":"interface-designer","name":"Дизайнер интерфейсов","description":"Проектирует интерфейсы","tags":[
    {"name":"Дизайн","tag_type":"head","slug":"design"},
    {"name":"Figma","tag_type":"skills","hidden":false},
    {"name":"С нуля","tag_type":"common","hidden":false}
  ]},
  {"slug":"python-developer","name":"Python-разработчик","description":"Пишет код","tags":[
    {"name":"Программирование","tag_type":"head","slug":"programming"}
  ]}
]}};
</script></body></html>`;

const pageHtml = `<html><body><script>
window.__GLOBAL_STATE__ = {"x":{"s":"<div class=\\"tool-item\\">FigJam</div><div class=\\"tool-item\\">Figma</div><li class=\\"lesson\\">Сетки в дизайне</li><li class=\\"lesson\\">Сетки в дизайне</li>"}};
</script></body></html>`;

describe("извлечение профессий и навыков Яндекс Практикума", () => {
  it("оставляет только дизайнерские профессии и их теги навыков", () => {
    const professions = parsePracticumCatalog(catalogHtml);
    assert.equal(professions.length, 1);
    assert.equal(professions[0]?.slug, "interface-designer");
    assert.deepEqual(professions[0]?.tags, ["Figma"]);
    assert.equal(professions[0]?.url, "https://practicum.yandex.ru/interface-designer/");
  });

  it("достаёт инструменты и темы урока со страницы профессии без дублей", () => {
    const page = parsePracticumProfessionPage(pageHtml, "interface-designer");
    assert.deepEqual(page.tools, ["FigJam", "Figma"]);
    assert.deepEqual(page.lessons, ["Сетки в дизайне"]);
    assert.deepEqual(page.skills, ["FigJam", "Figma", "Сетки в дизайне"]);
    assert.equal(page.url, "https://practicum.yandex.ru/interface-designer/");
  });

  it("находит массив профессий, даже если состояние страницы не парсится как JSON", () => {
    const brokenState = `<script>window.__GLOBAL_STATE__ = {broken: undefined, list: "getV2CatalogProfessions":[{"slug":"web-designer","name":"Веб-дизайнер","tags":[{"tag_type":"head","slug":"design"}]}]};</script>`;
    assert.equal(extractGlobalState(brokenState), undefined);
    const raw = extractArrayAfterMarker(brokenState, '"getV2CatalogProfessions":');
    assert.ok(Array.isArray(raw));
    const professions = parsePracticumCatalog(brokenState);
    assert.equal(professions[0]?.slug, "web-designer");
  });

  it("чистит разметку и рендерит читаемый отчёт", () => {
    assert.equal(stripTags("<p>Привет&nbsp;<b>мир</b></p>"), "Привет мир");
    const journal: PracticumDesignJournal = {
      journalVersion: "1.0.0",
      writesToGraph: false,
      source: {
        id: "practicum-design",
        url: "https://practicum.yandex.ru/catalog/design/",
        license: "OGL",
        robots: "robots",
        retrievedOn: "2026-10-21",
      },
      professions: [
        {
          slug: "interface-designer",
          name: "Дизайнер интерфейсов",
          description: "Проектирует интерфейсы",
          url: "https://practicum.yandex.ru/interface-designer/",
          tags: ["Figma"],
          tools: ["Figma"],
          lessons: ["Сетки в дизайне"],
          skills: ["Figma", "Сетки в дизайне"],
        },
      ],
    };
    const markdown = renderPracticumMarkdown(journal);
    assert.match(markdown, /Дизайнер интерфейсов/);
    assert.match(markdown, /Сетки в дизайне/);
    assert.match(markdown, /writesToGraph: false/);
  });
});

describe("фильтр тем Практикума", () => {
  it("оставляет короткие темы и отбрасывает абзацы, карьерные и маркетинговые фразы", () => {
    assert.equal(isUsablePracticumTitle("Кинетическая типографика"), true);
    assert.equal(isUsablePracticumTitle("Предпечатная подготовка"), true);
    assert.equal(isUsablePracticumTitle("Навыки работы с ИИ сейчас так же важны, как и хардскилы. Поэтому модуль по нейросетям входит в базовую программу."), false);
    assert.equal(isUsablePracticumTitle("Выстроите собственную стратегию поиска работы"), false);
    assert.equal(isUsablePracticumTitle("Куда пойти работать"), false);
    assert.equal(isUsablePracticumTitle("Подключитесь к Карьере от Практикума — сервису для поиска вакансий"), false);
    assert.equal(isUsablePracticumTitle("Составите резюме и портфолио"), false);
  });
});
