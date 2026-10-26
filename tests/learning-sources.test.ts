import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import type { LearningSourceRegistry } from "../src/methodology/v1/learning-sources/types.ts";
import { validateLearningSources } from "../src/methodology/v1/learning-sources/validate.ts";
import { LEARNING_SEARCH_QUERIES } from "../src/methodology/v1/learning-sources/search.ts";

const file = new URL("../src/methodology/v1/learning-sources/registry.json", import.meta.url);

describe("learning source library", () => {
  it("содержит валидный реестр источников", async () => {
    const registry = JSON.parse(await readFile(file, "utf8")) as LearningSourceRegistry;
    assert.equal(validateLearningSources(registry).length, 0);
    assert.ok(registry.sources.some((source) => source.id === "motiondesign-school-courses" && source.authority === "primary"));
    assert.ok(registry.sources.some((source) => source.id === "classcentral-uxui-ipl" && source.status === "blocked"));
    assert.ok(registry.sources.some((source) => source.status === "duplicate" && source.duplicateOf));
  });

  it("имеет поисковые шаблоны для четырёх профессий", () => {
    assert.equal(Object.keys(LEARNING_SEARCH_QUERIES).length, 4);
    assert.ok(LEARNING_SEARCH_QUERIES.motion?.includes("motion design free courses"));
  });
});
