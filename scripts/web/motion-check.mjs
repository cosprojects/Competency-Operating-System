#!/usr/bin/env node
/**
 * Motion check — браузерная проверка системы движения (COS-EAR-016).
 *
 * Что проверяет:
 *  1. параллакс реально включается: после движения мыши `--pointer-nx` ≠ 0,
 *     а бумага-канвас сдвинута не больше чем на 6 px;
 *  2. `prefers-reduced-motion: reduce` полностью выключает движение:
 *     `data-motion="off"`, переменные курсора не пишутся, входные анимации
 *     не прячут контент;
 *  3. появление секций: после прокрутки ни одна цель не остаётся `out`;
 *  4. канвас: клик по узлу плавно переводит вид (трансформ меняется по кадрам)
 *     и не вызывает длинных задач > 150 мс;
 *  5. нет ошибок консоли и горизонтального скролла на 360 px.
 *
 * Зависимостей нет: Chrome запускается сам (headless), CDP — на global fetch
 * и global WebSocket из Node 22+.
 *
 * Запуск:
 *   npm run qa:motion
 *   node scripts/web/motion-check.mjs --base http://127.0.0.1:3100 --out /tmp/axiona-motion
 *   CHROME_PATH=/path/to/chrome node scripts/web/motion-check.mjs
 *
 * Exit code: 0 — всё в порядке, 1 — есть расхождения.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE = argValue("--base", process.env.MOTION_BASE_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT = argValue("--out", "/tmp/axiona-motion");
const CDP_PORT = Number(argValue("--cdp", 9334));
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const PARALLAX_MAX = 6;
const results = [];
const consoleErrors = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/* ------------------------------------------------------------------ Chrome */

function startChrome() {
  if (process.env.MOTION_NO_SPAWN === "1") return null;
  if (!existsSync(CHROME)) throw new Error(`Chrome не найден: ${CHROME}`);
  const profile = join(tmpdir(), `axiona-motion-${process.pid}`);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-breakpad",
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${CDP_PORT}`,
      "about:blank",
    ],
    { stdio: "ignore", detached: true },
  );
  child.unref();
  return { child, profile };
}

async function waitForCdp(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (response.ok) return;
    } catch {
      /* Chrome ещё поднимается */
    }
    await new Promise((ok) => setTimeout(ok, 200));
  }
  throw new Error(`Chrome не отвечает на порту ${CDP_PORT}`);
}

/* -------------------------------------------------------------- CDP client */

async function openPage() {
  const target = await (
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })
  ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = () => fail(new Error("WebSocket CDP не открылся"));
  });

  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${message.method ?? "CDP"}: ${JSON.stringify(message.error)}`));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      consoleErrors.push(message.params?.exceptionDetails?.text ?? "exception");
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
      consoleErrors.push(
        (message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" "),
      );
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`evaluate: ${result.exceptionDetails.text ?? "ошибка"}`);
    }
    return result.result?.value;
  };

  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

  /** Ждём появления элемента вместо фиксированной паузы: dev-сервер может
   *  компилировать маршрут дольше, и проверка не должна падать из-за этого. */
  const waitForSelector = async (selector, timeoutMs = 8000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const found = await evaluate(
        `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      );
      if (found) return true;
      await wait(120);
    }
    return false;
  };

  const setViewport = (width, height, mobile = false) =>
    send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });

  const setReducedMotion = (enabled) =>
    send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: enabled ? "reduce" : "no-preference" }],
    });

  const navigate = async (path, settleMs = 1200) => {
    await send("Page.navigate", { url: `${BASE}${path}` });
    await wait(settleMs);
  };

  const moveMouse = async (x, y) => {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await setViewport(1440, 1000);
  await setReducedMotion(false);

  return {
    send,
    evaluate,
    wait,
    waitForSelector,
    setViewport,
    setReducedMotion,
    navigate,
    moveMouse,
    close: () => ws.close(),
  };
}

/* ----------------------------------------------------------------- checks */

function parseTranslateX(transform) {
  if (!transform || transform === "none") return 0;
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (matrix) {
    const values = matrix[1].split(",").map((value) => Number(value.trim()));
    return Number.isFinite(values[4]) ? values[4] : 0;
  }
  const matrix3d = transform.match(/matrix3d\(([^)]+)\)/);
  if (matrix3d) {
    const values = matrix3d[1].split(",").map((value) => Number(value.trim()));
    return Number.isFinite(values[12]) ? values[12] : 0;
  }
  return 0;
}

async function checkParallax(page) {
  await page.navigate("/");
  await page.waitForSelector(".paper-layer");
  await page.moveMouse(1200, 400);
  await page.wait(400);

  const nx = await page.evaluate(
    `getComputedStyle(document.documentElement).getPropertyValue("--pointer-nx").trim()`,
  );
  record(
    "параллакс включается на движение мыши",
    Number(nx) > 0.1,
    `--pointer-nx = ${nx || "пусто"}`,
  );

  const layer = await page.evaluate(`(() => {
    const element = document.querySelector(".paper-layer");
    if (!element) return 0;
    return Math.abs(new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
  })()`);
  record(
    "бумага уходит за курсором не больше 6 px",
    Number(layer) > 0 && Number(layer) <= PARALLAX_MAX + 0.01,
    `|tx|=${Number(layer).toFixed(2)}px`,
  );

  // Курсор ушёл из окна — слои должны вернуться, а не залипнуть.
  await page.evaluate(`document.dispatchEvent(new PointerEvent("pointerleave"))`);
  await page.wait(500);
  const afterLeave = await page.evaluate(`(() => {
    const element = document.querySelector(".paper-layer");
    return element ? Math.abs(new DOMMatrixReadOnly(getComputedStyle(element).transform).m41) : 0;
  })()`);
  record(
    "после ухода курсора бумага возвращается в ноль",
    afterLeave < 0.5,
    `|tx| = ${Number(afterLeave).toFixed(2)}px`,
  );
}

async function checkReveal(page) {
  await page.navigate("/");
  await page.waitForSelector("[data-reveal]");
  const before = await page.evaluate(`(() => {
    const targets = [...document.querySelectorAll("[data-reveal]")];
    return { total: targets.length, out: targets.filter((element) => element.dataset.reveal === "out").length };
  })()`);
  record(
    "секции ниже экрана ждут появления",
    before.total > 0 && before.out > 0,
    `всего ${before.total}, спрятано ${before.out}`,
  );

  await page.evaluate(`(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((ok) => setTimeout(ok, 120));
    }
    window.scrollTo(0, document.body.scrollHeight);
  })()`);
  await page.wait(1400);
  const after = await page.evaluate(`(() => {
    const targets = [...document.querySelectorAll("[data-reveal]")];
    return { total: targets.length, out: targets.filter((element) => element.dataset.reveal === "out").length };
  })()`);
  record("после прокрутки все секции показаны", after.out === 0, `осталось ${after.out}`);
}

async function checkReducedMotion(page) {
  await page.setReducedMotion(true);
  await page.navigate("/");
  await page.waitForSelector("[data-enter]");
  await page.moveMouse(1200, 400);
  await page.wait(300);

  const state = await page.evaluate(`(() => {
    const enter = document.querySelector("[data-enter]");
    const layer = document.querySelector(".paper-layer");
    return {
      motion: document.documentElement.dataset.motion,
      pointer: getComputedStyle(document.documentElement).getPropertyValue("--pointer-nx").trim(),
      enterOpacity: enter ? getComputedStyle(enter).opacity : null,
      revealOut: [...document.querySelectorAll("[data-reveal]")].filter((element) => element.dataset.reveal === "out").length,
      layer: layer ? getComputedStyle(layer).transform : null,
    };
  })()`);

  record("reduced motion: движение помечено выключенным", state.motion === "off", `data-motion=${state.motion}`);
  record("reduced motion: переменные курсора не пишутся", state.pointer === "", `--pointer-nx=${state.pointer || "пусто"}`);
  record(
    "reduced motion: входная анимация не прячет контент",
    state.enterOpacity === null || Number(state.enterOpacity) === 1,
    `opacity=${state.enterOpacity}`,
  );
  record("reduced motion: секции не скрываются", state.revealOut === 0, `спрятано ${state.revealOut}`);
  record(
    "reduced motion: бумага без сдвига",
    state.layer === null || state.layer === "none" || Math.abs(parseTranslateX(state.layer)) < 0.01,
    `transform=${state.layer}`,
  );

  await page.setReducedMotion(false);
}

async function checkGraph(page) {
  await page.setViewport(1440, 1000);
  await page.navigate("/professions/uxui", 1800);
  await page.waitForSelector(".graph-node");

  const node = await page.evaluate(`(() => {
    const element = document.querySelector(".graph-node");
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
  })()`);
  record("граф отрисован", Boolean(node), node ? `узел в (${node.x}, ${node.y})` : "узлов нет");
  if (!node) return;

  const edges = await page.evaluate(`(() => {
    const list = [...document.querySelectorAll(".graph-edge")];
    if (!list.length) return { count: 0 };
    return {
      count: list.length,
      pathLength: list[0].getAttribute("pathLength"),
      drawing: list[0].classList.contains("is-drawing"),
      dash: getComputedStyle(list[0]).strokeDashoffset,
    };
  })()`);
  record(
    "нити прорисованы и видны после анимации",
    edges.count === 0 || (edges.pathLength === "1" && Math.abs(parseFloat(edges.dash)) < 0.5),
    `рёбер ${edges.count}, pathLength=${edges.pathLength}, dashoffset=${edges.dash}`,
  );

  // Сборка схемы: карточки входят волной (сверху вниз, слева направо),
  // а не все одновременно.
  const assembly = await page.evaluate(`(() => {
    const nodes = [...document.querySelectorAll(".graph-node.is-entering")];
    const delays = nodes.map((element) => (parseFloat(getComputedStyle(element).animationDelay) || 0) * 1000);
    const names = new Set(nodes.map((element) => getComputedStyle(element).animationName));
    return { count: nodes.length, uniqueDelays: new Set(delays).size, maxDelay: Math.max(0, ...delays), names: [...names] };
  })()`);
  record(
    "карточки схемы входят волной, а не все сразу",
    assembly.count > 0 && assembly.uniqueDelays >= 3 && assembly.maxDelay >= 60,
    `карточек ${assembly.count}, разных задержек ${assembly.uniqueDelays}, максимум ${assembly.maxDelay}ms, animation=${assembly.names.join(",")}`,
  );

  // Магнит: карточки тянутся к курсору и возвращаются на свою ось.
  const magnetStart = await page.evaluate(`(() => {
    const element = document.querySelector(".graph-node");
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2 + 36, y: box.top + box.height / 2 + 20 };
  })()`);
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: Math.round(magnetStart.x),
    y: Math.round(magnetStart.y),
    buttons: 0,
  });
  await page.wait(420);
  const magnet = await page.evaluate(`(() => {
    const nodes = [...document.querySelectorAll(".graph-node")];
    const pulled = nodes.filter((element) => {
      const value = parseFloat(getComputedStyle(element).getPropertyValue("--magnet-x")) || 0;
      const tilt = parseFloat(getComputedStyle(element).getPropertyValue("--tilt-y")) || 0;
      return Math.abs(value) > 0.5 || Math.abs(tilt) > 0.2;
    });
    const first = nodes[0];
    return {
      pulled: pulled.length,
      transform: getComputedStyle(first).transform,
      magnet: getComputedStyle(first).getPropertyValue("--magnet-x").trim(),
    };
  })()`);
  record(
    "карточки тянутся к курсору (магнит)",
    magnet.pulled > 0 && magnet.transform !== "none",
    `подмагничено ${magnet.pulled}, transform=${magnet.transform.slice(0, 24)}`,
  );

  // Уводим курсор за пределы схемы: карточки должны вернуться на свою ось.
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: 990, buttons: 0 });
  await page.wait(600);
  const released = await page.evaluate(`(() => {
    const nodes = [...document.querySelectorAll(".graph-node")];
    const stuck = nodes.filter((element) => {
      const value = parseFloat(getComputedStyle(element).getPropertyValue("--magnet-x")) || 0;
      return Math.abs(value) > 0.5;
    });
    return stuck.length;
  })()`);
  record("после ухода курсора карточки возвращаются на ось", released === 0, `залипло ${released}`);

  // Выбор компетенции в рейле: панель открывается, вид плавно переезжает к узлу.
  const motion = await page.evaluate(`(async () => {
    const longTasks = [];
    let observer = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch { /* браузер без longtask */ }

    const stage = document.querySelector(".graph-stage");
    // Канвас сам выбирает первую компетенцию при открытии, поэтому берём ту,
    // что ещё не активна: иначе вид уже стоит в целевой точке и «перелёта» нет.
    const tiles = [...document.querySelectorAll(".competency-tile")];
    const tile = tiles.find((element) => !element.classList.contains("is-active")) ?? tiles[0];
    const samples = [];
    const started = performance.now();
    tile.click();
    await new Promise((resolve) => {
      const tick = () => {
        samples.push(stage.style.transform);
        if (performance.now() - started < 420) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    observer?.disconnect();
    return {
      unique: new Set(samples).size,
      longTasks,
      final: stage.style.transform,
      detailOpened: document.querySelector(".canvas-screen")?.classList.contains("has-detail") ?? false,
    };
  })()`);

  record(
    "выбор компетенции открывает панель и переводит вид плавно",
    motion.unique >= 5 && motion.detailOpened,
    `уникальных кадров ${motion.unique}, панель ${motion.detailOpened ? "открыта" : "нет"}`,
  );
  record(
    "перелёт вида не вызывает длинных задач > 150 мс",
    motion.longTasks.every((duration) => duration <= 150),
    `длинных задач ${motion.longTasks.length}`,
  );

  // Панорамирование: во время драга React не должен перерисовываться на каждый
  // pointermove — проверяем, что трансформ меняется и кадров не меньше 5.
  const pan = await page.evaluate(`(async () => {
    const graph = document.querySelector(".graph");
    const stage = document.querySelector(".graph-stage");
    const box = graph.getBoundingClientRect();
    const start = { x: box.left + 200, y: box.top + 200 };
    const before = stage.style.transform;
    graph.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1, clientX: start.x, clientY: start.y }));
    const samples = new Set();
    for (let step = 1; step <= 10; step += 1) {
      graph.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: start.x + step * 6, clientY: start.y + step * 4 }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.add(stage.style.transform);
    }
    graph.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: start.x + 60, clientY: start.y + 40 }));
    return { changed: stage.style.transform !== before, frames: samples.size };
  })()`);
  record(
    "панорамирование отвечает на каждый кадр драга",
    pan.changed && pan.frames >= 5,
    `кадров ${pan.frames}, сдвиг ${pan.changed ? "есть" : "нет"}`,
  );
}

async function checkMobile(page) {
  for (const path of ["/", "/professions", "/professions/uxui"]) {
    await page.setViewport(360, 800, true);
    await page.navigate(path, 1500);
    const overflow = await page.evaluate(
      `document.documentElement.scrollWidth - document.documentElement.clientWidth`,
    );
    record(`нет горизонтального скролла на 360px: ${path}`, overflow <= 1, `перелив ${overflow}px`);
  }
  await page.setViewport(1440, 1000);
}

/* ------------------------------------------------------------------- main */

const chrome = startChrome();
let page = null;

try {
  if (!chrome) console.log("MOTION_NO_SPAWN=1 — подключаюсь к уже запущенному Chrome");
  await waitForCdp();
  page = await openPage();

  await checkParallax(page);
  await checkReveal(page);
  await checkReducedMotion(page);
  await checkGraph(page);
  await checkMobile(page);

  record("нет ошибок в консоли", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} catch (error) {
  record("проверка выполнилась", false, error.message);
} finally {
  page?.close();
  if (chrome?.child?.pid) {
    try {
      process.kill(-chrome.child.pid, "SIGTERM");
    } catch {
      try {
        chrome.child.kill("SIGTERM");
      } catch {
        /* уже закрыт */
      }
    }
  }
}

mkdirSync(OUT, { recursive: true });
const failed = results.filter((result) => !result.ok);
const report = {
  base: BASE,
  createdAt: new Date().toISOString(),
  passed: results.length - failed.length,
  failed: failed.length,
  consoleErrors,
  results,
};
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.passed}/${results.length} проверок пройдено → ${join(OUT, "report.json")}`);
process.exit(failed.length === 0 ? 0 : 1);
