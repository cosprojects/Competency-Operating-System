"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger";
import { SaveButton } from "@/components/SaveButton";
import { SourceLink } from "@/components/SourceLink";
import { SourceReviewBadge } from "@/components/source-review/SourceReviewBadge";
import { IconArrowRight, IconEye, IconStar } from "@/components/icons";
import { accessHint, accessLabel, sourceKindLabel } from "@/lib/content";
import type { ContentSource } from "@/lib/content-types";

type ReviewAction = "CONFIRM" | "BLOCK" | null;

interface PreviewData {
  image?: string;
  title?: string;
  description?: string;
  siteName?: string;
}

/**
 * Карточка материала по макету (source-card): обложка с блюром, бейджи-пилюли,
 * состояние проверки, «Просмотрен» (иконка глаза), отклонение с «Вернуть»,
 * футер «Проверен / Сообщить о проблеме» и CTA «Перейти к источнику».
 */
export function MaterialCard({
  source,
  competencyId,
  competencyTitle,
  canOpen,
  canReview,
  canSave,
  returnTo,
}: {
  source: ContentSource;
  competencyId: string;
  competencyTitle: string;
  canOpen: boolean;
  canReview: boolean;
  canSave: boolean;
  returnTo: string;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [viewed, setViewed] = useState(Boolean(source.viewed));
  const [reviewAction, setReviewAction] = useState<ReviewAction>(source.myReviewAction ?? null);
  const [undoBusy, setUndoBusy] = useState(false);

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

  async function markViewed() {
    if (viewed) return;
    setViewed(true);
    try {
      await fetch("/api/source-views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: source.id }),
      });
    } catch {
      // Просмотр — не критичная операция; не мешаем переходу.
    }
  }

  async function undoReview() {
    setUndoBusy(true);
    try {
      const response = await fetch("/api/source-reviews", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: source.id, competencyId }),
      });
      if (!response.ok) throw new Error("Не получилось");
      setReviewAction(null);
      router.refresh();
    } catch {
      // оставляем состояние как есть
    } finally {
      setUndoBusy(false);
    }
  }

  const rejected = reviewAction === "BLOCK";
  const title = preview?.title?.trim() || source.title;
  const description = preview?.description?.trim() || source.summary;
  const image = preview?.image;
  const showImage = Boolean(image) && !imageFailed;

  return (
    <article className={`material-card${rejected ? " is-rejected" : ""}`}>
      <div className="material-cover">
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
        <span className="material-pill">{sourceKindLabel(source.kind)}</span>
        <span className="material-pill" title={accessHint(source.access)}>
          {accessLabel(source.access)}
        </span>
        <span className="material-pill">
          {source.languages.length > 0
            ? source.languages.map((language) => language.toUpperCase()).join(", ")
            : "язык не указан"}
        </span>
        <span className="material-badge-slot">
          {viewed ? (
            <span className="material-viewed-icon" title="Просмотрен" aria-label="Просмотрен">
              <IconEye />
            </span>
          ) : null}
          {!reviewAction ? (
            <SourceReviewBadge
              sourceId={source.id}
              sourceTitle={source.title}
              competencyId={competencyId}
              competencyTitle={competencyTitle}
              initialStatus={source.reviewStatus}
              canReview={canReview}
              returnTo={returnTo}
              myReviewAction={reviewAction}
              onDecided={(action) => setReviewAction(action)}
            />
          ) : null}
          {canSave ? (
            <SaveButton
              targetType="SOURCE"
              targetId={source.id}
              initialSaved={Boolean(source.saved)}
              variant="icon"
            />
          ) : (
            <Link
              className="icon-button material-save-guest"
              href={`/register?returnTo=${encodeURIComponent(returnTo)}`}
              aria-label="Войти, чтобы сохранить материал"
              title="Войти, чтобы сохранить материал"
            >
              <IconStar />
            </Link>
          )}
        </span>
      </div>
      <div className="material-body">
        <h4 className="material-title">{title}</h4>
        <p className="material-desc">{description}</p>
        {source.rationale || source.whyUseful ? (
          <p className="material-rationale">
            Почему подходит: {source.rationale ?? source.whyUseful}
          </p>
        ) : null}

        {rejected ? (
          <div className="material-rejected">
            <span>Ты проверил материал и отметил как неподходящий</span>
            <button className="button secondary small" type="button" onClick={() => void undoReview()} disabled={undoBusy}>
              {undoBusy ? "Возвращаем…" : "Вернуть"}
            </button>
          </div>
        ) : null}

        <div className="material-meta">
          <span>Проверен: {source.lastChecked}</span>
          <FeedbackTrigger
            className="link-button"
            options={{ context: "source", type: "BAD_MATERIAL", targetType: "SOURCE", targetId: source.id }}
          >
            Сообщить о проблеме
          </FeedbackTrigger>
        </div>

        {canOpen ? (
          <SourceLink
            className="material-cta"
            source={source}
            competencyId={competencyId}
            canOpen
            returnTo={returnTo}
            openLabel="Перейти к источнику"
            onOpen={() => void markViewed()}
          />
        ) : null}
      </div>
    </article>
  );
}
