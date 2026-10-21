import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectEscoCandidates } from "../src/methodology/v1/candidate-parser/esco.ts";
import { collectOnetCandidates } from "../src/methodology/v1/candidate-parser/onet.ts";
import { candidateId, openProfessions, parseCompetencyCandidates } from "../src/methodology/v1/candidate-parser/parse.ts";
import type { FetchLike, ProfessionCatalogFile } from "../src/methodology/v1/candidate-parser/types.ts";

const catalog: ProfessionCatalogFile = {
  professions: [
    { id: "graphic", title: "Графический дизайн", status: "open_for_assessment" },
    { id: "product", title: "Продуктовый дизайн", status: "open_for_assessment" },
    { id: "spatial_interior_arch", title: "Среда", status: "described_not_open" },
  ],
};

function jsonResponse(body: unknown, status = 200): Awaited<ReturnType<FetchLike>> {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("candidate parser", () => {
  it("берёт из каталога только профессии, открытые для оценки", () => {
    assert.deepEqual(
      openProfessions(catalog).map((profession) => profession.id),
      ["graphic", "product"],
    );
  });

  it("одинаковая формулировка получает тот же id", () => {
    assert.equal(
      candidateId("graphic", "esco:1", "Digital  Media"),
      candidateId("graphic", "esco:1", "digital media"),
    );
  });

  it("кладёт навыки ESCO в очередь и не принимает чужое занятие для product", async () => {
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url.includes("/resource/occupation") && url.includes("69bcbb0a")) {
        return jsonResponse({
          title: "graphic designer",
          uri: "http://data.europa.eu/esco/occupation/graphic",
          _links: {
            hasEssentialSkill: {
              uri: "http://data.europa.eu/esco/skill/media",
              title: "digital media",
              skillType: "http://data.europa.eu/esco/skill-type/knowledge",
            },
            hasOptionalSkill: [
              {
                uri: "http://data.europa.eu/esco/skill/type",
                title: "apply typography",
                skillType: "http://data.europa.eu/esco/skill-type/skill",
              },
            ],
          },
        });
      }
      if (url.includes("/search")) {
        return jsonResponse({
          _embedded: {
            results: [{ title: "product development manager", uri: "http://data.europa.eu/esco/occupation/manager" }],
          },
        });
      }
      throw new Error(`неожиданный адрес ${url}`);
    };

    const queue = await parseCompetencyCandidates({
      catalog,
      fetchImpl,
      retrievedOn: "2026-10-18",
    });

    assert.equal(queue.writesToGraph, false);
    assert.deepEqual(queue.professionIds, ["graphic", "product"]);
    assert.equal(queue.candidates.length, 2);
    assert.equal(queue.candidates[0]?.phrase, "digital media");
    assert.equal(queue.candidates[0]?.kind, "knowledge");
    assert.equal(queue.candidates[0]?.relation, "essential");
    assert.equal(queue.candidates[1]?.relation, "optional");
    assert.equal(queue.sources[0]?.status, "partial");
    assert.match(queue.sources[0]?.note ?? "", /product/);
    assert.equal(queue.sources[1]?.status, "skipped");
  });

  it("читает страницу навыков O*NET и пропускает отсутствующий список knowledge", async () => {
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url.includes("summary/skills")) {
        return jsonResponse({
          element: [
            { id: "2.A.1.b", name: "Active Listening", description: "Giving full attention." },
            { id: "2.A.1.b", name: "Active Listening", description: "повтор той же записи" },
          ],
        });
      }
      if (url.includes("summary/knowledge")) return jsonResponse({}, 404);
      throw new Error(`неожиданный адрес ${url}`);
    };

    const result = await collectOnetCandidates({
      fetchImpl,
      professions: [{ id: "graphic", title: "Графический дизайн", status: "open_for_assessment" }],
      retrievedOn: "2026-10-18",
      apiKey: "test-key",
      candidateId,
    });

    assert.equal(result.skipped, false);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]?.sourceRecordId, "27-1024.00:2.A.1.b");
    assert.match(result.notes.join(" "), /knowledge/);
  });

  it("не ходит в ESCO за профессией вне открытого каталога", async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return jsonResponse({});
    };
    const result = await collectEscoCandidates({
      fetchImpl,
      professions: [{ id: "spatial_interior_arch", title: "Среда", status: "described_not_open" }],
      retrievedOn: "2026-10-18",
      candidateId,
    });
    assert.equal(calls, 0);
    assert.equal(result.candidates.length, 0);
    assert.match(result.notes[0] ?? "", /queries/);
  });
});
