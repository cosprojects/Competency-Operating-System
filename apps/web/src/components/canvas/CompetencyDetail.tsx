"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowSquareRight,
  IconCheckCircle,
  IconCloseCircle,
} from "@/components/icons";
import {
  IconLinearSquareCloseSidebar,
  IconLinearSquareOpenSidebar,
} from "@/components/icons-library";
import { KnowledgeSheet, type KnowledgeItem } from "@/components/canvas/KnowledgeSheet";
import { MaterialCard } from "@/components/canvas/MaterialCard";
import { StudyButton } from "@/components/canvas/StudyButton";
import { groupSources } from "@/lib/content";
import type { ContentItem } from "@/lib/content-types";
import type {
  CanvasCompetency,
  CanvasProfession,
  CanvasViewer,
  CompetencyState,
  ItemStates,
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

/** Карточка знания/навыка: «Усвоить» открывает разбор (COS-EAR-017). */
function StudyItemCard({
  item,
  kind,
  learned,
  canStudy,
  onOpen,
}: {
  item: ContentItem;
  kind: "KNOWLEDGE" | "SKILL";
  learned: boolean;
  canStudy: boolean;
  onOpen: () => void;
}) {
  return (
    <article
      className={`study-item${learned ? " is-learned" : ""}${canStudy ? " is-clickable" : ""}`}
      onClick={canStudy ? onOpen : undefined}
      onKeyDown={
        canStudy
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      role={canStudy ? "button" : undefined}
      tabIndex={canStudy ? 0 : undefined}
      aria-label={canStudy ? `Открыть разбор: ${item.title}` : undefined}
    >
      <div className="study-item-head">
        <h4>{item.title}</h4>
        {canStudy ? (
          <button
            className={`study-item-action${learned ? " is-learned" : ""}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            aria-label={`${learned ? "Открыть и снять отметку" : "Усвоить"}: ${item.title}`}
          >
            {learned ? <IconCheckCircle /> : null}
            <span>{learned ? "Усвоено" : "Усвоить"}</span>
          </button>
        ) : null}
      </div>
      {item.definition ? <p>{item.definition}</p> : null}
      <span className="study-item-kind">{kind === "SKILL" ? "навык" : "знание"}</span>
    </article>
  );
}

export function CompetencyDetail({
  profession,
  competency,
  state,
  itemStates,
  viewer,
  expanded,
  onToggleExpanded,
  onClose,
}: {
  profession: CanvasProfession;
  competency: CanvasCompetency;
  state: CompetencyState;
  itemStates: ItemStates;
  viewer: CanvasViewer | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
}) {
  const returnTo = `/professions/${profession.slug}/${competency.id}`;
  const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  const gateHref = `/register?returnTo=${encodeURIComponent(returnTo)}`;
  const tags = [profession.title, ...competency.knowledge.slice(0, 2).map((item) => item.title)];
  const materialGroups = groupSources(competency.sources);

  const studyItems = useMemo<KnowledgeItem[]>(
    () => [
      ...competency.knowledge.map((item) => ({ id: item.id, title: item.title, definition: item.definition, kind: "KNOWLEDGE" as const })),
      ...competency.skills.map((item) => ({ id: item.id, title: item.title, definition: item.definition, kind: "SKILL" as const })),
    ],
    [competency.knowledge, competency.skills],
  );

  const [learnedIds, setLearnedIds] = useState<Set<string>>(
    () => new Set(studyItems.filter((item) => itemStates[item.id] === "LEARNED").map((item) => item.id)),
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const headRef = useRef<HTMLElement | null>(null);

  // Шапка компетенции сжимается непрерывно по скроллу: без дискретных
  // состояний, высота плавно следует за прокруткой.
  //
  // Меряем содержимое один раз (и после загрузки шрифтов/ресайза), а на скролле
  // читаем только scrollTop: чтение scrollHeight в каждом кадре заставляло
  // браузер синхронно пересчитывать раскладку. Прогресс пишем шагом 2 %.
  useEffect(() => {
    const rail = headRef.current?.closest(".detail-rail");
    const head = headRef.current;
    if (!rail || !head) return;
    const desc = head.querySelector<HTMLElement>(".detail-desc");
    const tags = head.querySelector<HTMLElement>(".detail-tags");
    const progressEl = head.querySelector<HTMLElement>(".study-progress");

    const measure = () => {
      if (desc) head.style.setProperty("--desc-h", `${desc.scrollHeight}px`);
      if (tags) head.style.setProperty("--tags-h", `${tags.scrollHeight}px`);
      if (progressEl) head.style.setProperty("--progress-h", `${progressEl.scrollHeight}px`);
    };

    let frame = 0;
    let lastProgress = -1;
    const update = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, rail.scrollTop / 200));
      const rounded = Math.round(progress * 50) / 50;
      if (rounded === lastProgress) return;
      lastProgress = rounded;
      head.style.setProperty("--head-collapse", String(rounded));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const remeasure = () => {
      measure();
      lastProgress = -1;
      update();
    };

    remeasure();
    rail.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) remeasure();
    });
    return () => {
      cancelled = true;
      rail.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const learnedCount = learnedIds.size;
  const learnedPercent = studyItems.length > 0 ? Math.round((learnedCount / studyItems.length) * 100) : 0;
  const materialCounts = materialGroups.map((group) => ({ id: group.id, title: group.title, count: group.sources.length }));

  function markLearned(itemId: string, learned: boolean) {
    setLearnedIds((current) => {
      const next = new Set(current);
      if (learned) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  return (
    <aside
      className={`detail-rail${expanded ? " is-expanded" : ""}`}
      aria-label={`Компетенция: ${competency.title}`}
    >
      <header className="detail-head" ref={headRef}>
        <div className="detail-head-row">
          <button
            className="icon-button detail-expand"
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            aria-label={expanded ? "Свернуть панель" : "Развернуть панель на всю ширину"}
            title={expanded ? "Свернуть панель" : "Развернуть панель на всю ширину"}
          >
            {expanded ? <IconLinearSquareCloseSidebar /> : <IconLinearSquareOpenSidebar />}
          </button>

          <span className={`badge ${competency.tier}`}>{TIER_LABEL[competency.tier]}</span>

          <div className="detail-head-actions">
            <StudyButton
              competencyId={competency.id}
              professionSlug={profession.slug}
              initialSaved={state.saved}
              isAuthed={Boolean(viewer)}
            />
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
        {viewer ? (
          <div className="study-progress">
            <div
              className="learning-segments"
              role="img"
              aria-label={`Освоено ${learnedCount} из ${studyItems.length} знаний и навыков`}
            >
              {studyItems.map((item) => (
                <span
                  key={item.id}
                  className={`learning-segment${learnedIds.has(item.id) ? " is-filled" : ""}`}
                />
              ))}
            </div>
            <div className="study-progress-text">
              <span>Прогресс изучения</span>
              <span>{learnedPercent}%</span>
            </div>
          </div>
        ) : null}
      </header>

      <DetailBlock
        title="Что нужно знать"
        count={competency.knowledge.length}
        hint="Понятия и темы, на которые опирается компетенция."
      >
        {competency.knowledge.length === 0 ? (
          <div className="notice">Состав знаний ещё уточняется.</div>
        ) : (
          <div className="study-items">
            {competency.knowledge.map((item, index) => (
              <StudyItemCard
                key={item.id}
                item={item}
                kind="KNOWLEDGE"
                learned={learnedIds.has(item.id)}
                canStudy={Boolean(viewer)}
                onOpen={() => setOpenIndex(index)}
              />
            ))}
          </div>
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
          <div className="study-items">
            {competency.skills.map((item, index) => (
              <StudyItemCard
                key={item.id}
                item={item}
                kind="SKILL"
                learned={learnedIds.has(item.id)}
                canStudy={Boolean(viewer)}
                onOpen={() => setOpenIndex(competency.knowledge.length + index)}
              />
            ))}
          </div>
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
        ) : viewer ? (
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
                      canOpen
                      canReview
                      canSave
                      returnTo={returnTo}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="material-summary">
            <div className="material-summary-chips">
              {materialCounts.map((group) => (
                <span className="material-summary-chip" key={group.id}>
                  {group.title}
                  <b>{group.count}</b>
                </span>
              ))}
            </div>
            <Link className="button secondary block materials-login" href={gateHref}>
              Войти и открыть учебные материалы
            </Link>
          </div>
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
              href={`/professions/${occurrence.professionSlug}/${competency.id}`}
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

      {openIndex !== null && viewer ? (
        <KnowledgeSheet
          competencyId={competency.id}
          competencyTitle={competency.title}
          items={studyItems}
          index={openIndex}
          learnedIds={learnedIds}
          onNavigate={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          onLearnedChange={markLearned}
        />
      ) : null}
    </aside>
  );
}
