"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAcademicCap,
  IconArrowRight,
  IconCheckCircle,
  IconMaximizeSquare,
  IconSquareArrowUpRight,
} from "@/components/icons";
import { KnowledgeSheet, type KnowledgeItem } from "@/components/canvas/KnowledgeSheet";
import { MaterialCard } from "@/components/canvas/MaterialCard";
import { StopLearningDialog } from "@/components/saved/StopLearningDialog";
import { showToast } from "@/components/ui/Toast";
import type { ContentSource } from "@/lib/content-types";

export interface LearningItemData {
  id: string;
  title: string;
  definition?: string;
  kind: "KNOWLEDGE" | "SKILL";
  learned: boolean;
}

export interface LearningMaterialGroup {
  title: string;
  sources: ContentSource[];
}

export interface LearningCardData {
  competencyId: string;
  title: string;
  definition: string;
  tierLabel: string;
  tierClass: "foundation" | "core" | "optional";
  professionSlug: string;
  professionTitle: string;
  saved: boolean;
  items: LearningItemData[];
  materials: LearningMaterialGroup[];
  occurrences: Array<{ professionSlug: string; professionTitle: string; sectionTitle: string }>;
}

function plural(value: number, forms: [string, string, string]): string {
  const m10 = value % 10;
  const m100 = value % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

function kindWord(kind: LearningItemData["kind"]): string {
  return kind === "SKILL" ? "навык" : "знание";
}

/**
 * «Изучаю»: маршрут компетенции по макету 407-7332.
 *
 * Свёрнутая карточка — прогресс компетенции, развёрнутая добавляет список знаний
 * и навыков, карточку следующего шага, материалы и «Входит в профессии».
 * Сегментированный прогресс: один сегмент — одно знание или навык.
 */
export function LearningCard({
  card,
  defaultExpanded = false,
  canStopStudy = true,
  returnTo = "/saved",
}: {
  card: LearningCardData;
  defaultExpanded?: boolean;
  /** Показывать иконку «прекратить изучение»: для карточек в «Изучено» она не нужна. */
  canStopStudy?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [stopOpen, setStopOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [learned, setLearned] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(card.items.map((item) => [item.id, item.learned])),
  );
  // По умолчанию выбран первый неизученный элемент (как «Следующий шаг» в макете);
  // если всё изучено — первый элемент, чтобы CTA всё равно открывал модалку.
  const [selectedId, setSelectedId] = useState<string | null>(
    card.items.find((item) => !item.learned)?.id ?? card.items[0]?.id ?? null,
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const studyItems = useMemo<KnowledgeItem[]>(
    () =>
      card.items.map((item) => ({
        id: item.id,
        title: item.title,
        definition: item.definition,
        kind: item.kind,
      })),
    [card.items],
  );

  const learnedCount = card.items.filter((item) => learned[item.id]).length;
  const total = card.items.length;
  const percent = total > 0 ? Math.round((learnedCount / total) * 100) : 0;
  const knowledge = card.items.filter((item) => item.kind === "KNOWLEDGE");
  const skills = card.items.filter((item) => item.kind === "SKILL");
  const knowledgeLearned = knowledge.filter((item) => learned[item.id]).length;
  const skillsLearned = skills.filter((item) => learned[item.id]).length;

  const selectedItem = card.items.find((item) => item.id === selectedId) ?? card.items[0];
  const selectedLearned = selectedItem ? Boolean(learned[selectedItem.id]) : false;
  const allLearned = total > 0 && learnedCount === total;
  const materialsCount = card.materials.reduce((sum, group) => sum + group.sources.length, 0);

  function markLearned(id: string, next: boolean) {
    setLearned((current) => ({ ...current, [id]: next }));
  }

  async function stopStudying() {
    setStopping(true);
    try {
      const response = await fetch("/api/favorites", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "COMPETENCY", targetId: card.competencyId }),
      });
      if (!response.ok) throw new Error("fail");
      setStopOpen(false);
      setStopped(true);
      showToast({
        title: "Изучение прекращено",
        headline: card.title,
        text: "Компетенция убрана из активного маршрута. Отметки знаний и навыков сохранились.",
        actionLabel: "Закрыть",
        duration: 5000,
      });
      router.refresh();
    } catch {
      showToast({
        title: "Не получилось",
        text: "Не удалось убрать компетенцию из «Изучаю». Попробуйте ещё раз.",
        actionLabel: "Закрыть",
        duration: 5000,
      });
    } finally {
      setStopping(false);
    }
  }

  if (stopped) return null;

  function openItem(item: LearningItemData) {
    const index = card.items.findIndex((entry) => entry.id === item.id);
    setSelectedId(item.id);
    setOpenIndex(index >= 0 ? index : 0);
  }

  return (
    <article className={`learning-card${expanded ? " is-expanded" : ""}`}>
      <div className="learning-card-head">
        <p className="learning-card-eyebrow">Личный прогресс в изучении компетенции</p>
        <button
          className="learning-toggle"
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span>{expanded ? "Свернуть" : "Развернуть"}</span>
          <IconMaximizeSquare className="learning-toggle-icon" />
        </button>
      </div>

      <div className="learning-summary">
        <div className="learning-summary-main">
          <div className="learning-summary-top">
            <span className={`badge ${card.tierClass}`}>{card.tierLabel}</span>
            {canStopStudy ? (
              <button
                className="icon-button learning-study-cap"
                type="button"
                onClick={() => setStopOpen(true)}
                aria-label="Прекратить изучение"
                title="Прекратить изучение"
              >
                <IconAcademicCap />
              </button>
            ) : null}
          </div>
          <h3>
            <Link href={`/professions/${card.professionSlug}?competency=${card.competencyId}`}>
              {card.title}
            </Link>
          </h3>
          <p>{card.definition}</p>
          <span className="learning-meta">
            {knowledge.length} {plural(knowledge.length, ["знание", "знания", "знаний"])} ·{" "}
            {skills.length} {plural(skills.length, ["навык", "навыка", "навыков"])} · {materialsCount}{" "}
            {plural(materialsCount, ["материал", "материала", "материалов"])}
          </span>
        </div>

        <div className="learning-progress">
          <div className="learning-percent">
            <strong>{percent}</strong>
            <span>%</span>
          </div>
          <p className="learning-progress-count">
            <strong>{learnedCount}</strong> из {total} знаний и навыков изучено
          </p>
          <div
            className="learning-segments"
            role="img"
            aria-label={`Освоено ${learnedCount} из ${total} знаний и навыков`}
          >
            {card.items.map((item) => (
              <span
                key={item.id}
                className={`learning-segment${learned[item.id] ? " is-filled" : ""}`}
              />
            ))}
          </div>
          <p className="learning-progress-breakdown">
            Знания: {knowledgeLearned} из {knowledge.length} · Навыки: {skillsLearned} из{" "}
            {skills.length}
          </p>
          <p className="learning-progress-note">
            {allLearned ? "Компетенция изучена" : "Каждая отметка «Изучено» продвигает вас по маршруту."}
          </p>
        </div>
      </div>

      {expanded ? (
        <div className="learning-body">
          <section className="learning-list-block">
            <div className="learning-list-head">
              <h4>Знания и навыки</h4>
              <p>
                {total} {plural(total, ["элемент", "элемента", "элементов"])} в компетенции · Откройте
                элемент, чтобы изучить подробности и отметить результат.
              </p>
            </div>

            <div className="learning-columns">
              <div className="learning-rows">
                {card.items.map((item, index) => {
                  const isSelected = selectedItem?.id === item.id;
                  const isLearned = Boolean(learned[item.id]);
                  return (
                    <div
                      className={`learning-row${isSelected ? " is-selected" : ""}`}
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className="learning-row-num">{String(index + 1).padStart(2, "0")}</span>
                      <span className="learning-row-text">
                        <span className="learning-row-title">{item.title}</span>
                        <span className="learning-row-desc">
                          {item.kind === "SKILL" ? "Навык" : "Знание"}
                          {item.definition ? ` · ${item.definition}` : ""}
                        </span>
                      </span>
                      <span className="learning-row-actions">
                        <span className={`learning-row-state${isLearned ? " is-learned" : ""}`}>
                          {isLearned ? <IconCheckCircle /> : null}
                          {isLearned ? "Изучено" : "Хочу изучить"}
                        </span>
                        <button
                          className="learning-row-open"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openItem(item);
                          }}
                        >
                          Открыть
                          <IconArrowRight />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>

              <aside className="learning-next">
                {selectedItem && !allLearned ? (
                  <>
                    <span className="learning-next-label">Следующий шаг</span>
                    <h4>{selectedItem.title}</h4>
                    <p>Откройте любой неизученный элемент. Каждая отметка делает ваш прогресс заметным.</p>
                    <button
                      className="learning-next-cta"
                      type="button"
                      onClick={() => openItem(selectedItem)}
                    >
                      {selectedLearned ? "Открыть" : "Изучить"} {kindWord(selectedItem.kind)}
                      <IconArrowRight />
                    </button>
                    <span className="learning-next-note">Углубляйтесь в профессию в своем темпе</span>
                  </>
                ) : (
                  <>
                    <span className="learning-next-label">Готово</span>
                    <h4>Все элементы изучены</h4>
                    <p>Компетенция отмечена как изученная. Можно перейти к следующей.</p>
                    {selectedItem ? (
                      <button
                        className="learning-next-cta"
                        type="button"
                        onClick={() => openItem(selectedItem)}
                      >
                        Открыть {kindWord(selectedItem.kind)}
                        <IconArrowRight />
                      </button>
                    ) : null}
                  </>
                )}
              </aside>
            </div>
          </section>

          {card.materials.map((group) =>
            group.sources.length > 0 ? (
              <section className="learning-materials-block" key={group.title}>
                <div className="learning-materials-head">
                  <h4>{group.title}</h4>
                  <span className="learning-count">{group.sources.length}</span>
                </div>
                <div
                  className="learning-materials"
                  data-count={Math.min(group.sources.length, 3)}
                >
                  {group.sources.map((source) => (
                    <MaterialCard
                      key={source.id}
                      source={source}
                      competencyId={card.competencyId}
                      competencyTitle={card.title}
                      canOpen
                      canReview={false}
                      canSave
                      returnTo={returnTo}
                      compact
                    />
                  ))}
                </div>
              </section>
            ) : null,
          )}

          {card.occurrences.length > 0 ? (
            <section className="learning-occurrences-block">
              <h4>Входит в профессии</h4>
              <div className="learning-occurrences">
                {card.occurrences.map((occurrence) => (
                  <Link
                    className="learning-occurrence"
                    key={`${occurrence.professionSlug}-${occurrence.sectionTitle}`}
                    href={`/professions/${occurrence.professionSlug}?competency=${card.competencyId}`}
                  >
                    <span className="learning-occurrence-text">
                      <strong>{occurrence.professionTitle}</strong>
                      <span>{occurrence.sectionTitle}</span>
                    </span>
                    <IconSquareArrowUpRight />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {canStopStudy ? (
        <StopLearningDialog
          open={stopOpen}
          competencyTitle={card.title}
          busy={stopping}
          onCancel={() => setStopOpen(false)}
          onConfirm={() => void stopStudying()}
        />
      ) : null}

      {openIndex !== null ? (
        <KnowledgeSheet
          competencyId={card.competencyId}
          competencyTitle={card.title}
          items={studyItems}
          index={openIndex}
          learnedIds={new Set(card.items.filter((item) => learned[item.id]).map((item) => item.id))}
          onNavigate={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          onLearnedChange={markLearned}
        />
      ) : null}
    </article>
  );
}
