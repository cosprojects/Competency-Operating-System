import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultBaseStatus,
  isSourceWideReason,
  requiredVotes,
  resolveSourceReviewStatus,
  sourceReviewBadge,
} from "../apps/web/src/lib/source-review.ts";

describe("пороги подтверждения материалов", () => {
  it("на маленькой базе работают минимумы: один голос не решает", () => {
    assert.equal(requiredVotes("BLOCK", 1), 2);
    assert.equal(requiredVotes("CONFIRM", 1), 2);
    assert.equal(requiredVotes("BLOCK", 10), 2);
    assert.equal(requiredVotes("CONFIRM", 10), 2);
  });

  it("на средней базе порог — доля активных залогиненных", () => {
    assert.equal(requiredVotes("BLOCK", 100), 5);
    assert.equal(requiredVotes("CONFIRM", 100), 10);
  });

  it("на большой базе порог упирается в потолок", () => {
    assert.equal(requiredVotes("BLOCK", 500), 10);
    assert.equal(requiredVotes("CONFIRM", 500), 15);
    assert.equal(requiredVotes("BLOCK", 10_000), 10);
  });
});

describe("статус подтверждения материала", () => {
  const base = "needs_confirmation" as const;

  it("без голосов сохраняет базовый статус", () => {
    assert.equal(
      resolveSourceReviewStatus({ baseStatus: base, counts: { confirms: 0, blocks: 0 }, activeUsers: 10 }),
      "needs_confirmation",
    );
    assert.equal(
      resolveSourceReviewStatus({
        baseStatus: "auto_accepted",
        counts: { confirms: 0, blocks: 0 },
        activeUsers: 10,
      }),
      "auto_accepted",
    );
  });

  it("одна блокировка — спорный, порог — скрытие", () => {
    assert.equal(
      resolveSourceReviewStatus({ baseStatus: base, counts: { confirms: 0, blocks: 1 }, activeUsers: 10 }),
      "disputed",
    );
    assert.equal(
      resolveSourceReviewStatus({ baseStatus: base, counts: { confirms: 0, blocks: 2 }, activeUsers: 10 }),
      "blocked",
    );
  });

  it("подтверждения снимают бейдж", () => {
    assert.equal(
      resolveSourceReviewStatus({ baseStatus: base, counts: { confirms: 2, blocks: 0 }, activeUsers: 10 }),
      "confirmed",
    );
  });

  it("подтверждения и блокировки конкурируют по своим порогам", () => {
    assert.equal(
      resolveSourceReviewStatus({ baseStatus: base, counts: { confirms: 5, blocks: 3 }, activeUsers: 100 }),
      "disputed",
    );
  });

  it("админ-блок сильнее голосов", () => {
    assert.equal(
      resolveSourceReviewStatus({
        baseStatus: base,
        counts: { confirms: 10, blocks: 0 },
        activeUsers: 100,
        blockedByAdmin: true,
      }),
      "blocked",
    );
  });
});

describe("бейдж и базовый статус", () => {
  it("у неподтверждённого и спорного есть текст и подсказка", () => {
    assert.equal(sourceReviewBadge("needs_confirmation")?.label, "Подтвердить");
    assert.match(sourceReviewBadge("needs_confirmation")?.hint ?? "", /Ресурс не подтверждён/);
    assert.equal(sourceReviewBadge("disputed")?.label, "Спорный");
    assert.equal(sourceReviewBadge("confirmed"), null);
    assert.equal(sourceReviewBadge("auto_accepted"), null);
    assert.equal(sourceReviewBadge("blocked"), null);
  });

  it("материалы каталога требуют подтверждения, реестровые — нет", () => {
    assert.equal(defaultBaseStatus("material_123"), "needs_confirmation");
    assert.equal(defaultBaseStatus("figma-design-basics"), "auto_accepted");
  });

  it("недостоверность и битая ссылка — сигнал на весь источник", () => {
    assert.equal(isSourceWideReason("UNRELIABLE"), true);
    assert.equal(isSourceWideReason("BROKEN"), true);
    assert.equal(isSourceWideReason("OFF_TOPIC"), false);
    assert.equal(isSourceWideReason(null), false);
  });
});
