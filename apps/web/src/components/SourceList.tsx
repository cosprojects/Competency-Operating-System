import Link from "next/link";
import type { ContentSource } from "@/lib/content-types";
import { accessLabel, authorityLabel, sourceKindLabel } from "@/lib/content";
import { SourceLink } from "./SourceLink";

export function SourceList({
  competencyId,
  sources,
  canOpen,
  returnTo,
}: {
  competencyId: string;
  sources: ContentSource[];
  canOpen: boolean;
  returnTo: string;
}) {
  if (sources.length === 0) {
    return (
      <div className="notice">
        Для этой компетенции пока нет опубликованного материала. Сообщите об этом в обратной связи.
      </div>
    );
  }

  return (
    <div className="source-list">
      {sources.map((source) => (
        <article className="source-card" key={source.id}>
          <div className="meta">
            <span className="badge neutral">{sourceKindLabel(source.kind)}</span>
            <span className="pill">{accessLabel(source.access)}</span>
            <span className="pill">{source.languages.join(", ") || "язык не указан"}</span>
            <span className="pill">{authorityLabel(source.authority)}</span>
          </div>
          <h3>{source.title}</h3>
          <p>{source.summary}</p>
          {source.rationale ? <p className="small">Почему подходит: {source.rationale}</p> : null}
          <div className="source-actions">
            <SourceLink
              source={source}
              competencyId={competencyId}
              canOpen={canOpen}
              returnTo={returnTo}
            />
            <span className="small muted">Проверен: {source.lastChecked}</span>
            <Link
              className="small"
              href={`/feedback?targetType=SOURCE&targetId=${encodeURIComponent(source.id)}&type=BAD_MATERIAL`}
            >
              Сообщить о проблеме
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
