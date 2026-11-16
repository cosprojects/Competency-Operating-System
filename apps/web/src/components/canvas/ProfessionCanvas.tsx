"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { CompetencyDetail } from "@/components/canvas/CompetencyDetail";
import { CompetencyTile } from "@/components/canvas/CompetencyTile";
import { CompetencyGraph, type GraphHandle } from "@/components/canvas/CompetencyGraph";
import type {
  CanvasCompetency,
  CanvasProfession,
  CompetencyStates,
  CanvasViewer,
} from "@/components/canvas/types";
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger";
import { IconArrowLeft, IconArrowRight, IconCloseSquare, IconStar } from "@/components/icons";
import { SaveButton } from "@/components/SaveButton";
import { competencyMatches, countLabel, normalizeQuery, pluralWord } from "@/lib/content";
import { trackClient } from "@/lib/client-analytics";
import { REDUCED_MOTION_QUERY } from "@/lib/motion/tokens";
import { sphereBadgeStyle } from "@/lib/spheres";
import type { GraphMode, GraphNodeInput } from "@/lib/graph-layout";

/** Порядок открытия профессии: рейл и схема успевают появиться, и только
 *  затем (через 1.5 с после первого кадра) схема фокусируется на первой
 *  компетенции и выезжает правая панель. */
const AUTO_OPEN_DELAY_MS = 1500;

/**
 * Задержка автопоказа отсчитывается от первого кадра, а не от гидрации:
 * иначе на медленном соединении пауза после видимого появления схемы
 * растягивалась бы на время загрузки JS.
 */
function autoOpenDelay(): number {
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return 0;
  const paint = performance
    .getEntriesByType("paint")
    .find((entry) => entry.name === "first-contentful-paint");
  const anchor = paint?.startTime ?? performance.now();
  const remaining = anchor + AUTO_OPEN_DELAY_MS - performance.now();
  return Math.max(0, Math.min(AUTO_OPEN_DELAY_MS, remaining));
}

export function ProfessionCanvas({
  profession,
  competencies,
  states,
  viewer,
  professionSaved,
  initialCompetencyId,
  initialView = "board",
  prevProfession,
  nextProfession,
}: {
  profession: CanvasProfession;
  competencies: CanvasCompetency[];
  states: CompetencyStates;
  viewer: CanvasViewer | null;
  professionSaved: boolean;
  initialCompetencyId?: string;
  initialView?: GraphMode;
  prevProfession?: { slug: string; title: string } | null;
  nextProfession?: { slug: string; title: string } | null;
}) {
  const byId = useMemo(() => new Map(competencies.map((item) => [item.id, item])), [competencies]);
  // Сквозная нумерация по профессии: 1..N в порядке разделов и приоритезации
  // внутри раздела. Не зависит от «родного» order компетенции в реестре.
  const displayOrder = useMemo(() => {
    const map = new Map<string, number>();
    competencies.forEach((item, index) => map.set(item.id, index + 1));
    return map;
  }, [competencies]);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCompetencyId && byId.has(initialCompetencyId) ? initialCompetencyId : null,
  );
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [zoomPercent, setZoomPercent] = useState(45);
  const [view, setView] = useState<GraphMode>(initialView);
  const [expanded, setExpanded] = useState(false);

  const graphRef = useRef<GraphHandle>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());

  // Стабильные колбэки обязательны: memo-карточки и memo-схема перерисовываются
  // только когда меняются их собственные пропсы, а не каждый рендер канваса.
  const registerTile = useCallback((id: string, element: HTMLButtonElement | null) => {
    if (element) tileRefs.current.set(id, element);
    else tileRefs.current.delete(id);
  }, []);
  const hoverCompetency = useCallback((id: string | null) => setHoverId(id), []);

  const graphNodes: GraphNodeInput[] = useMemo(
    () =>
      competencies.map((item) => ({
        id: item.id,
        title: item.title,
        tier: item.tier,
        order: displayOrder.get(item.id) ?? item.order,
        sectionId: item.sectionId,
        sectionTitle: item.sectionTitle,
        definition: item.definition,
        knowledge: item.knowledge.length,
        skills: item.skills.length,
        sources: item.sources.length,
        prerequisites: item.prerequisites,
      })),
    [competencies, displayOrder],
  );

  const matches = useMemo(() => {
    const normalized = normalizeQuery(query);
    if (!normalized) return new Set<string>();
    return new Set(
      competencies.filter((item) => competencyMatches(item, normalized)).map((item) => item.id),
    );
  }, [query, competencies]);

  const firstMatch = matches.size > 0 ? competencies.find((item) => matches.has(item.id)) : undefined;

  const scrollTileIntoView = useCallback((id: string) => {
    const tile = tileRefs.current.get(id);
    if (tile) tile.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, []);

  const select = useCallback(
    (id: string, options: { scroll?: boolean; focusGraph?: boolean } = {}) => {
      autoOpenDoneRef.current = true;
      if (autoOpenTimerRef.current) window.clearTimeout(autoOpenTimerRef.current);
      autoOpenTimerRef.current = 0;
      setSelectedId(id);
      trackClient("competency_view", {
        profession_id: profession.id,
        competency_id: id,
      });
      if (options.scroll) scrollTileIntoView(id);
      if (options.focusGraph) graphRef.current?.focus(id);
      // На узких экранах сайдбар компетенции идёт ниже канваса — подводим к нему.
      if (window.matchMedia("(max-width: 1080px)").matches) {
        window.requestAnimationFrame(() => {
          document.querySelector(".detail-rail")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      // Ссылку на открытую компетенцию можно скопировать и переслать.
      const url = new URL(window.location.href);
      url.searchParams.set("competency", id);
      window.history.replaceState(null, "", url);
    },
    [profession.id, scrollTileIntoView],
  );

  const selectFromGraph = useCallback((id: string) => select(id, { scroll: true }), [select]);
  const selectFromTile = useCallback((id: string) => select(id, { focusGraph: true }), [select]);

  const closeDetail = useCallback(() => {
    autoOpenDoneRef.current = true;
    if (autoOpenTimerRef.current) window.clearTimeout(autoOpenTimerRef.current);
    autoOpenTimerRef.current = 0;
    setSelectedId(null);
    setExpanded(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("competency");
    window.history.replaceState(null, "", url);
  }, []);

  const changeView = useCallback((next: GraphMode) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "board") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setExpanded((current) => {
        if (current) return false;
        setSelectedId(null);
        return false;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  /**
   * Секвенция открытия профессии: сначала появляется левый рейл и собирается
   * схема (свои анимации), и только через 1.5 с схема фокусируется на первой
   * компетенции, одновременно выезжает правая панель. Пока таймер идёт, панель
   * закрыта — иначе канвас успел бы сузиться до того, как схема появилась.
   *
   * Повторный запуск защищён флагом, который выставляется в момент открытия:
   * так двойной mount в StrictMode не теряет таймер, а клик пользователя до
   * истечения задержки отменяет автопоказ.
   */
  const autoOpenDoneRef = useRef(false);
  const autoOpenTimerRef = useRef(0);
  useEffect(() => {
    if (autoOpenDoneRef.current) return;
    if (initialCompetencyId) return;
    // На мобильных первая компетенция не открывает шторку сама — только по тапу.
    if (window.matchMedia("(max-width: 760px)").matches) return;
    const firstId = profession.sections
      .flatMap((section) => section.competencyIds)
      .find((id) => byId.has(id));
    if (!firstId) return;

    // При reduced motion смотреть нечего — открываем сразу, без паузы.
    const delay = autoOpenDelay();

    autoOpenTimerRef.current = window.setTimeout(() => {
      autoOpenTimerRef.current = 0;
      if (autoOpenDoneRef.current) return;
      autoOpenDoneRef.current = true;
      setSelectedId(firstId);
      // Фокус — после коммита и первой раскладки: панель уже сузила канвас,
      // поэтому целевая точка считается по новой ширине контейнера.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          graphRef.current?.focus(firstId);
          scrollTileIntoView(firstId);
        });
      });
    }, delay);

    return () => {
      if (autoOpenTimerRef.current) window.clearTimeout(autoOpenTimerRef.current);
      autoOpenTimerRef.current = 0;
    };
  }, [byId, initialCompetencyId, profession.sections, scrollTileIntoView]);

  // Открытая по ссылке компетенция центрируется в схеме после первого замера канваса.
  useEffect(() => {
    if (!initialCompetencyId || !byId.has(initialCompetencyId)) return;
    const timer = window.setTimeout(() => {
      graphRef.current?.focus(initialCompetencyId);
      scrollTileIntoView(initialCompetencyId);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [initialCompetencyId, byId, scrollTileIntoView]);

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const selectedState = selectedId ? states[selectedId] : undefined;

  return (
    <div className={`canvas-screen${selected ? " has-detail" : ""}${expanded ? " is-expanded" : ""}`}>
      {selected ? <div className="sheet-backdrop" role="presentation" onClick={closeDetail} /> : null}
      <div className="canvas-rail">
        <div className="rail-pinned">
          {/* Навигация по профессиям внутри сферы (макет 247-34832). */}
          <div className="rail-nav-row">
            {prevProfession ? (
              <Link
                className="rail-nav-btn"
                href={`/professions/${prevProfession.slug}`}
                aria-label={`Предыдущая профессия: ${prevProfession.title}`}
                title={prevProfession.title}
              >
                <IconArrowLeft />
              </Link>
            ) : (
              <span className="rail-nav-btn is-disabled" aria-hidden="true">
                <IconArrowLeft />
              </span>
            )}
            <Link className="rail-choose" href="/professions">
              Выбрать направление
            </Link>
            {nextProfession ? (
              <Link
                className="rail-nav-btn"
                href={`/professions/${nextProfession.slug}`}
                aria-label={`Следующая профессия: ${nextProfession.title}`}
                title={nextProfession.title}
              >
                <IconArrowRight />
              </Link>
            ) : (
              <span className="rail-nav-btn is-disabled" aria-hidden="true">
                <IconArrowRight />
              </span>
            )}
          </div>

          <section className="profession-summary" data-enter="1">
          <div className="summary-top">
            <span className="badge" style={sphereBadgeStyle(profession.sphere.color)}>
              {profession.sphere.title}
            </span>
            <span className="summary-count">
              {profession.published} из {profession.total}{" "}
              {pluralWord(profession.total, ["компетенции", "компетенций", "компетенций"])}
            </span>
            {viewer ? (
              <SaveButton
                variant="icon"
                targetType="PROFESSION"
                targetId={profession.slug}
                initialSaved={professionSaved}
                title={profession.title}
                description={profession.description}
              />
            ) : (
              <Link
                className="icon-button summary-star"
                href={`/login?returnTo=${encodeURIComponent(`/professions/${profession.slug}`)}`}
                aria-label="Войти, чтобы сохранить профессию"
                title="Войти, чтобы сохранить профессию"
              >
                <IconStar />
              </Link>
            )}
          </div>
          <h1 className="summary-title">{profession.title}</h1>
          <p className="summary-desc">{profession.description}</p>
          <div className="coverage">
            <div className="coverage-bar" aria-hidden="true">
              <span style={{ width: `${profession.percent}%` }} />
            </div>
            <div className="coverage-text">
              <span>Покрытие Beta</span>
              <span>{profession.percent}%</span>
            </div>
          </div>
        </section>

        </div>

        <div className="rail-scroll">
          <div className="section-list">
          {profession.sections.map((section, index) => (
            <section
              className="section-panel"
              key={section.id}
              data-enter={String(Math.min(index + 2, 3))}
            >
              <h3>{section.title}</h3>
              <p className="section-count">
                {countLabel(section.competencyIds.length, ["компетенция", "компетенции", "компетенций"])}
              </p>
              <div className={`competency-track${section.competencyIds.length > 1 ? " has-many" : ""}`}>
                {section.competencyIds.map((id) => {
                  const competency = byId.get(id);
                  if (!competency) return null;
                  return (
                    <CompetencyTile
                      key={id}
                      competency={competency}
                      order={displayOrder.get(id) ?? competency.order}
                      active={selectedId === id}
                      hovered={hoverId === id}
                      onSelect={selectFromTile}
                      onHover={hoverCompetency}
                      register={registerTile}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

          <div className="sidebar-notice">
            В Beta опубликованы не проверенные компетенции и материалы. Помогите проверить добавленные и вместе
            мы сделаем сервис полезнее! Если вы не нашли нужную компетенцию, навык или знание —{" "}
            <FeedbackTrigger
              options={{ context: "competency", type: "MISSING_COMPETENCY", targetType: "COMPETENCY", targetId: selectedId ?? undefined }}
            >
              сообщите о пробеле!
            </FeedbackTrigger>
          </div>
        </div>
      </div>

      <div className="canvas-center">
        <form
          className="canvas-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            if (firstMatch) select(firstMatch.id, { scroll: true, focusGraph: true });
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Введите название навыка"
            aria-label="Поиск навыка внутри профессии"
            enterKeyHint="search"
          />
          {query ? (
            <button className="search-clear" type="button" onClick={() => setQuery("")} aria-label="Очистить поиск">
              <IconCloseSquare />
            </button>
          ) : null}
        </form>

        {query.trim() && matches.size === 0 ? (
          <p className="canvas-search-hint">В этой профессии нет навыков по запросу «{query.trim()}».</p>
        ) : null}

        <CompetencyGraph
          ref={graphRef}
          nodes={graphNodes}
          mode={view}
          activeId={selectedId}
          hoverId={hoverId}
          matches={matches}
          onHover={hoverCompetency}
          onSelect={selectFromGraph}
          onZoomChange={setZoomPercent}
        />

        <CanvasToolbar
          zoomPercent={zoomPercent}
          view={view}
          onViewChange={changeView}
          onZoomIn={() => graphRef.current?.zoomIn()}
          onZoomOut={() => graphRef.current?.zoomOut()}
        />
      </div>

      {selected ? (
        // key по компетенции: панель пересобирается на новый выбор и заново
        // въезжает справа — движение отвечает на вопрос «что изменилось»
        // (COS-COM-007 §5), а внутренний скролл честно начинается сверху.
        <CompetencyDetail
          key={selected.id}
          profession={profession}
          competency={selected}
          state={selectedState ?? { saved: false, status: "NOT_STARTED" }}
          viewer={viewer}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((current) => !current)}
          onClose={closeDetail}
        />
      ) : null}
    </div>
  );
}
