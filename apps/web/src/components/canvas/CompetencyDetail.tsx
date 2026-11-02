"use client";

import Link from "next/link";
import { accessLabel, authorityLabel, sourceKindLabel } from "@/lib/content";
import type { ContentItem, ContentSource } from "@/lib/content-types";
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger";
import { SaveButton } from "@/components/SaveButton";
import { SourceLink } from "@/components/SourceLink";
import { StatusSelect } from "@/components/StatusSelect";
import { IconCloseCircle } from "@/components/icons";
import type {
  CanvasCompetency,
  CanvasProfession,
  CompetencyState,
  CanvasViewer,
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
  children,
}: {
  title: string;
  count: number;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="detail-block">
      <div className="detail-block-head">
        <h3>{title}</h3>
        <span className="num-badge">{count}</span>
      </div>
      <p className="detail-hint">{hint}</p>
      {children}
    </section>
  );
}

function Track({ children }: { children: React.ReactNode }) {
  return <div className="detail-track">{children}</div>;
}

function ItemCards({ items, wide = false }: { items: ContentItem[]; wide?: boolean }) {
  return (
    <>
      {items.map((item) => (
        <article className={`detail-card${wide ? " wide" : ""}`} key={item.id}>
          <h4>{item.title}</h4>
          {item.definition ? <p>{item.definition}</p> : null}
        </article>
      ))}
    </>
  );
}

function MaterialCard({
  source,
  competencyId,
  canOpen,
  returnTo,
}: {
  source: ContentSource;
  competencyId: string;
  canOpen: boolean;
  returnTo: string;
}) {
  return (
    <article className="material-card">
      <div className="material-badges">
        <span className="pill tone-neutral">{sourceKindLabel(source.kind)}</span>
        <span className="pill">{accessLabel(source.access)}</span>
        <span className="pill">{source.languages.length > 0 ? source.languages.map((language) => language.toUpperCase()).join(", ") : "язык не указан"}</span>
        <span className="pill">{authorityLabel(source.authority)}</span>
      </div>
      <h4>{source.title}</h4>
      <p>{source.summary}</p>
      {source.rationale ? <p>Почему подходит: {source.rationale}</p> : null}
      <div className="material-actions">
        <SourceLink source={source} competencyId={competencyId} canOpen={canOpen} returnTo={returnTo} />
        <span className="small muted">Проверен: {source.lastChecked}</span>
        <FeedbackTrigger
          className="link-button"
          options={{ context: "source", type: "BAD_MATERIAL", targetType: "SOURCE", targetId: source.id }}
        >
          Сообщить о проблеме
        </FeedbackTrigger>
      </div>
    </article>
  );
}

export function CompetencyDetail({
  profession,
  competency,
  state,
  viewer,
  onClose,
}: {
  profession: CanvasProfession;
  competency: CanvasCompetency;
  state: CompetencyState;
  viewer: CanvasViewer | null;
  onClose: () => void;
}) {
  const returnTo = `/professions/${profession.slug}?competency=${competency.id}`;
  const tags = [
    profession.title,
    competency.sectionTitle,
    ...competency.knowledge.slice(0, 2).map((item) => item.title),
  ];

  return (
    <aside className="detail-rail" aria-label={`Компетенция: ${competency.title}`}>
      <header className="detail-head">
        <div className="detail-top">
          <span className={`badge ${competency.tier}`}>{TIER_LABEL[competency.tier]}</span>
          <div className="detail-top">
            <span className="detail-source">{competency.titleEn ?? competency.sectionTitle}</span>
            <button className="detail-close" type="button" onClick={onClose} aria-label="Закрыть компетенцию">
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

      <section className="detail-study">
        <div className="detail-block-head">
          <h3>Твой прогресс</h3>
        </div>
        {viewer ? (
          <>
            <SaveButton targetType="COMPETENCY" targetId={competency.id} initialSaved={state.saved} />
            <StatusSelect competencyId={competency.id} initialStatus={state.status} />
          </>
        ) : (
          <>
            <p className="detail-hint">
              Сохранения и статусы изучения привязаны к аккаунту. Материалы открываются после входа.
            </p>
            <Link className="button block" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
              Войти
            </Link>
          </>
        )}
      </section>

      <DetailBlock
        title="Что нужно знать"
        count={competency.knowledge.length}
        hint="Понятия и темы, на которые опирается компетенция."
      >
        {competency.knowledge.length === 0 ? (
          <div className="notice">Состав знаний ещё уточняется.</div>
        ) : (
          <Track>
            <ItemCards items={competency.knowledge} />
          </Track>
        )}
      </DetailBlock>

      <DetailBlock
        title="В профессии"
        count={competency.occurrences.length}
        hint="Компетенция может входить в несколько направлений."
      >
        <Track>
          {competency.occurrences.map((occurrence) => (
            <Link
              className="occurrence-card"
              key={`${occurrence.professionSlug}-${occurrence.sectionTitle}`}
              href={`/professions/${occurrence.professionSlug}?competency=${competency.id}`}
            >
              <strong>{occurrence.professionTitle}</strong>
              <span>{occurrence.sectionTitle}</span>
            </Link>
          ))}
        </Track>
      </DetailBlock>

      <DetailBlock
        title="Что нужно уметь"
        count={competency.skills.length}
        hint="Наблюдаемые действия и практические навыки."
      >
        {competency.skills.length === 0 ? (
          <div className="notice">Состав навыков ещё уточняется.</div>
        ) : (
          <Track>
            <ItemCards items={competency.skills} wide />
          </Track>
        )}
      </DetailBlock>

      <DetailBlock
        title="Материалы"
        count={competency.sources.length}
        hint="Курсы, статьи и другие источники. Ссылки открываются после входа: так можно сохранять материалы и возвращаться к ним."
      >
        {competency.sources.length === 0 ? (
          <div className="notice">Для этой компетенции пока нет опубликованного материала.</div>
        ) : (
          <div className="source-list">
            {competency.sources.map((source) => (
              <MaterialCard
                key={source.id}
                source={source}
                competencyId={competency.id}
                canOpen={Boolean(viewer)}
                returnTo={returnTo}
              />
            ))}
          </div>
        )}
      </DetailBlock>
    </aside>
  );
}
