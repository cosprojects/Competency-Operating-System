import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProfessionTarget } from "../src/methodology/v1/competency/types.ts";
import type { ProfessionSourceFile } from "../src/methodology/v1/competency/model/types.ts";
import { applyProfessionSource } from "../src/methodology/v1/competency/sources/profession-config.ts";

const target: ProfessionTarget = {
  id: "motion",
  title: "Моушн-дизайнер",
  titleEn: "Motion designer",
  aliases: [],
  esco: { search: "old esco", titleIncludes: ["motion designer"] },
  onet: { socCodes: ["27-1014.00"], titleIncludes: ["Multimedia Artists and Animators"] },
  practicum: { slug: "old-practicum" },
};

const source: ProfessionSourceFile = {
  professionId: "it.motion",
  sphereId: "it",
  occupationSources: [
    { sourceId: "esco", query: "motion designer" },
    { sourceId: "onet", query: "27-1014.00" },
  ],
  materialSourceIds: ["wikipedia", "habr"],
  blockedSourceIds: ["hh-api"],
};

describe("profession source config", () => {
  it("подставляет query из source-файла и отключает неразрешённые источники", () => {
    const effective = applyProfessionSource(target, source);
    assert.equal(effective.esco?.search, "motion designer");
    assert.ok(effective.onet);
    assert.equal(effective.practicum, undefined);
  });

  it("оставляет target как есть без source-файла", () => {
    assert.deepEqual(applyProfessionSource(target, undefined), target);
  });
});
