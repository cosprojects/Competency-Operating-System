import assert from "node:assert/strict";
import test from "node:test";
import {
  appendHistory,
  isSlotEligible,
  pickDailySource,
  scoreSlot,
  selectDailyTarget,
  type DailyHistoryEntry,
  type DailySlot,
  type DailyState,
} from "../src/methodology/v1/materials-agent/daily.ts";

function slot(overrides: Partial<DailySlot> = {}): DailySlot {
  return {
    professionId: "it.uxui",
    professionTitle: "UX/UI-дизайнер",
    competencyId: "ux-flow",
    competencyTitle: "Сценарии",
    format: "course",
    tier: "core",
    accepted: 0,
    target: 3,
    min: 2,
    attempts: 0,
    status: "not_started",
    professionAccepted: 10,
    ...overrides,
  };
}

const today = "2026-11-03";

test("пустой список слотов — нет плана", () => {
  assert.equal(selectDailyTarget([], [], today), null);
});

test("все слоты закрыты — сеть не нужна", () => {
  const slots = [slot({ accepted: 3, status: "ok" }), slot({ format: "video", accepted: 5, target: 5, status: "ok" })];
  assert.equal(selectDailyTarget(slots, [], today), null);
});

test("выбирает foundation с большим дефицитом", () => {
  const slots = [
    slot({ competencyId: "optional-1", tier: "optional", accepted: 2, target: 2, status: "ok" }),
    slot({ competencyId: "core-1", tier: "core", accepted: 1, target: 3 }),
    slot({ competencyId: "foundation-1", tier: "foundation", accepted: 1, target: 5 }),
  ];
  const plan = selectDailyTarget(slots, [], today);
  assert.equal(plan?.slot.competencyId, "foundation-1");
});

test("слот, который уже искали сегодня, пропускается", () => {
  const slots = [slot({ competencyId: "today", lastAttemptAt: today }), slot({ competencyId: "later", lastAttemptAt: "2026-11-01" })];
  const plan = selectDailyTarget(slots, [], today);
  assert.equal(plan?.slot.competencyId, "later");
});

test("insufficient без наступления cooldown пропускается", () => {
  const future = slot({ competencyId: "future", accepted: 0, attempts: 3, status: "insufficient", nextAttemptAt: "2026-12-01" });
  const ready = slot({ competencyId: "ready", accepted: 0, attempts: 3, status: "insufficient", nextAttemptAt: "2026-11-01" });
  assert.equal(isSlotEligible(future, today), false);
  assert.equal(isSlotEligible(ready, today), true);
  assert.equal(selectDailyTarget([future, ready], [], today)?.slot.competencyId, "ready");
});

test("новая профессия (0 материалов) получает приоритет", () => {
  const oldProfession = slot({ professionId: "it.motion", professionAccepted: 50 });
  const newProfession = slot({ professionId: "it.new", professionAccepted: 0 });
  // при равном дефиците и tier новая профессия должна выиграть
  const plan = selectDailyTarget([oldProfession, newProfession], [], today);
  assert.equal(plan?.slot.professionId, "it.new");
});

test("scoreSlot растёт с дефицитом и tier", () => {
  const base = slot({ tier: "optional", accepted: 2, target: 2, status: "ok" });
  const gap = slot({ tier: "core", accepted: 0, target: 3, status: "not_started" });
  assert.ok(scoreSlot(gap) > scoreSlot(base));
});

test("ротация источника выбирает самый давний", () => {
  const history: DailyHistoryEntry[] = [
    { date: "2026-11-01", professionId: "it.uxui", competencyId: "a", format: "course", source: "wikipedia", result: "accepted" },
    { date: "2026-11-02", professionId: "it.uxui", competencyId: "b", format: "course", source: "habr", result: "no_material" },
  ];
  const source = pickDailySource(history, ["wikipedia", "habr", "stepik"]);
  assert.equal(source, "stepik");
});

test("история ограничивается и хранит дату последнего прогона", () => {
  let state: DailyState = { history: [] };
  for (let i = 0; i < 5; i += 1) {
    state = appendHistory(state, {
      date: `2026-11-0${i + 1}`,
      professionId: "it.uxui",
      competencyId: "a",
      format: "course",
      source: "wikipedia",
      result: "no_material",
    }, 3);
  }
  assert.equal(state.history.length, 3);
  assert.equal(state.lastRunDate, "2026-11-05");
});
