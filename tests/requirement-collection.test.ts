import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectRequirementJournal, mergeJournals } from "../src/methodology/v1/requirement-collection/collect.ts";
import { matchIdentities } from "../src/methodology/v1/requirement-collection/identity.ts";
import type { RequirementJournal } from "../src/methodology/v1/requirement-collection/types.ts";
import { buildQueries } from "../src/methodology/v1/requirement-collection/templates.ts";
import { classifySource, htmlExcerpts, jsonExcerpts } from "../src/methodology/v1/requirement-collection/text.ts";
import type { PageInput } from "../src/methodology/v1/requirement-collection/types.ts";

const color = "Работа с цветом и подбор палитры для интерфейсного макета.";
const colorTheory = "Основы колористики входят в учебную программу дизайнера интерфейсов.";
const unlabeled = "Подбор цветовой палитры для ролика упоминается без типа страницы.";
const salary = "Доход растет от Junior (70к) до Lead (300к+) по мере накопления опыта.";
const definition = "UX (User Experience) — это пользовательский опыт человека в продукте.";
const flow = "Дизайнер собирает пользовательские сценарии и пути человека по интерфейсу.";

function page(input: {
  url: string;
  title: string;
  html: string;
  obtainedBy?: PageInput["obtainedBy"];
  queryId?: string;
}): PageInput {
  return {
    url: input.url,
    title: input.title,
    text: input.html,
    obtainedBy: input.obtainedBy ?? "url",
    excerpts: htmlExcerpts(input.html, input.url),
    ...(input.queryId ? { queryId: input.queryId } : {}),
  };
}

describe("сбор требований профессии", () => {
  it("строит русские запросы и не переводит название без подписи", () => {
    const queries = buildQueries("UX/UI-дизайн");
    assert.equal(queries.some((query) => query.text === "Ключевые навыки UX/UI-дизайн"), true);
    assert.equal(queries.some((query) => query.language === "en"), false);
    const withLabel = buildQueries("UX/UI-дизайн", "UX/UI designer");
    assert.equal(withLabel.some((query) => query.text === "Essential skills UX/UI designer"), true);
  });

  it("оставляет страницу кандидатом, если тип не один", () => {
    assert.equal(
      classifySource({
        url: "https://jobs.example/vacancy",
        title: "Курс и вакансия",
        text: "Программа обучения и вакансия дизайнера.",
      }),
      "unknown",
    );
    assert.equal(
      classifySource({
        url: "https://hh.ru/vacancy/1",
        title: "Вакансия",
        text: "Требуется дизайнер интерфейсов для продукта.",
      }),
      "vacancy",
    );
  });

  it("держит разные формулировки отдельно и не пускает текст без основания", () => {
    const skills = `<h2>Ключевые навыки</h2><p>${color}</p><p>${colorTheory}</p>`;
    const journal = collectRequirementJournal({
      professionId: "uxui",
      professionTitle: "UX/UI-дизайн",
      retrievedOn: "2026-10-20",
      pages: [
        page({ url: "https://school.example/course", title: "Учебный курс", html: skills }),
        page({
          url: "https://notes.example/post",
          title: "Заметка",
          html: `<h2>Ключевые навыки</h2><p>${color}</p><p>${unlabeled}</p><h2>Сколько зарабатывает</h2><p>${salary}</p><h2>Кто такой дизайнер</h2><p>${definition}</p>`,
        }),
      ],
    });
    assert.equal(journal.writesToGraph, false);
    const accepted = journal.statements.find((statement) => statement.fragment === color);
    const theory = journal.statements.find((statement) => statement.fragment === colorTheory);
    assert.equal(accepted?.entersMatching, true);
    assert.equal(accepted?.independentCount, 1);
    assert.equal(accepted?.witnesses[0]?.obtainedBy, "url");
    assert.equal(accepted?.witnesses[0]?.queryId, undefined);
    assert.equal(accepted?.witnesses[0]?.place, "Ключевые навыки");
    assert.equal(theory?.id === accepted?.id, false);
    const onlyCandidate = journal.statements.find((statement) => statement.fragment === unlabeled);
    assert.equal(onlyCandidate?.entersMatching, false);
    const pay = journal.statements.find((statement) => statement.fragment === salary);
    const intro = journal.statements.find((statement) => statement.fragment === definition);
    assert.ok(pay);
    assert.ok(intro);
    assert.equal(pay?.entersMatching, false);
    assert.equal(intro?.entersMatching, false);
    assert.equal(pay?.witnesses[0]?.basis, null);
  });

  it("не связывает прямой адрес с поисковым запросом и связывает страницу, открытую запросом", () => {
    const html = `<h2>Обязанности</h2><p>${flow}</p>`;
    const journal = collectRequirementJournal({
      professionId: "uxui",
      professionTitle: "UX/UI-дизайн",
      retrievedOn: "2026-10-20",
      pages: [
        page({ url: "https://jobs.example/a", title: "Вакансия", html }),
        page({
          url: "https://jobs.example/from-search",
          title: "Вакансия",
          html,
          obtainedBy: "query",
          queryId: "ru-duties",
        }),
      ],
    });
    const statement = journal.statements[0];
    const direct = statement?.witnesses.find((witness) => witness.url.endsWith("/a"));
    const found = statement?.witnesses.find((witness) => witness.url.endsWith("/from-search"));
    assert.equal(direct?.obtainedBy, "url");
    assert.equal(direct?.queryId, undefined);
    assert.equal(found?.obtainedBy, "query");
    assert.equal(found?.queryId, "ru-duties");
    assert.equal(statement?.independentCount, 1);
  });

  it("считает дословную копию на другом сайте независимым свидетельством, а на том же сайте нет", () => {
    const html = `<h2>Обязанности</h2><p>${flow}</p>`;
    const journal = collectRequirementJournal({
      professionId: "uxui",
      professionTitle: "UX/UI-дизайн",
      retrievedOn: "2026-10-20",
      pages: [
        page({ url: "https://jobs.example/a", title: "Вакансия", html }),
        page({ url: "https://jobs.example/b", title: "Вакансия", html }),
        page({ url: "https://other.example/vacancy", title: "Вакансия", html }),
      ],
    });
    assert.equal(journal.statements.length, 1);
    assert.equal(journal.statements[0]?.witnesses.length, 3);
    assert.equal(journal.statements[0]?.independentCount, 2);
  });

  it("оставляет переводы ESCO отдельными фрагментами одной записи", () => {
    const skillUri = "http://data.europa.eu/esco/skill/example";
    const raw = JSON.stringify({
      uri: skillUri,
      description: {
        en: { literal: "Apply a variety of visual techniques in order to design graphic material.", mimetype: "plain/text" },
        de: { literal: "Wendet verschiedene visuelle Techniken an, um grafisches Material zu gestalten.", mimetype: "plain/text" },
      },
    });
    const url = "https://ec.europa.eu/esco/api/resource/skill?uri=" + encodeURIComponent(skillUri);
    const journal = collectRequirementJournal({
      professionId: "uxui",
      professionTitle: "UX/UI-дизайн",
      retrievedOn: "2026-10-20",
      pages: [
        {
          url,
          title: "",
          text: "",
          obtainedBy: "url",
          excerpts: jsonExcerpts(raw, url),
        },
      ],
    });
    const descriptions = journal.statements.filter((statement) => statement.witnesses.some((witness) => witness.basis));
    assert.equal(descriptions.length, 2);
    assert.equal(new Set(descriptions.flatMap((statement) => statement.witnesses.map((witness) => witness.recordId))).size, 1);
    assert.equal(descriptions.every((statement) => statement.independentCount === 1), true);
    assert.equal(descriptions[0]?.witnesses[0]?.queryId, undefined);
    const places = descriptions.flatMap((statement) => statement.witnesses.map((witness) => witness.place));
    assert.deepEqual(places.sort(), ["description.de.literal", "description.en.literal"]);
  });

  it("сопоставляет только описание с предметом и результатом и не сливает чужое название", () => {
    const recordId = "http://data.europa.eu/esco/skill/example";
    const witness = {
      url: "https://ec.europa.eu/esco/skill",
      host: "ec.europa.eu",
      sourceType: "directory" as const,
      status: "accepted" as const,
      obtainedBy: "url" as const,
      recordId,
      basis: "описание навыка ESCO",
    };
    const journal: RequirementJournal = {
      journalVersion: "1.0.0",
      writesToGraph: false,
      professionId: "uxui",
      retrievedOn: "2026-10-20",
      queries: [],
      statements: [
        {
          id: "en",
          professionId: "uxui",
          fragment: "Apply a variety of visual techniques in order to design graphic material. Combine graphical elements to communicate concepts and ideas.",
          entersMatching: true,
          independentCount: 1,
          witnesses: [{ ...witness, place: "description.en.literal" }],
        },
        {
          id: "de",
          professionId: "uxui",
          fragment: "Wendet verschiedene visuelle Techniken an, um grafisches Material zu gestalten.",
          entersMatching: true,
          independentCount: 1,
          witnesses: [{ ...witness, place: "description.de.literal" }],
        },
        {
          id: "title",
          professionId: "uxui",
          fragment: "design graphics",
          entersMatching: true,
          independentCount: 1,
          witnesses: [{ ...witness, place: "_links.hasEssentialSkill[0].title", basis: "название обязательного навыка ESCO" }],
        },
        {
          id: "other",
          professionId: "uxui",
          fragment: "Java (computer programming)",
          entersMatching: true,
          independentCount: 1,
          witnesses: [{ ...witness, recordId: "http://data.europa.eu/esco/skill/java", place: "title", basis: "название необязательного навыка ESCO" }],
        },
      ],
    };
    const matched = matchIdentities(journal, "data/requirement-collection/uxui.json");
    assert.equal(matched.writesToGraph, false);
    assert.equal(matched.identities.length, 1);
    assert.equal(matched.identities[0]?.subject, "graphic material");
    assert.equal(matched.decisions.find((item) => item.statementId === "de")?.outcome, "same_record");
    assert.equal(matched.decisions.find((item) => item.statementId === "title")?.outcome, "same_record");
    assert.equal(matched.decisions.find((item) => item.statementId === "other")?.outcome, "unresolved");
    assert.equal(matched.decisions.find((item) => item.statementId === "other")?.identityId, undefined);
  });

  it("повторный проход не создаёт вторую запись", () => {
    const html = `<h2>Ключевые навыки</h2><p>${color}</p>`;
    const first = collectRequirementJournal({
      professionId: "uxui",
      professionTitle: "UX/UI-дизайн",
      retrievedOn: "2026-10-20",
      pages: [page({ url: "https://school.example/course", title: "Учебный курс", html })],
    });
    const second = collectRequirementJournal({
      professionId: "uxui",
      professionTitle: "UX/UI-дизайн",
      retrievedOn: "2026-10-21",
      pages: [page({ url: "https://school.example/course", title: "Учебный курс", html })],
    });
    const merged = mergeJournals(first, second);
    assert.equal(merged.statements.length, 1);
    assert.equal(merged.statements[0]?.witnesses.length, 1);
    assert.equal(merged.retrievedOn, "2026-10-21");
  });
});
