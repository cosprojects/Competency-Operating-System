import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProfessionView } from "../src/methodology/v1/competency/model/profession-view.ts";
import type { TagRecord } from "../src/methodology/v1/competency/types.ts";
import type { TagMappingFile } from "../src/methodology/v1/competency/mapping/types.ts";
import { validateTagMapping } from "../src/methodology/v1/competency/mapping/validate.ts";

const view: ProfessionView = {
  viewVersion: "1.0.0",
  professionId: "it.product",
  sphereId: "it",
  title: "Продуктовый дизайнер",
  sections: [
    {
      id: "s1",
      title: "Discovery",
      definition: "D",
      competencies: [
        { competencyId: "product-jtbd", tier: "foundation", order: 1 },
        { competencyId: "ui-color", tier: "core", order: 2 },
      ],
    },
  ],
};

function tag(id: string, title: string, kind: TagRecord["kind"]): TagRecord {
  return {
    id, slug: id, title, aliases: [], kind, definition: `D ${title}`,
    professionIds: ["it.product"], sourceRefs: [], evidenceState: "supported",
    competencyLinks: [], materialIds: [], needsReview: false,
  };
}

const tags = [tag("tag_jtbd", "JTBD", "knowledge"), tag("tag_figma", "Figma", "tool")];

function mapping(entries: TagMappingFile["entries"], excludedTags?: TagMappingFile["excludedTags"]): TagMappingFile {
  return {
    mappingVersion: "1.0.0",
    domain: "it",
    professionId: "it.product",
    updatedOn: "2026-10-25",
    status: "draft",
    entries,
    ...(excludedTags ? { excludedTags } : {}),
  };
}

describe("сопоставление product-тегов компетенциям", () => {
  it("принимает полное покрытие и считает support", () => {
    const result = validateTagMapping({
      mapping: mapping([
        { competencyId: "product-jtbd", tags: [{ title: "JTBD", relation: "direct" }], rationale: "Прямое свидетельство" },
        { competencyId: "ui-color", tags: [], rationale: "Product-тегов нет, блок переиспользован" },
      ]),
      view,
      tags,
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.coverage.direct, 1);
    assert.equal(result.coverage.none, 1);
    assert.equal(result.coverage.competencies, 2);
    assert.deepEqual(result.unaccountedTagTitles, []);
  });

  it("ловит пропущенную компетенцию, неизвестный тег и tool как доказательство", () => {
    const result = validateTagMapping({
      mapping: mapping([
        { competencyId: "product-jtbd", tags: [{ title: "Неизвестный тег", relation: "direct" }, { title: "Figma", relation: "adjacent" }], rationale: "Проверка ошибок" },
      ]),
      view,
      tags,
    });
    assert.ok(result.errors.some((error) => error.includes("не сопоставлена ни с одним тегом")));
    assert.ok(result.errors.some((error) => error.includes("не найден в собранном наборе")));
    assert.ok(result.errors.some((error) => error.includes("инструмент не является доказательством")));
    assert.deepEqual(result.unaccountedTagTitles, ["JTBD"]);
  });

  it("ловит повтор тега в записи и одновременное использование/исключение", () => {
    const result = validateTagMapping({
      mapping: mapping(
        [
          { competencyId: "product-jtbd", tags: [{ title: "JTBD", relation: "direct" }, { title: "JTBD", relation: "adjacent" }], rationale: "Ошибочный повтор тега" },
          { competencyId: "ui-color", tags: [], rationale: "Product-тегов нет, блок переиспользован" },
        ],
        [{ title: "JTBD", reason: "Одновременно исключается и используется" }],
      ),
      view,
      tags,
    });
    assert.ok(result.errors.some((error) => error.includes("повтор тега")));
    assert.ok(result.errors.some((error) => error.includes("одновременно использован и исключён")));
  });

  it("предупреждает о собранных knowledge/skill-тегах без решения", () => {
    const extra = [...tags, tag("tag_cjm", "CJM", "knowledge")];
    const result = validateTagMapping({
      mapping: mapping([
        { competencyId: "product-jtbd", tags: [{ title: "JTBD", relation: "direct" }], rationale: "Прямое свидетельство" },
        { competencyId: "ui-color", tags: [], rationale: "Product-тегов нет, блок переиспользован" },
      ]),
      view,
      tags: extra,
    });
    assert.deepEqual(result.unaccountedTagTitles, ["CJM"]);
    assert.ok(result.warnings.some((warning) => warning.includes("без решения")));
  });
});
