import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EDGE_DRAW_MAX,
  MAGNET_MAX_DEG,
  MAGNET_MAX_PX,
  MAGNET_RADIUS,
  PARALLAX_MAX_PX,
  clamp,
  easeOutStructure,
  edgeDelay,
  enterDelay,
  followFactor,
  interpolateView,
  magnetPull,
  magnetTilt,
  normalizedPointer,
  readingOrder,
  shouldTrackPointer,
} from "../apps/web/src/lib/motion/tokens.ts";

describe("motion tokens", () => {
  it("clamp держит границы и не пропускает NaN", () => {
    assert.equal(clamp(5, 0, 3), 3);
    assert.equal(clamp(-5, 0, 3), 0);
    assert.equal(clamp(2, 0, 3), 2);
    assert.equal(clamp(Number.NaN, -1, 1), -1);
  });

  it("normalizedPointer: центр — 0, края — ±1, нулевой вьюпорт — 0", () => {
    assert.deepEqual(normalizedPointer(500, 400, 1000, 800), { x: 0, y: 0 });
    assert.deepEqual(normalizedPointer(0, 0, 1000, 800), { x: -1, y: -1 });
    assert.deepEqual(normalizedPointer(1000, 800, 1000, 800), { x: 1, y: 1 });
    assert.deepEqual(normalizedPointer(90, 10, 0, 0), { x: 0, y: 0 });
  });

  it("normalizedPointer не выходит за −1…1 при курсоре вне окна", () => {
    const point = normalizedPointer(2400, -400, 1000, 800);
    assert.equal(point.x, 1);
    assert.equal(point.y, -1);
  });

  it("enterDelay растёт шагом и упирается в потолок", () => {
    assert.equal(enterDelay(0), 0);
    assert.equal(enterDelay(-3), 0);
    assert.equal(enterDelay(1), 60);
    assert.equal(enterDelay(3), 180);
    assert.equal(enterDelay(20), 240);
  });

  it("edgeDelay: потолок, нулевой индекс и отказ при большом графе", () => {
    assert.equal(edgeDelay(0, 10), 0);
    assert.equal(edgeDelay(2, 10), 24);
    assert.equal(edgeDelay(100, 10), 400);
    assert.equal(edgeDelay(2, EDGE_DRAW_MAX + 1), 0);
  });

  it("shouldTrackPointer отключает параллакс на тач, при reduced motion и в фоне", () => {
    const base = { reducedMotion: false, finePointer: true };
    assert.equal(shouldTrackPointer(base), true);
    assert.equal(shouldTrackPointer({ ...base, reducedMotion: true }), false);
    assert.equal(shouldTrackPointer({ ...base, finePointer: false }), false);
    assert.equal(shouldTrackPointer({ ...base, hidden: true }), false);
    assert.equal(shouldTrackPointer({ ...base, pointerType: "touch" }), false);
    assert.equal(shouldTrackPointer({ ...base, pointerType: "mouse" }), true);
  });

  it("easeOutStructure: 0 → 0, 1 → 1, монотонно и без перелёта", () => {
    assert.equal(easeOutStructure(0), 0);
    assert.equal(easeOutStructure(1), 1);
    assert.equal(easeOutStructure(-2), 0);
    assert.equal(easeOutStructure(3), 1);
    let previous = 0;
    for (let step = 1; step <= 10; step += 1) {
      const value = easeOutStructure(step / 10);
      assert.ok(value >= previous, "кривая не должна идти назад");
      assert.ok(value <= 1, "кривая не должна перелетать единицу");
      previous = value;
    }
    // Быстрый старт: к середине времени пройдено больше половины пути.
    assert.ok(easeOutStructure(0.5) > 0.5);
  });

  it("followFactor: нулевой dt не двигает, больший dt сильнее тянет", () => {
    assert.equal(followFactor(0), 0);
    const small = followFactor(1 / 120);
    const large = followFactor(1 / 30);
    assert.ok(small > 0 && small < 1);
    assert.ok(large > small);
    // Без отскока: коэффициент никогда не превышает 1.
    assert.ok(large <= 1);
  });

  it("interpolateView возвращает исходный и целевой вид на концах", () => {
    const from = { zoom: 0.5, pan: { x: 0, y: 0 } };
    const to = { zoom: 0.8, pan: { x: 100, y: -40 } };
    assert.deepEqual(interpolateView(from, to, 0), from);
    assert.deepEqual(interpolateView(from, to, 1), to);
    const middle = interpolateView(from, to, 0.5);
    assert.ok(middle.zoom > from.zoom && middle.zoom < to.zoom);
    assert.ok(middle.pan.x > 0 && middle.pan.x < 100);
    assert.ok(middle.pan.y < 0 && middle.pan.y > -40);
  });
});

describe("magnet карточек схемы", () => {
  it("за радиусом не тянет и на границе даёт ноль", () => {
    assert.deepEqual(magnetPull(MAGNET_RADIUS, 0), { x: 0, y: 0 });
    assert.deepEqual(magnetPull(0, MAGNET_RADIUS * 2), { x: 0, y: 0 });
    assert.deepEqual(magnetTilt(MAGNET_RADIUS, 0), { x: 0, y: 0 });
    assert.deepEqual(magnetTilt(0, MAGNET_RADIUS * 3), { x: 0, y: 0 });
  });

  it("тянет к курсору: знак совпадает с направлением, длина не больше максимума", () => {
    const near = magnetPull(10, 0);
    assert.ok(near.x > 0, "курсор справа — смещение вправо");
    assert.equal(near.y, 0);
    assert.ok(Math.hypot(near.x, near.y) <= MAGNET_MAX_PX + 1e-9);

    const diagonal = magnetPull(-40, 40);
    assert.ok(diagonal.x < 0 && diagonal.y > 0);
    assert.ok(Math.hypot(diagonal.x, diagonal.y) <= MAGNET_MAX_PX + 1e-9);
  });

  it("затухание: ближе к курсору тянет сильнее, чем на краю радиуса", () => {
    const center = Math.hypot(magnetPull(1, 0).x, magnetPull(1, 0).y);
    const edge = Math.hypot(
      magnetPull(MAGNET_RADIUS - 1, 0).x,
      magnetPull(MAGNET_RADIUS - 1, 0).y,
    );
    assert.ok(center > edge);
    assert.ok(edge >= 0);
  });

  it("наклон не превышает максимум и меняет знак по стороне курсора", () => {
    const right = magnetTilt(20, 0);
    const left = magnetTilt(-20, 0);
    assert.ok(Math.abs(right.y) <= MAGNET_MAX_DEG + 1e-9);
    assert.equal(right.x, 0);
    assert.ok(right.y > 0 && left.y < 0);

    const below = magnetTilt(0, 20);
    assert.ok(below.x < 0, "курсор ниже — верхний край наклоняется к зрителю");
    assert.ok(Math.abs(below.x) <= MAGNET_MAX_DEG + 1e-9);
  });
});

describe("порядок сборки схемы", () => {
  it("сортирует сверху вниз, внутри полосы — слева направо", () => {
    const order = readingOrder([
      { id: "c", x: 400, y: 300 },
      { id: "b", x: 100, y: 300 },
      { id: "a", x: 100, y: 20 },
      { id: "d", x: 700, y: 20 },
    ]);
    assert.equal(order.get("a"), 0);
    assert.equal(order.get("d"), 1);
    assert.equal(order.get("b"), 2);
    assert.equal(order.get("c"), 3);
  });

  it("карточки одной визуальной полосы не разъезжаются по строкам", () => {
    const order = readingOrder([
      { id: "left", x: 0, y: 100 },
      { id: "right", x: 300, y: 108 },
      { id: "next", x: 0, y: 200 },
    ]);
    assert.ok((order.get("left") ?? 0) < (order.get("right") ?? 0));
    assert.ok((order.get("right") ?? 0) < (order.get("next") ?? 0));
  });
});
