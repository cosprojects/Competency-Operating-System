"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { CompetencyDetail } from "@/components/canvas/CompetencyDetail";
import { CompetencyGraph, type GraphHandle } from "@/components/canvas/CompetencyGraph";
import type {
  CanvasCompetency,
  CanvasProfession,
  CompetencyStates,
  CanvasViewer,
} from "@/components/canvas/types";
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger";
import { IconCloseSquare, IconStar } from "@/components/icons";
import { SaveButton } from "@/components/SaveButton";
import { competencyMatches, competencyMeta, countLabel, normalizeQuery } from "@/lib/content";
import { sphereBadgeStyle } from "@/lib/spheres";
import type { GraphMode, GraphNodeInput } from "@/lib/graph-layout";

const TIER_LABEL: Record<CanvasCompetency["tier"], string> = {
  foundation: "Фундаментальная",
  core: "Основная",
  optional: "Необязательная",
};

export function ProfessionCanvas({
  profession,
  competencies,
  states,
  viewer,
  professionSaved,
  initialCompetencyId,
  initialView = "board",
}: {
  profession: CanvasProfession;
  competencies: CanvasCompetency[];
  states: CompetencyStates;
  viewer: CanvasViewer | null;
  professionSaved: boolean;
  initialCompetencyId?: string;
  initialView?: GraphMode;
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
      setSelectedId(id);
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
    [scrollTileIntoView],
  );

  const closeDetail = useCallback(() => {
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
      <div className="canvas-rail">
        <div className="rail-pinned">
          <Link className="rail-choose" href="/professions">
            Выбрать профессию
          </Link>

          <section className="profession-summary">
          <div className="summary-top">
            <span className="badge" style={sphereBadgeStyle(profession.sphere.color)}>
              {profession.sphere.title}
            </span>
            <span className="summary-count">
              {countLabel(profession.published, ["компетенция", "компетенции", "компетенций"])}
            </span>
            {viewer ? (
              <SaveButton
                variant="icon"
                targetType="PROFESSION"
                targetId={profession.slug}
                initialSaved={professionSaved}
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
          {profession.sections.map((section) => (
            <section className="section-panel" key={section.id}>
              <h3>{section.title}</h3>
              <p className="section-count">
                {countLabel(section.competencyIds.length, ["компетенция", "компетенции", "компетенций"])}
              </p>
              <div className={`competency-track${section.competencyIds.length > 1 ? " has-many" : ""}`}>
                {section.competencyIds.map((id) => {
                  const competency = byId.get(id);
                  if (!competency) return null;
                  const active = selectedId === id;
                  const hovered = hoverId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      ref={(element) => {
                        if (element) tileRefs.current.set(id, element);
                        else tileRefs.current.delete(id);
                      }}
                      className={`competency-tile${active ? " is-active" : ""}${hovered && !active ? " is-hover" : ""}`}
                      onClick={() => select(id, { focusGraph: true })}
                      onMouseEnter={() => setHoverId(id)}
                      onMouseLeave={() => setHoverId(null)}
                      onFocus={() => setHoverId(id)}
                      onBlur={() => setHoverId(null)}
                    >
                      <span className="tile-head">
                        <span className={`badge ${competency.tier}`}>{TIER_LABEL[competency.tier]}</span>
                        <span className="num-badge">{displayOrder.get(competency.id)}</span>
                      </span>
                      <h4>{competency.title}</h4>
                      <p>{competency.definition}</p>
                      <span className="tile-meta">{competencyMeta(competency)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

          <div className="sidebar-notice">
            В Beta опубликованы не только проверенные компетенции. Если вы не нашли нужную —{" "}
            <FeedbackTrigger
              options={{ context: "competency", type: "MISSING_COMPETENCY", targetType: "COMPETENCY", targetId: selectedId ?? undefined }}
            >
              сообщите о пробеле
            </FeedbackTrigger>{" "}
            и помогите проверить добавленные. Вместе мы сделаем сервис полезнее!
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
          onHover={setHoverId}
          onSelect={(id) => select(id, { scroll: true })}
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
        <CompetencyDetail
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
