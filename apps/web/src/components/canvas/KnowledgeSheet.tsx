"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger";
import { IconArrowLeft, IconArrowRight, IconCloseCircle } from "@/components/icons";

interface GuideSection {
  heading: string;
  text: string;
}

interface Guide {
  status: "ok" | "no_data";
  sections: GuideSection[];
  sources: Array<{ title: string; url: string; lang: string }>;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  definition?: string;
  kind: "KNOWLEDGE" | "SKILL";
}

/** Модалка знания/навыка: разбор, источники, отметка «усвоено» (COS-EAR-017). */
export function KnowledgeSheet({
  competencyId,
  competencyTitle,
  items,
  index,
  learnedIds,
  onNavigate,
  onClose,
  onLearnedChange,
}: {
  competencyId: string;
  competencyTitle: string;
  items: KnowledgeItem[];
  index: number;
  learnedIds: Set<string>;
  onNavigate: (nextIndex: number) => void;
  onClose: () => void;
  onLearnedChange: (itemId: string, learned: boolean) => void;
}) {
  const item = items[index];
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const learned = item ? learnedIds.has(item.id) : false;

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setGuide(null);
    fetch(`/api/guide?item=${encodeURIComponent(item.id)}`)
      .then(async (response) => {
        if (response.status === 401) throw new Error("auth");
        if (!response.ok) throw new Error("empty");
        return (await response.json()) as { guide: Guide };
      })
      .then((data) => {
        if (!cancelled) setGuide(data.guide);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      if (event.key === "ArrowRight" && index < items.length - 1) onNavigate(index + 1);
    }
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [index, items.length, onClose, onNavigate]);

  if (!item || typeof document === "undefined") return null;

  async function toggleLearned() {
    if (!item) return;
    setBusy(true);
    const next = !learned;
    try {
      const response = await fetch("/api/study-marks", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          next
            ? { targetType: item.kind, targetId: item.id, status: "LEARNED" }
            : { targetType: item.kind, targetId: item.id },
        ),
      });
      if (!response.ok) throw new Error("fail");
      onLearnedChange(item.id, next);
    } catch {
      // Оставляем состояние как было — повторное нажатие безопасно.
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="knowledge-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="knowledge-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-sheet-title"
      >
        <button className="knowledge-close" type="button" onClick={onClose} aria-label="Закрыть">
          <IconCloseCircle />
        </button>

        <div className="knowledge-sheet-scroll">
          <div className="knowledge-meta">
            <span className="knowledge-kind">{item.kind === "SKILL" ? "Навык" : "Знание"}</span>
            <span className="knowledge-state">{learned ? "Изучено" : "Не изучено"}</span>
          </div>

          <h2 id="knowledge-sheet-title">{item.title}</h2>
          <p className="knowledge-competency">{competencyTitle}</p>

          {item.definition ? <p className="knowledge-intro">{item.definition}</p> : null}

          {loading ? <p className="knowledge-status">Загружаем разбор…</p> : null}
          {error === "auth" ? <p className="knowledge-status">Разборы открываются после входа.</p> : null}
          {error === "empty" ? <p className="knowledge-status">Разбор пока готовится.</p> : null}
          {error && error !== "auth" && error !== "empty" ? (
            <p className="knowledge-status">Разбор не загрузился. Попробуй ещё раз.</p>
          ) : null}

          {guide && guide.status === "ok"
            ? guide.sections.map((section) => (
                <article className="knowledge-section" key={section.heading}>
                  <h3>{section.heading}</h3>
                  <p>{section.text}</p>
                </article>
              ))
            : null}

          {guide?.status === "no_data" || error === "empty" ? (
            <div className="knowledge-notice">
              <p className="knowledge-notice-title">Разбора пока нет</p>
              <p>
                Подходящий источник не нашли. Если знаешь материал по теме — поделись: проверим
                и добавим разбор.
              </p>
              <FeedbackTrigger
                className="button secondary small"
                options={{ context: "competency", type: "IMPROVEMENT", targetType: "COMPETENCY", targetId: competencyId, title: item.title }}
              >
                Поделиться источником знаний
              </FeedbackTrigger>
            </div>
          ) : null}

          {guide ? (
            <div className="knowledge-sources-row">
              <span className="knowledge-sources">
                {guide.sources.length > 0
                  ? `Источники: ${[...new Set(guide.sources.map((source) => source.title.trim()).filter(Boolean))].join(", ")}`
                  : "Источники: пока не подобраны"}
              </span>
              <FeedbackTrigger
                className="knowledge-report"
                options={{
                  context: "competency",
                  type: "CONTENT_ERROR",
                  targetType: "COMPETENCY",
                  targetId: competencyId,
                  title: item.title,
                }}
              >
                Сообщить о проблеме
              </FeedbackTrigger>
            </div>
          ) : null}

          <p className="knowledge-note">Отметка изменит прогресс компетенции. Её можно снять.</p>
        </div>

        <footer className="knowledge-sheet-footer">
          <button className="button secondary knowledge-footer-close" type="button" onClick={onClose}>
            Закрыть
          </button>
          <button
            className={`button knowledge-footer-mark${learned ? " is-learned" : ""}`}
            type="button"
            onClick={() => void toggleLearned()}
            disabled={busy}
          >
            {learned ? "Снять отметку «Изучено»" : "Отметить изученным"}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
