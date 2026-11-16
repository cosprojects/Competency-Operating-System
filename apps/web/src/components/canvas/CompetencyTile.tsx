"use client";

import { memo } from "react";
import type { CanvasCompetency } from "@/components/canvas/types";
import { competencyMeta } from "@/lib/content";

export const TIER_LABEL: Record<CanvasCompetency["tier"], string> = {
  foundation: "Фундаментальная",
  core: "Основная",
  optional: "Необязательная",
};

interface CompetencyTileProps {
  competency: CanvasCompetency;
  order: number;
  active: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  register: (id: string, element: HTMLButtonElement | null) => void;
}

/**
 * Карточка компетенции в левом рейле вынесена в memo: при наведении и выборе
 * меняются только две карточки из десятков, остальные не перерисовываются.
 * Рефы пишутся через стабильную функцию — иначе memo не сработал бы.
 */
export const CompetencyTile = memo(function CompetencyTile({
  competency,
  order,
  active,
  hovered,
  onSelect,
  onHover,
  register,
}: CompetencyTileProps) {
  return (
    <button
      type="button"
      ref={(element) => register(competency.id, element)}
      className={`competency-tile${active ? " is-active" : ""}${hovered && !active ? " is-hover" : ""}`}
      onClick={() => onSelect(competency.id)}
      onMouseEnter={() => onHover(competency.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(competency.id)}
      onBlur={() => onHover(null)}
    >
      <span className="tile-head">
        <span className={`badge ${competency.tier}`}>{TIER_LABEL[competency.tier]}</span>
        <span className="num-badge">{order}</span>
      </span>
      <h4>{competency.title}</h4>
      <p>{competency.definition}</p>
      <span className="tile-meta">{competencyMeta(competency)}</span>
    </button>
  );
});
