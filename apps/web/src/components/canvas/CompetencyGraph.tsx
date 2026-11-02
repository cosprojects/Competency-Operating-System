"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  edgePath,
  layoutCompetencyGraph,
  type GraphMode,
  type GraphNode,
  type GraphNodeInput,
} from "@/lib/graph-layout";
import { tierLabel } from "@/lib/content";
import { countLabel } from "@/lib/content";

const MIN_ZOOM = 0.18;
const MAX_ZOOM = 1.8;

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

export interface GraphHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  focus: (id: string) => void;
}

interface ViewState {
  zoom: number;
  pan: { x: number; y: number };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const CompetencyGraph = forwardRef<
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
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const initializedRef = useRef(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<ViewState>({ zoom: 0.5, pan: { x: 0, y: 0 } });
  const [panning, setPanning] = useState(false);

  const layout = useMemo(() => layoutCompetencyGraph(nodes, mode), [nodes, mode]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const viewRef = useRef(view);
  viewRef.current = view;

  const fit = useCallback(() => {
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
    setView({
      zoom,
      pan: {
        x: scaledWidth <= width - 60 ? (width - scaledWidth) / 2 : 24,
        y: scaledHeight <= height - 140 ? (height - scaledHeight) / 2 + 12 : 64,
      },
    });
  }, [mode]);

  const focus = useCallback((id: string) => {
    const container = containerRef.current;
    const current = layoutRef.current;
    if (!container) return;
    const node = current.nodes.find((candidate) => candidate.id === id);
    if (!node) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const zoom = Math.max(viewRef.current.zoom, 0.78);
    setView({
      zoom,
      pan: {
        x: width / 2 - (node.x + node.width / 2) * zoom,
        y: height / 2 - (node.y + node.height / 2) * zoom,
      },
    });
  }, []);

  const changeZoom = useCallback((factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    setView((previous) => {
      const zoom = clamp(previous.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const scale = zoom / previous.zoom;
      return {
        zoom,
        pan: {
          x: width / 2 - (width / 2 - previous.pan.x) * scale,
          y: height / 2 - (height / 2 - previous.pan.y) * scale,
        },
      };
    });
  }, []);

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
  }, [fit]);

  // После загрузки шрифтов размеры карточек меняются — вписываем схему заново,
  // пока пользователь ещё не двигал канвас.
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

  useEffect(() => {
    onZoomChange(Math.round(view.zoom * 100));
  }, [view.zoom, onZoomChange]);

  // Смена режима отображения (ленты ↔ сеть) вписывает новую раскладку в экран.
  useEffect(() => {
    if (initializedRef.current) fit();
  }, [mode, fit]);

  // Масштаб колесом — вокруг курсора.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = container!.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      setView((previous) => {
        const zoom = clamp(previous.zoom * Math.exp(-event.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
        const scale = zoom / previous.zoom;
        return {
          zoom,
          pan: {
            x: cursorX - (cursorX - previous.pan.x) * scale,
            y: cursorY - (cursorY - previous.pan.y) * scale,
          },
        };
      });
    }
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".graph-node")) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: view.pan.x,
      panY: view.pan.y,
    };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    setView((previous) => ({
      ...previous,
      pan: {
        x: drag.panX + event.clientX - drag.startX,
        y: drag.panY + event.clientY - drag.startY,
      },
    }));
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

  return (
    <div
      ref={containerRef}
      className={`graph${panning ? " is-panning" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onPointerLeave={(event) => {
        if (dragRef.current) endPan(event);
      }}
      role="application"
      aria-label="Схема компетенций профессии"
      data-viewport={`${viewport.width}x${viewport.height}`}
    >
      <div
        key={mode}
        className="graph-stage"
        style={{ transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})` }}
      >
        <svg
          className="graph-edges"
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
          {layout.edges.map((edge) => {
            const from = layout.nodes.find((node) => node.id === edge.from);
            const to = layout.nodes.find((node) => node.id === edge.to);
            if (!from || !to) return null;
            const active = focusId === edge.from || focusId === edge.to;
            const dim = matches.size > 0 && !matches.has(edge.from) && !matches.has(edge.to);
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                className={`graph-edge${active ? " is-active" : ""}${dim ? " is-dim" : ""}`}
                d={edgePath(from, to)}
              />
            );
          })}
        </svg>

        {layout.nodes.map((node) => {
          const active = activeId === node.id;
          const hovered = hoverId === node.id;
          const matched = matches.has(node.id);
          const dimmed = matches.size > 0 && !matched;
          return (
            <button
              key={node.id}
              type="button"
              className={`graph-node tier-${node.tier}${mode === "network" ? " is-network" : ""}${active ? " is-active" : ""}${hovered ? " is-hover" : ""}${matched ? " is-match" : ""}${dimmed ? " is-dim" : ""}`}
              style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
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
        })}
      </div>
    </div>
  );
});
