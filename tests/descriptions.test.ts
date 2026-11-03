import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateDescription } from "../src/methodology/v1/competency/descriptions/validate.ts";
import { applyDescriptionUpdates } from "../src/methodology/v1/competency/descriptions/apply.ts";

const validProfession = "Проектирует AI-native продукты: от исследования и сценариев до дизайн-системы, прототипов и проверки реализации в коде.";
const validKnowledge = "Понимание того, как AI-модели работают с контекстом, помогает выбирать инструмент и не ждать от генерации невозможного.";
const validSkill = "Собирает сценарии в единую карту, проверяет альтернативные ветки и фиксирует состояния интерфейса до передачи в дизайн.";

test("принимает информативные описания", () => {
  assert.deepEqual(validateDescription(validProfession, { kind: "profession", title: "AI-дизайнер" }), []);
  assert.deepEqual(validateDescription(validKnowledge, { kind: "knowledge", title: "Context window" }), []);
  assert.deepEqual(validateDescription(validSkill, { kind: "skill", title: "Проектировать сценарии" }), []);
});

test("отклоняет префикс Понимание/Умение и дубль названия", () => {
  assert.ok(validateDescription("Понимание: Design system governance.", { kind: "knowledge", title: "Design system governance" }).some((item) => item.code === "forbidden_prefix"));
  assert.ok(validateDescription("Design system governance.", { kind: "knowledge", title: "Design system governance" }).some((item) => item.code === "equals_title"));
  assert.ok(validateDescription("Design system governance — это управление правилами команды.", { kind: "knowledge", title: "Design system governance" }).some((item) => item.code === "starts_with_title"));
});

test("отклоняет boilerplate, короткие и не-русские описания", () => {
  assert.ok(validateDescription("AI-дизайнер: структура компетенций, знания, навыки и учебные материалы.", { kind: "profession", title: "AI-дизайнер" }).some((item) => item.code === "boilerplate"));
  assert.ok(validateDescription("Коротко.", { kind: "skill", title: "Сценарии" }).some((item) => item.code === "too_short"));
  assert.ok(validateDescription("Design system governance is about rules and tokens for teams.", { kind: "knowledge", title: "Governance" }).some((item) => item.code === "not_russian"));
});

test("применяет описания в view, extra и catalog", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cos-descriptions-"));
  try {
    const base = path.join(root, "src/methodology/v1/competency");
    await mkdir(path.join(base, "model/professions/views"), { recursive: true });
    await mkdir(path.join(base, "model"), { recursive: true });
    await mkdir(path.join(base, "canonical"), { recursive: true });
    await mkdir(path.join(base, "catalog"), { recursive: true });
    await writeFile(path.join(base, "model/professions/views/aidesigner.json"), JSON.stringify({ professionId: "it.aidesigner", title: "AI-дизайнер", sections: [] }, null, 2));
    await writeFile(path.join(base, "model/competencies-extra.json"), JSON.stringify({ competencies: [{ id: "aidesigner-test", title: "Тест", definition: "Старое." }] }, null, 2));
    await writeFile(path.join(base, "canonical/uxui.json"), JSON.stringify({ branches: [{ sections: [{ competencies: [{ id: "ux-test", title: "UX", definition: "Старое." }] }] }] }, null, 2));
    await writeFile(path.join(base, "catalog/it.json"), JSON.stringify({ blocks: [{ tags: [{ id: "tag-1", title: "Тег", kind: "knowledge", definition: "Старое." }] }] }, null, 2));

    const result = await applyDescriptionUpdates(root, {
      professions: new Map([["aidesigner", validProfession]]),
      competencies: new Map([["aidesigner-test", validProfession], ["ux-test", validProfession]]),
      tags: new Map([["tag-1", validKnowledge]]),
    });
    assert.equal(result.views, 1);
    assert.equal(result.extra, 1);
    assert.equal(result.canonical, 1);
    assert.equal(result.tags, 1);
    assert.equal(result.missing.length, 0);
    const view = JSON.parse(await readFile(path.join(base, "model/professions/views/aidesigner.json"), "utf8")) as { description?: string };
    assert.equal(view.description, validProfession);
    const extra = JSON.parse(await readFile(path.join(base, "model/competencies-extra.json"), "utf8")) as { competencies: Array<{ definition: string }> };
    assert.equal(extra.competencies[0]?.definition, validProfession);
    const catalog = JSON.parse(await readFile(path.join(base, "catalog/it.json"), "utf8")) as { blocks: Array<{ tags: Array<{ definition: string }> }> };
    assert.equal(catalog.blocks[0]?.tags[0]?.definition, validKnowledge);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("сообщает о неизвестной компетенции", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cos-descriptions-missing-"));
  try {
    const base = path.join(root, "src/methodology/v1/competency");
    await mkdir(path.join(base, "model/professions/views"), { recursive: true });
    await mkdir(path.join(base, "model"), { recursive: true });
    await mkdir(path.join(base, "canonical"), { recursive: true });
    await mkdir(path.join(base, "catalog"), { recursive: true });
    await writeFile(path.join(base, "model/competencies-extra.json"), JSON.stringify({ competencies: [] }, null, 2));
    await writeFile(path.join(base, "canonical/uxui.json"), JSON.stringify({ branches: [] }, null, 2));
    await writeFile(path.join(base, "catalog/it.json"), JSON.stringify({ blocks: [] }, null, 2));
    const result = await applyDescriptionUpdates(root, { professions: new Map(), competencies: new Map([["missing", validProfession]]), tags: new Map() });
    assert.deepEqual(result.missing, ["missing"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
