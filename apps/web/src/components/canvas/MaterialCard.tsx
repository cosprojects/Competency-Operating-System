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

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "источник";
  }
}

/** Обложка и аннотация подтягиваются со страницы материала (og:image / og:description). */
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
    fetch(`/api/link-preview?url=${encodeURIComponent(source.url)}`, {
      signal: controller.signal,
    })
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
      <div className="material-badges">
        <span className="pill tone-neutral">{sourceKindLabel(source.kind)}</span>
        <span className="pill">{accessLabel(source.access)}</span>
        <span className="pill">
          {source.languages.length > 0
            ? source.languages.map((language) => language.toUpperCase()).join(", ")
            : "язык не указан"}
        </span>
        <span className="pill">{authorityLabel(source.authority)}</span>
      </div>

      <div className="material-preview">
        {showImage ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="material-preview-fallback" aria-hidden="true">
            {hostLabel(source.url).slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="material-host">{hostLabel(source.url)}</span>
      </div>

      <div className="material-text">
        <h4>{title}</h4>
        <p>{description}</p>
      </div>

      <div className="material-actions">
        <SourceLink
          className="button small material-cta"
          source={source}
          competencyId={competencyId}
          canOpen={canOpen}
          returnTo={returnTo}
        />
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
