"use client";

import { IconAddSquare, IconMinusSquare, IconViewBoard, IconViewNetwork } from "@/components/icons";
import type { GraphMode } from "@/lib/graph-layout";

/** Нижний тулбар канваса: масштаб и переключение отображения схемы. */
export function CanvasToolbar({
  zoomPercent,
  view,
  onViewChange,
  onZoomIn,
  onZoomOut,
}: {
  zoomPercent: number;
  view: GraphMode;
  onViewChange: (mode: GraphMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="canvas-toolbar">
      <div className="zoom-controls" role="group" aria-label="Масштаб схемы">
        <button className="zoom-button" type="button" onClick={onZoomIn} aria-label="Приблизить">
          <IconAddSquare />
        </button>
        <span className="zoom-value">{zoomPercent}%</span>
        <button className="zoom-button" type="button" onClick={onZoomOut} aria-label="Отдалить">
          <IconMinusSquare />
        </button>
      </div>

      <div className="view-switch" role="group" aria-label="Отображение схемы">
        <button
          className={`view-switch-button${view === "board" ? " is-active" : ""}`}
          type="button"
          onClick={() => onViewChange("board")}
          aria-pressed={view === "board"}
          title="Лентами по разделам"
        >
          <IconViewBoard />
          <span className="sr-only">Лентами по разделам</span>
        </button>
        <button
          className={`view-switch-button${view === "network" ? " is-active" : ""}`}
          type="button"
          onClick={() => onViewChange("network")}
          aria-pressed={view === "network"}
          title="Сетью связей"
        >
          <IconViewNetwork />
          <span className="sr-only">Сетью связей</span>
        </button>
      </div>
    </div>
  );
}
