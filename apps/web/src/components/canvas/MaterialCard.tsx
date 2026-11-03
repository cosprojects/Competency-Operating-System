"use client";

import { useEffect, useState } from "react";
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger";
import { SourceLink } from "@/components/SourceLink";
import { accessLabel, authorityLabel, sourceKindLabel } from "@/lib/content";
import type { ContentSource } from "@/lib/content-types";

interface PreviewData {
  image?: string;
  title?: string;
  description?: string;
  siteName?: string;
}

/**
 * Карточка материала. Обложка и аннотация подтягиваются со страницы источника
 * (og:image / og:description), с откатом на данные каталога; внизу — проверка,
 * жалоба и полноширинная кнопка перехода.
 */
export function MaterialCard({
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
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    setPreview(null);
    setImageFailed(false);
    fetch(`/api/link-preview?url=${encodeURIComponent(source.url)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PreviewData | null) => {
        if (!cancelled && data) setPreview(data);
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [source.url]);

  const title = preview?.title?.trim() || source.title;
  const description = preview?.description?.trim() || source.summary;
  const image = preview?.image;
  const showImage = Boolean(image) && !imageFailed;

  return (
    <article className="material-card">
      <div className="material-bg" aria-hidden="true">
        <div className="material-bg-image">
          {showImage ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="material-bg-fallback" />
          )}
        </div>
      </div>

      <div className="material-badges">
        <span className="pill">{sourceKindLabel(source.kind)}</span>
        <span className="pill">{accessLabel(source.access)}</span>
        <span className="pill">
          {source.languages.length > 0
            ? source.languages.map((language) => language.toUpperCase()).join(", ")
            : "язык не указан"}
        </span>
        <span className="material-authority">{authorityLabel(source.authority)}</span>
      </div>

      <div className="material-text">
        <h4>{title}</h4>
        <p>{description}</p>
        {source.rationale ? <p className="material-rationale">Почему подходит: {source.rationale}</p> : null}
      </div>

      <div className="material-meta">
        <span>Проверен: {source.lastChecked}</span>
        <FeedbackTrigger
          className="link-button"
          options={{ context: "source", type: "BAD_MATERIAL", targetType: "SOURCE", targetId: source.id }}
        >
          Сообщить о проблеме
        </FeedbackTrigger>
      </div>

      <SourceLink
        className="button block material-cta"
        source={source}
        competencyId={competencyId}
        canOpen={canOpen}
        returnTo={returnTo}
        openLabel="Перейти к источнику"
        gatedLabel="Войти и открыть"
      />
    </article>
  );
}
