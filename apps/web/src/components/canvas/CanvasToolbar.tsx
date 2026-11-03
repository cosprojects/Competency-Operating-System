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
        >
          <IconViewBoard />
          <span className="sr-only">Ленты по разделам</span>
          <span className="view-switch-tooltip" aria-hidden="true">
            Ленты по разделам: компетенции идут по темам
          </span>
        </button>
        <button
          className={`view-switch-button${view === "network" ? " is-active" : ""}`}
          type="button"
          onClick={() => onViewChange("network")}
          aria-pressed={view === "network"}
        >
          <IconViewNetwork />
          <span className="sr-only">Сеть связей</span>
          <span className="view-switch-tooltip" aria-hidden="true">
            Сеть связей: видно, что изучать до и после
          </span>
        </button>
      </div>
    </div>
  );
}
