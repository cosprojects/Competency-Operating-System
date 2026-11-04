import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_REVIEW_POLICY,
  classifyMaterial,
  countOutcomes,
  reviewSignalSchema,
  toStageDecision,
  type ReviewSignal,
} from "../src/methodology/v1/review/policy.ts";

function signal(overrides: Partial<ReviewSignal> = {}): ReviewSignal {
  return reviewSignalSchema.parse({
    materialId: "https://example.com/course",
    verdict: "accept",
    confidence: 0.9,
    relevance: 0.8,
    flags: [],
    access: "free",
    domain: "example.com",
    provider: "Хабр",
    competency: {
      hasAcceptedMaterials: true,
      acceptedInFormat: 1,
      maxPerFormat: 5,
      conflictingAccepted: false,
    },
    domainHistory: { known: true, accepted: 2, blocked: 0 },
    ...overrides,
  });
}

describe("политика приёмки: пять исходов", () => {
  it("два независимых сигнала дают auto_accept", () => {
    const decision = classifyMaterial(signal());
    assert.equal(decision.outcome, "auto_accept");
    assert.equal(decision.publish, true);
    assert.equal(decision.badge, false);
    assert.equal(decision.reason, "two_independent_signals");
    assert.equal(decision.policyVersion, DEFAULT_REVIEW_POLICY.version);
  });

  it("слабый сигнал даёт бейдж, но материал публикуется", () => {
    const decision = classifyMaterial(signal({ confidence: 0.7 }));
    assert.equal(decision.outcome, "badge");
    assert.equal(decision.publish, true);
    assert.equal(decision.badge, true);
  });

  it("новый домен уходит в карантин, но публикуется с бейджем", () => {
    const decision = classifyMaterial(signal({ domainHistory: { known: false, accepted: 0, blocked: 0 } }));
    assert.equal(decision.outcome, "quarantine");
    assert.equal(decision.publish, true);
    assert.equal(decision.badge, true);
  });

  it("первый материал компетенции — приоритетный аудит", () => {
    const decision = classifyMaterial(
      signal({ competency: { hasAcceptedMaterials: false, acceptedInFormat: 0, maxPerFormat: 5, conflictingAccepted: false } }),
    );
    assert.equal(decision.outcome, "queue");
    assert.equal(decision.publish, true);
  });

  it("жёсткий флаг скрывает материал", () => {
    const decision = classifyMaterial(signal({ flags: ["off_topic"] }));
    assert.equal(decision.outcome, "auto_reject");
    assert.equal(decision.publish, false);
    assert.equal(decision.badge, false);
  });

  it("мягкий флаг публикует с бейджем", () => {
    const decision = classifyMaterial(signal({ flags: ["marketing"] }));
    assert.equal(decision.outcome, "badge");
    assert.equal(decision.reason, "flag_marketing");
    assert.equal(decision.publish, true);
  });

  it("заблокированный домен — отказ", () => {
    const decision = classifyMaterial(signal({ domainHistory: { known: true, accepted: 0, blocked: 1 } }));
    assert.equal(decision.outcome, "auto_reject");
    assert.equal(decision.reason, "domain_blocked");
  });

  it("платный доступ публикуется с бейджем", () => {
    const decision = classifyMaterial(signal({ access: "paid" }));
    assert.equal(decision.outcome, "badge");
    assert.equal(decision.reason, "paid_access");
  });

  it("лимит на формат не блокирует, но снимает авто", () => {
    const decision = classifyMaterial(
      signal({ competency: { hasAcceptedMaterials: true, acceptedInFormat: 5, maxPerFormat: 5, conflictingAccepted: false } }),
    );
    assert.equal(decision.outcome, "badge");
    assert.equal(decision.reason, "format_limit");
  });

  it("устаревание снимает авто", () => {
    const decision = classifyMaterial(signal({ ageDays: 900 }));
    assert.equal(decision.outcome, "badge");
    assert.equal(decision.reason, "stale_source");
  });

  it("вердикт reject и низкая релевантность — отказ", () => {
    assert.equal(classifyMaterial(signal({ verdict: "reject" })).outcome, "auto_reject");
    assert.equal(classifyMaterial(signal({ relevance: 0.2 })).outcome, "auto_reject");
  });

  it("инвариант «публикуем всё»: скрывается только auto_reject", () => {
    const cases: ReviewSignal[] = [
      signal(),
      signal({ confidence: 0.7 }),
      signal({ domainHistory: { known: false, accepted: 0, blocked: 0 } }),
      signal({ competency: { hasAcceptedMaterials: false, acceptedInFormat: 0, maxPerFormat: 5, conflictingAccepted: false } }),
      signal({ flags: ["paywall"] }),
      signal({ flags: ["off_topic"] }),
    ];
    for (const item of cases) {
      const decision = classifyMaterial(item);
      assert.equal(decision.publish, decision.outcome !== "auto_reject");
      assert.equal(decision.badge, decision.publish && decision.outcome !== "auto_accept");
    }
  });
});

describe("политика приёмки: маппинг в контракт стадии", () => {
  it("auto_accept → accepted, остальные опубликованные → needs_confirmation", () => {
    assert.equal(toStageDecision(classifyMaterial(signal())), "accepted");
    assert.equal(toStageDecision(classifyMaterial(signal({ confidence: 0.7 }))), "needs_confirmation");
    assert.equal(toStageDecision(classifyMaterial(signal({ flags: ["off_topic"] }))), "rejected");
  });

  it("countOutcomes считает распределение", () => {
    const counts = countOutcomes([
      classifyMaterial(signal()),
      classifyMaterial(signal({ confidence: 0.7 })),
      classifyMaterial(signal({ flags: ["off_topic"] })),
    ]);
    assert.equal(counts.auto_accept, 1);
    assert.equal(counts.badge, 1);
    assert.equal(counts.auto_reject, 1);
    assert.equal(counts.quarantine, 0);
  });
});
