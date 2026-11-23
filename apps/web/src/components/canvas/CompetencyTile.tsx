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
  /** Чистый адрес страницы компетенции: карточка — настоящая ссылка. */
  href: string;
  order: number;
  active: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  register: (id: string, element: HTMLAnchorElement | null) => void;
}

/**
 * Карточка компетенции в левом рейле вынесена в memo: при наведении и выборе
 * меняются только две карточки из десятков, остальные не перерисовываются.
 * Рефы пишутся через стабильную функцию — иначе memo не сработал бы.
 *
 * Это ссылка, а не кнопка: у каждой компетенции есть свой адрес, и краулер
 * должен проходить по карте профессии, а не упираться в `onClick`. Обычный
 * клик перехватываем (панель открывается без перезагрузки), Cmd/Ctrl/Shift —
 * отдаём браузеру: новая вкладка и копирование адреса работают как обычно.
 */
export const CompetencyTile = memo(function CompetencyTile({
  competency,
  href,
  order,
  active,
  hovered,
  onSelect,
  onHover,
  register,
}: CompetencyTileProps) {
  return (
    <a
      ref={(element) => register(competency.id, element)}
      className={`competency-tile${active ? " is-active" : ""}${hovered && !active ? " is-hover" : ""}`}
      href={href}
      draggable={false}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onSelect(competency.id);
      }}
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
    </a>
  );
});
