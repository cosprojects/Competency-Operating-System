"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  edgePath,
  layoutCompetencyGraph,
  type GraphMode,
  type GraphNode,
  type GraphNodeInput,
} from "@/lib/graph-layout";
import { tierLabel } from "@/lib/content";
import { countLabel } from "@/lib/content";
import {
  EDGE_DRAW_MAX,
  GRAPH_VIEW_MS,
  MAGNET_RADIUS,
  REDUCED_MOTION_QUERY,
  edgeDelay,
  interpolateView,
  magnetPull,
  magnetTilt,
  readingOrder,
  type ViewState,
} from "@/lib/motion/tokens";

const MIN_ZOOM = 0.18;
const MAX_ZOOM = 1.8;

/** Как часто обновлять проценты масштаба в тулбаре, мс. */
const ZOOM_READOUT_MS = 90;
/** Перелёт зума кнопками — короче программного фокуса. */
const BUTTON_ZOOM_MS = 160;
/** Сборка схемы: волна появления карточек, мс. */
// Сборка схемы: волна короче и с меньшим пробегом. Открытие — самый дорогой
// момент (34 карточки + 25 нитей), длинная анимация читается как «тормозит».
const NODE_ENTER_STEP_MS = 10;
const NODE_ENTER_CAP_MS = 260;
const NODE_ENTER_DURATION_MS = 260;
/** Куда «сжимается» схема перед сборкой: доля пути к центру и потолок, px. */
const NODE_ENTER_SHRINK = 0.1;
const NODE_ENTER_MAX_PX = 32;
/** Нити начинают расти, когда карточки уже в основном на местах. */
const EDGE_DRAW_BASE_MS = 80;
/** Магнит: не переписываем стили, если смещение изменилось меньше этого. */
const MAGNET_EPSILON_PX = 0.15;
const MAGNET_EPSILON_DEG = 0.1;
/** Сколько ближайших карточек максимум тянется к курсору. */
const MAGNET_MAX_NODES = 8;

const TIER_TEXT: Record<GraphNode["tier"], string> = {
  foundation: "Фундаментальная",
  core: "Основная",
  optional: "Необязательная",
};

/** Подпись ленты в SVG не умеет переноситься — режем по словам. */
function splitLabel(title: string, maxChars = 20, maxLines = 3): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1]!;
    lines[maxLines - 1] = last.length > maxChars - 1 ? `${last.slice(0, maxChars - 1)}…` : last;
  }
  return lines;
}

export interface FocusOptions {
  /** Сколько пикселей справа займёт панель, которая вот-вот откроется. */
  widthOffset?: number;
  duration?: number;
}

export interface GraphHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  focus: (id: string, options?: FocusOptions) => void;
}

interface ViewOptions {
  animate?: boolean;
  duration?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}


interface GraphNodeButtonProps {
  node: GraphNode;
  mode: GraphMode;
  active: boolean;
  hovered: boolean;
  matched: boolean;
  dimmed: boolean;
  enter: { x: number; y: number; delay: number };
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  register: (id: string, element: HTMLButtonElement | null) => void;
}

/**
 * Карточка узла вынесена в memo: при наведении и выборе меняются классы только
 * у двух узлов, остальные 30+ не перерисовываются. Это главная экономия при
 * движении курсора по схеме.
 */
const GraphNodeButton = memo(function GraphNodeButton({
  node,
  mode,
  active,
  hovered,
  matched,
  dimmed,
  enter,
  onHover,
  onSelect,
  register,
}: GraphNodeButtonProps) {
  return (
    <button
      ref={(element) => register(node.id, element)}
      type="button"
      className={`graph-node tier-${node.tier}${mode === "network" ? " is-network" : ""}${active ? " is-active" : ""}${hovered ? " is-hover" : ""}${matched ? " is-match" : ""}${dimmed ? " is-dim" : ""} is-entering`}
      style={
        {
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          "--enter-x": `${enter.x.toFixed(1)}px`,
          "--enter-y": `${enter.y.toFixed(1)}px`,
          animationDelay: `${enter.delay}ms`,
          animationDuration: `${NODE_ENTER_DURATION_MS}ms`,
        } as React.CSSProperties
      }
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(node.id)}
      title={`${node.title} — ${tierLabel(node.tier)}`}
    >
      <span className="node-top">
        <span className={`badge ${node.tier}`}>{TIER_TEXT[node.tier]}</span>
        <span className="num-badge">{node.order}</span>
      </span>
      <span className="node-title">{node.title}</span>
      <span className="node-meta">
        {countLabel(node.knowledge, ["знание", "знания", "знаний"])} ·{" "}
        {countLabel(node.skills, ["навык", "навыка", "навыков"])}
      </span>
    </button>
  );
});

const CompetencyGraphInner = forwardRef<
  GraphHandle,
  {
    nodes: GraphNodeInput[];
    mode: GraphMode;
    activeId: string | null;
    hoverId: string | null;
    matches: Set<string>;
    onHover: (id: string | null) => void;
    onSelect: (id: string) => void;
    onZoomChange: (percent: number) => void;
  }
>(function CompetencyGraph(
  { nodes, mode, activeId, hoverId, matches, onHover, onSelect, onZoomChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const initializedRef = useRef(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [panning, setPanning] = useState(false);

  const layout = useMemo(() => layoutCompetencyGraph(nodes, mode), [nodes, mode]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // Живой вид — источник правды. React-состояния для него нет: иначе каждый
  // pointermove перерисовывал бы весь граф, и панорамирование «залипало».
  const liveRef = useRef<ViewState>({ zoom: 0.5, pan: { x: 0, y: 0 } });
  const stageFrameRef = useRef(0);
  const animationRef = useRef<{ frame: number } | null>(null);

  const publishedPercentRef = useRef(-1);
  const lastPublishAtRef = useRef(0);
  const publishTimerRef = useRef(0);
  const latestZoomRef = useRef(liveRef.current.zoom);

  // Магнит: ссылки на карточки, позиция курсора и «подмагниченные» сейчас узлы.
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const magnetFrameRef = useRef(0);
  const magnetActiveRef = useRef(new Set<string>());
  // Кэш рамки контейнера: чтение getBoundingClientRect в кадре магнита
  // заставляло браузер синхронно сбрасывать только что записанные стили.
  const containerBoxRef = useRef<DOMRect | null>(null);
  // Последние записанные значения: пропускаем микроскопические изменения.
  const magnetValuesRef = useRef(new Map<string, { x: number; y: number; tx: number; ty: number }>());

  /** Порядок сборки схемы: сверху вниз, внутри полосы — слева направо. */
  const enterOrder = useMemo(() => readingOrder(layout.nodes), [layout]);

  const center = useMemo(
    () => ({ x: layout.width / 2, y: layout.height / 2 }),
    [layout.width, layout.height],
  );

  const registerNode = useCallback((id: string, element: HTMLButtonElement | null) => {
    if (element) nodeRefs.current.set(id, element);
    else nodeRefs.current.delete(id);
  }, []);

  /** Смещение и задержка входа считаются один раз на раскладку, не на рендер. */
  const enterStyles = useMemo(() => {
    const map = new Map<string, { x: number; y: number; delay: number }>();
    for (const node of layout.nodes) {
      const order = enterOrder.get(node.id) ?? 0;
      const inwardX = (center.x - (node.x + node.width / 2)) * NODE_ENTER_SHRINK;
      const inwardY = (center.y - (node.y + node.height / 2)) * NODE_ENTER_SHRINK;
      map.set(node.id, {
        x: Math.max(-NODE_ENTER_MAX_PX, Math.min(NODE_ENTER_MAX_PX, inwardX)),
        y: Math.max(-NODE_ENTER_MAX_PX, Math.min(NODE_ENTER_MAX_PX, inwardY)),
        delay: Math.min(NODE_ENTER_CAP_MS, order * NODE_ENTER_STEP_MS),
      });
    }
    return map;
  }, [center, enterOrder, layout]);

  /**
   * Магнит: карточки в радиусе тянутся к курсору и слегка наклоняются к нему.
   * Считаем в координатах экрана, а в CSS отдаём значения в координатах сцены
   * (делим на масштаб), иначе при зуме 40 % отклик был бы незаметен.
   */
  const readContainerBox = useCallback(() => {
    containerBoxRef.current = containerRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const applyMagnet = useCallback(() => {
    magnetFrameRef.current = 0;
    const pointer = pointerRef.current;
    const nextActive = new Set<string>();

    if (pointer && !reducedMotion()) {
      const rect = containerBoxRef.current ?? containerRef.current?.getBoundingClientRect() ?? null;
      if (rect) {
        containerBoxRef.current = rect;
        const view = liveRef.current;
        const scale = view.zoom || 1;
        const candidates: Array<{ id: string; element: HTMLButtonElement; dx: number; dy: number; distance: number }> = [];

        for (const node of layoutRef.current.nodes) {
          const element = nodeRefs.current.get(node.id);
          if (!element) continue;
          const nodeX = rect.left + view.pan.x + (node.x + node.width / 2) * scale;
          const nodeY = rect.top + view.pan.y + (node.y + node.height / 2) * scale;
          const dx = pointer.x - nodeX;
          const dy = pointer.y - nodeY;
          const distance = Math.hypot(dx, dy);
          if (distance >= MAGNET_RADIUS) continue;
          candidates.push({ id: node.id, element, dx, dy, distance });
        }

        // Тянем только ближайшие карточки: у дальних отклик всё равно на грани
        // восприятия, а каждый лишний узел — это лишний style recalc в кадре.
        candidates.sort((a, b) => a.distance - b.distance);
        for (const candidate of candidates.slice(0, MAGNET_MAX_NODES)) {
          const pull = magnetPull(candidate.dx, candidate.dy);
          const tilt = magnetTilt(candidate.dx, candidate.dy);
          const x = pull.x / scale;
          const y = pull.y / scale;
          const previous = magnetValuesRef.current.get(candidate.id);
          if (
            previous &&
            Math.abs(previous.x - x) < MAGNET_EPSILON_PX &&
            Math.abs(previous.y - y) < MAGNET_EPSILON_PX &&
            Math.abs(previous.tx - tilt.x) < MAGNET_EPSILON_DEG &&
            Math.abs(previous.ty - tilt.y) < MAGNET_EPSILON_DEG
          ) {
            nextActive.add(candidate.id);
            continue;
          }
          magnetValuesRef.current.set(candidate.id, { x, y, tx: tilt.x, ty: tilt.y });
          candidate.element.style.setProperty("--magnet-x", `${x.toFixed(2)}px`);
          candidate.element.style.setProperty("--magnet-y", `${y.toFixed(2)}px`);
          candidate.element.style.setProperty("--tilt-x", `${tilt.x.toFixed(2)}deg`);
          candidate.element.style.setProperty("--tilt-y", `${tilt.y.toFixed(2)}deg`);
          nextActive.add(candidate.id);
        }
      }
    }

    for (const id of magnetActiveRef.current) {
      if (nextActive.has(id)) continue;
      const element = nodeRefs.current.get(id);
      if (!element) continue;
      magnetValuesRef.current.delete(id);
      // Отпускаем через CSS-переход: карточка возвращается на свою ось.
      element.style.setProperty("--magnet-x", "0px");
      element.style.setProperty("--magnet-y", "0px");
      element.style.setProperty("--tilt-x", "0deg");
      element.style.setProperty("--tilt-y", "0deg");
    }

    magnetActiveRef.current = nextActive;
  }, []);

  const scheduleMagnet = useCallback(() => {
    if (magnetFrameRef.current) return;
    magnetFrameRef.current = window.requestAnimationFrame(applyMagnet);
  }, [applyMagnet]);

  const applyStage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const view = liveRef.current;
    stage.style.transform = `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`;
    stageFrameRef.current = 0;
    // Позиции карточек на экране изменились — пересчитываем магнит, но только
    // если курсор вообще в схеме (иначе лишний кадр на каждую анимацию вида).
    if (pointerRef.current || magnetActiveRef.current.size > 0) scheduleMagnet();
  }, [scheduleMagnet]);

  const scheduleStage = useCallback(() => {
    if (stageFrameRef.current) return;
    stageFrameRef.current = window.requestAnimationFrame(applyStage);
  }, [applyStage]);

  /** Проценты в тулбаре: сразу при заметной разнице, но не чаще 90 мс. */
  const publishZoom = useCallback(
    (zoom: number) => {
      latestZoomRef.current = zoom;
      const percent = Math.round(zoom * 100);
      if (percent === publishedPercentRef.current) return;
      const now = performance.now();
      const elapsed = now - lastPublishAtRef.current;
      if (elapsed >= ZOOM_READOUT_MS) {
        publishedPercentRef.current = percent;
        lastPublishAtRef.current = now;
        onZoomChange(percent);
        return;
      }
      if (publishTimerRef.current) return;
      publishTimerRef.current = window.setTimeout(() => {
        publishTimerRef.current = 0;
        const latest = Math.round(latestZoomRef.current * 100);
        if (latest === publishedPercentRef.current) return;
        publishedPercentRef.current = latest;
        lastPublishAtRef.current = performance.now();
        onZoomChange(latest);
      }, ZOOM_READOUT_MS - elapsed);
    },
    [onZoomChange],
  );

  const cancelAnimation = useCallback(() => {
    const animation = animationRef.current;
    if (animation?.frame) window.cancelAnimationFrame(animation.frame);
    animationRef.current = null;
  }, []);

  const setViewImmediate = useCallback(
    (next: ViewState) => {
      cancelAnimation();
      liveRef.current = next;
      applyStage();
      publishZoom(next.zoom);
    },
    [applyStage, cancelAnimation, publishZoom],
  );

  /**
   * Плавный перелёт вида. Ease-out без перелёта: COS-COM-011 §2.5 запрещает
   * overshoot, а пользователь должен видеть, что именно изменилось.
   */
  const animateViewTo = useCallback(
    (next: ViewState, duration = GRAPH_VIEW_MS) => {
      cancelAnimation();
      if (duration <= 0 || reducedMotion()) {
        setViewImmediate(next);
        return;
      }
      const from = liveRef.current;
      const start = performance.now();
      const animation = { frame: 0 };
      animationRef.current = animation;

      const step = (time: number) => {
        if (animationRef.current !== animation) return;
        const t = clamp((time - start) / duration, 0, 1);
        const frame = interpolateView(from, next, t);
        liveRef.current = frame;
        applyStage();
        publishZoom(frame.zoom);
        if (t < 1) {
          animation.frame = window.requestAnimationFrame(step);
          return;
        }
        animationRef.current = null;
        liveRef.current = next;
        applyStage();
        publishZoom(next.zoom);
      };

      animation.frame = window.requestAnimationFrame(step);
    },
    [applyStage, cancelAnimation, publishZoom, setViewImmediate],
  );

  const fit = useCallback(
    (options: ViewOptions = {}) => {
      const container = containerRef.current;
      const current = layoutRef.current;
      if (!container || current.nodes.length === 0) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      const fitted = Math.min((width - 60) / current.width, (height - 140) / current.height, 1);
      // Карточки лент широкие: полностью «вписать всё» — значит сделать текст
      // нечитаемым. Держим комфортный минимум, остальное доступно панорамой.
      const minimum = mode === "board" ? 0.4 : MIN_ZOOM;
      const zoom = clamp(Math.max(fitted, minimum), MIN_ZOOM, MAX_ZOOM);
      const scaledWidth = current.width * zoom;
      const scaledHeight = current.height * zoom;
      // Если схема шире экрана — показываем её с левого верхнего края (чтобы
      // названия разделов не обрезались), остальное доступно панорамой.
      const next: ViewState = {
        zoom,
        pan: {
          x: scaledWidth <= width - 60 ? (width - scaledWidth) / 2 : 24,
          y: scaledHeight <= height - 140 ? (height - scaledHeight) / 2 + 12 : 64,
        },
      };
      if (options.animate) animateViewTo(next, options.duration ?? GRAPH_VIEW_MS);
      else setViewImmediate(next);
    },
    [animateViewTo, mode, setViewImmediate],
  );

  /**
   * Центрирует узел. `widthOffset` позволяет целиться в ширину, которая будет
   * после открытия правой панели: карточка приезжает в центр будущего, более
   * узкого канваса, поэтому в момент открытия панели схема не дёргается.
   */
  const focus = useCallback(
    (id: string, options: FocusOptions = {}) => {
      const container = containerRef.current;
      const current = layoutRef.current;
      if (!container) return;
      const node = current.nodes.find((candidate) => candidate.id === id);
      if (!node) return;
      const width = Math.max(1, container.clientWidth - (options.widthOffset ?? 0));
      const height = container.clientHeight;
      const zoom = Math.max(liveRef.current.zoom, 0.78);
      animateViewTo(
        {
          zoom,
          pan: {
            x: width / 2 - (node.x + node.width / 2) * zoom,
            y: height / 2 - (node.y + node.height / 2) * zoom,
          },
        },
        options.duration ?? GRAPH_VIEW_MS,
      );
    },
    [animateViewTo],
  );

  const changeZoom = useCallback(
    (factor: number) => {
      const container = containerRef.current;
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const previous = liveRef.current;
      const zoom = clamp(previous.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const scale = zoom / previous.zoom;
      animateViewTo(
        {
          zoom,
          pan: {
            x: width / 2 - (width / 2 - previous.pan.x) * scale,
            y: height / 2 - (height / 2 - previous.pan.y) * scale,
          },
        },
        BUTTON_ZOOM_MS,
      );
    },
    [animateViewTo],
  );

  useImperativeHandle(ref, () => ({
    zoomIn: () => changeZoom(1.2),
    zoomOut: () => changeZoom(1 / 1.2),
    fit,
    focus,
  }));

  // Замер контейнера: первая раскладка сразу вписывается в экран.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      readContainerBox();
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      setViewport({ width, height });
      if (!initializedRef.current) {
        initializedRef.current = true;
        fit();
      }
    };

    measure();
    const raf = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [fit, readContainerBox]);

  // После загрузки шрифтов размеры карточек меняются — вписываем схему заново,
  // пока пользователь ещё не двигал канвас. Корректировка мгновенная: это не
  // смена состояния, а уточнение раскладки, и лишняя анимация конкурировала бы
  // с секвенцией открытия профессии (сборка → фокус через 1.5 с).
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled && initializedRef.current) fit();
    });
    return () => {
      cancelled = true;
    };
  }, [fit]);

  // Смена режима отображения (ленты ↔ сеть): новая раскладка плавно вписывается.
  // stage перемонтируется (key={mode}), поэтому трансформ возвращаем в layout-
  // эффекте — до кадра, иначе схема мигнёт в масштабе 1.
  useLayoutEffect(() => {
    applyStage();
  }, [applyStage, mode]);

  useEffect(() => {
    if (initializedRef.current) fit({ animate: true });
    // fit меняется вместе с mode — этого достаточно, отдельная зависимость не нужна.
  }, [mode, fit]);

  // Масштаб колесом — вокруг курсора. Значения копятся в кадре, React не
  // участвует: так колесо не вызывает перерисовку узлов.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let wheelFrame = 0;
    let pendingDelta = 0;

    function applyWheel() {
      wheelFrame = 0;
      if (!pendingDelta) return;
      const delta = pendingDelta;
      pendingDelta = 0;
      const containerRect = container!.getBoundingClientRect();
      const cursorX = lastCursor.x - containerRect.left;
      const cursorY = lastCursor.y - containerRect.top;
      const previous = liveRef.current;
      const zoom = clamp(previous.zoom * Math.exp(-delta * 0.0015), MIN_ZOOM, MAX_ZOOM);
      const scale = zoom / previous.zoom;
      const next: ViewState = {
        zoom,
        pan: {
          x: cursorX - (cursorX - previous.pan.x) * scale,
          y: cursorY - (cursorY - previous.pan.y) * scale,
        },
      };
      liveRef.current = next;
      scheduleStage();
      publishZoom(next.zoom);
    }

    const lastCursor = { x: 0, y: 0 };

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      cancelAnimation();
      lastCursor.x = event.clientX;
      lastCursor.y = event.clientY;
      pendingDelta += event.deltaY;
      if (!wheelFrame) wheelFrame = window.requestAnimationFrame(applyWheel);
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (wheelFrame) window.cancelAnimationFrame(wheelFrame);
    };
  }, [cancelAnimation, publishZoom, scheduleStage]);

  // Остановка циклов и таймеров при размонтировании.
  useEffect(() => {
    return () => {
      cancelAnimation();
      if (stageFrameRef.current) window.cancelAnimationFrame(stageFrameRef.current);
      if (magnetFrameRef.current) window.cancelAnimationFrame(magnetFrameRef.current);
      if (publishTimerRef.current) window.clearTimeout(publishTimerRef.current);
    };
  }, [cancelAnimation]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".graph-node")) return;
    cancelAnimation();
    pointerRef.current = { x: event.clientX, y: event.clientY };
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: liveRef.current.pan.x,
      panY: liveRef.current.pan.y,
    };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    // Магнит живёт отдельно от панорамирования: курсор запоминаем всегда,
    // пишем переменные карточек в rAF, не чаще одного кадра.
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (!dragRef.current) scheduleMagnet();

    const drag = dragRef.current;
    if (!drag) return;
    // Пишем трансформ напрямую, без setState: одна запись на кадр.
    liveRef.current = {
      zoom: liveRef.current.zoom,
      pan: {
        x: drag.panX + event.clientX - drag.startX,
        y: drag.panY + event.clientY - drag.startY,
      },
    };
    scheduleStage();
  }

  function endPointer(event: React.PointerEvent<HTMLDivElement>) {
    endPan(event);
    pointerRef.current = null;
    scheduleMagnet();
  }

  function endPan(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const focusId = activeId ?? hoverId;

  const edgeCount = layout.edges.length;
  // Много рёбер — рисование по одному дороже, чем польза: показываем слой целиком.
  const drawEdges = edgeCount > 0 && edgeCount <= EDGE_DRAW_MAX;

  return (
    <div
      ref={containerRef}
      className={`graph${panning ? " is-panning" : ""}`}
      onPointerDown={onPointerDown}
      onPointerEnter={readContainerBox}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={(event) => {
        if (dragRef.current) endPan(event);
        pointerRef.current = null;
        scheduleMagnet();
      }}
      role="application"
      aria-label="Схема компетенций профессии"
      data-viewport={`${viewport.width}x${viewport.height}`}
    >
      <div key={mode} ref={stageRef} className="graph-stage">
        <svg
          className={`graph-edges${edgeCount > 0 && !drawEdges ? " is-fading" : ""}`}
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
        >
          {layout.bands.map((band) => {
            const lines = splitLabel(band.title);
            const lineHeight = 16;
            const firstY = band.labelY - ((lines.length - 1) * lineHeight) / 2;
            return (
              <g key={band.id}>
                <rect
                  className="graph-band"
                  x={band.x}
                  y={band.y}
                  width={band.width}
                  height={band.height}
                  rx={16}
                />
                <text className="graph-band-label" x={band.labelX} y={firstY} dominantBaseline="middle">
                  {lines.map((line, index) => (
                    <tspan key={line + index} x={band.labelX} dy={index === 0 ? 0 : lineHeight}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
          {layout.edges.map((edge, index) => {
            const from = layout.nodes.find((node) => node.id === edge.from);
            const to = layout.nodes.find((node) => node.id === edge.to);
            if (!from || !to) return null;
            const active = focusId === edge.from || focusId === edge.to;
            const dim = matches.size > 0 && !matches.has(edge.from) && !matches.has(edge.to);
            const delay = EDGE_DRAW_BASE_MS + edgeDelay(index, edgeCount);
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                className={`graph-edge${active ? " is-active" : ""}${dim ? " is-dim" : ""}${drawEdges ? " is-drawing" : ""}`}
                d={edgePath(from, to)}
                // pathLength=1 нормализует длину: один dashoffset для всех нитей.
                pathLength={drawEdges ? 1 : undefined}
                style={drawEdges ? { animationDelay: `${delay}ms` } : undefined}
              />
            );
          })}
        </svg>

        {layout.nodes.map((node) => (
          <GraphNodeButton
            key={node.id}
            node={node}
            mode={mode}
            active={activeId === node.id}
            hovered={hoverId === node.id}
            matched={matches.has(node.id)}
            dimmed={matches.size > 0 && !matches.has(node.id)}
            enter={enterStyles.get(node.id) ?? { x: 0, y: 0, delay: 0 }}
            onHover={onHover}
            onSelect={onSelect}
            register={registerNode}
          />
        ))}
      </div>
    </div>
  );
});

// memo по пропсам: ре-рендеры родителя (например, проценты масштаба в тулбаре
// или смена выбранной компетенции) не перерисовывают схему почём зря.
export const CompetencyGraph = memo(CompetencyGraphInner);
CompetencyGraph.displayName = "CompetencyGraph";
