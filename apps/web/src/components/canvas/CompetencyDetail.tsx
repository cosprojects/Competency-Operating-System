"use client";

import Link from "next/link";
import {
  IconArrowSquareLeft,
  IconArrowSquareRight,
  IconCloseCircle,
  IconStar,
} from "@/components/icons";
import { MaterialCard } from "@/components/canvas/MaterialCard";
import { SaveButton } from "@/components/SaveButton";
import { groupSources } from "@/lib/content";
import type { ContentItem } from "@/lib/content-types";
import type {
  CanvasCompetency,
  CanvasProfession,
  CanvasViewer,
  CompetencyState,
} from "./types";

const TIER_LABEL: Record<CanvasCompetency["tier"], string> = {
  foundation: "Фундаментальная",
  core: "Основная",
  optional: "Необязательная",
};

function DetailBlock({
  title,
  count,
  hint,
  surface = "plain",
  children,
}: {
  title: string;
  count: number;
  hint: string;
  surface?: "plain" | "sunken";
  children: React.ReactNode;
}) {
  return (
    <section className={`detail-block${surface === "sunken" ? " is-sunken" : ""}`}>
      <div className="detail-block-head">
        <h3>{title}</h3>
        <span className="num-badge">{count}</span>
      </div>
      <p className="detail-hint">{hint}</p>
      {children}
    </section>
  );
}

function ItemRows({ items }: { items: ContentItem[] }) {
  return (
    <div className="detail-rows">
      {items.map((item) => (
        <article className="detail-row" key={item.id}>
          <h4>{item.title}</h4>
          {item.definition ? <p>{item.definition}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function CompetencyDetail({
  profession,
  competency,
  state,
  viewer,
  expanded,
  onToggleExpanded,
  onClose,
}: {
  profession: CanvasProfession;
  competency: CanvasCompetency;
  state: CompetencyState;
  viewer: CanvasViewer | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
}) {
  const returnTo = `/professions/${profession.slug}?competency=${competency.id}`;
  const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  // Материалы — основная причина создать аккаунт: ведём в регистрацию, а не в вход.
  const gateHref = `/register?returnTo=${encodeURIComponent(returnTo)}`;
  // Как в макете: профессия + две темы компетенции (без названия раздела).
  const shorten = (value: string) => (value.length > 24 ? `${value.slice(0, 23).trimEnd()}…` : value);
  const tags = [profession.title, ...competency.knowledge.slice(0, 2).map((item) => shorten(item.title))];
  const materialGroups = groupSources(competency.sources);

  return (
    <aside
      className={`detail-rail${expanded ? " is-expanded" : ""}`}
      aria-label={`Компетенция: ${competency.title}`}
    >
      <header className="detail-head">
        <div className="detail-head-row">
          <button
            className="icon-button detail-expand"
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            aria-label={expanded ? "Свернуть панель" : "Развернуть панель на всю ширину"}
            title={expanded ? "Свернуть панель" : "Развернуть панель на всю ширину"}
          >
            {expanded ? <IconArrowSquareRight /> : <IconArrowSquareLeft />}
          </button>

          <span className={`badge ${competency.tier}`}>{TIER_LABEL[competency.tier]}</span>

          <div className="detail-head-actions">
            {viewer ? (
              <SaveButton
                variant="icon"
                targetType="COMPETENCY"
                targetId={competency.id}
                initialSaved={state.saved}
                contextProfession={profession.slug}
              />
            ) : (
              <Link
                className="icon-button"
                href={loginHref}
                aria-label="Войти, чтобы сохранить компетенцию"
                title="Войти, чтобы сохранить компетенцию"
              >
                <IconStar />
              </Link>
            )}
            <button className="icon-button detail-close" type="button" onClick={onClose} aria-label="Закрыть компетенцию">
              <IconCloseCircle />
            </button>
          </div>
        </div>

        <h2>{competency.title}</h2>
        <p className="detail-desc">{competency.definition}</p>
        <div className="detail-tags">
          {tags.map((tag) => (
            <span className="pill" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </header>

      <DetailBlock
        title="Что нужно знать"
        count={competency.knowledge.length}
        hint="Понятия и темы, на которые опирается компетенция."
      >
        {competency.knowledge.length === 0 ? (
          <div className="notice">Состав знаний ещё уточняется.</div>
        ) : (
          <ItemRows items={competency.knowledge} />
        )}
      </DetailBlock>

      <DetailBlock
        title="Что нужно уметь"
        count={competency.skills.length}
        hint="Наблюдаемые действия и практические навыки."
      >
        {competency.skills.length === 0 ? (
          <div className="notice">Состав навыков ещё уточняется.</div>
        ) : (
          <ItemRows items={competency.skills} />
        )}
      </DetailBlock>

      <DetailBlock
        title="Материалы"
        count={competency.sources.length}
        surface="sunken"
        hint="Курсы, статьи и другие источники. Ссылки открываются после входа; это позволяет сохранять материалы и возвращаться к ним."
      >
        {competency.sources.length === 0 ? (
          <div className="notice">Для этой компетенции пока нет опубликованного материала.</div>
        ) : (
          <>
            {viewer ? null : (
              <Link className="button secondary block materials-login" href={gateHref}>
                Войти и открыть учебные материалы
              </Link>
            )}
            <div className="material-groups">
              {materialGroups.map((group) => (
              <section className="material-group" key={group.id}>
                <header className="material-group-head">
                  <h4>{group.title}</h4>
                  <span className="num-badge">{group.sources.length}</span>
                </header>
                <div className="material-grid">
                  {group.sources.map((source) => (
                    <MaterialCard
                      key={source.id}
                      source={source}
                      competencyId={competency.id}
                      competencyTitle={competency.title}
                      canOpen={Boolean(viewer)}
                      canReview={Boolean(viewer)}
                      canSave={Boolean(viewer)}
                      returnTo={returnTo}
                    />
                  ))}
                </div>
              </section>
              ))}
            </div>
          </>
        )}
      </DetailBlock>

      <DetailBlock
        title="В профессии"
        count={competency.occurrences.length}
        hint="Компетенция может входить в несколько направлений."
      >
        <div className="occurrence-list">
          {competency.occurrences.map((occurrence) => (
            <Link
              className="occurrence-row"
              key={`${occurrence.professionSlug}-${occurrence.sectionTitle}`}
              href={`/professions/${occurrence.professionSlug}?competency=${competency.id}`}
            >
              <span className="occurrence-text">
                <strong>{occurrence.professionTitle}</strong>
                <span>{occurrence.sectionTitle}</span>
              </span>
              <IconArrowSquareRight className="occurrence-icon" />
            </Link>
          ))}
        </div>
      </DetailBlock>
    </aside>
  );
}
