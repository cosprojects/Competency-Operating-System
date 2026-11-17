"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconArrowRight, IconCheckCircle, IconStar } from "@/components/icons";
import { KnowledgeSheet, type KnowledgeItem } from "@/components/canvas/KnowledgeSheet";
import { MaterialCard } from "@/components/canvas/MaterialCard";
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

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="learn-progress-line">
      <span className="learn-progress-label">{label}</span>
      <span className="learn-progress-track" aria-hidden="true">
        <span style={{ width: `${value}%` }} />
      </span>
      <span className="learn-progress-value">{value}%</span>
    </div>
  );
}

/** Карточка компетенции в «Изучаю»: прогресс, знания/навыки, материалы. */
export function LearningCard({
  card,
  defaultExpanded = false,
  returnTo = "/saved",
}: {
  card: LearningCardData;
  defaultExpanded?: boolean;
  returnTo?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [learned, setLearned] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(card.items.map((item) => [item.id, item.learned])),
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

  function markLearned(id: string, next: boolean) {
    setLearned((current) => ({ ...current, [id]: next }));
  }

  const nextItem = card.items.find((item) => !learned[item.id]);

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
          {expanded ? "Свернуть" : "Развернуть"}
          <span className={`learning-toggle-icon${expanded ? " is-open" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 15 15 9M9 9h6v6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" />
            </svg>
          </span>
        </button>
      </div>

      <div className="learning-summary">
        <div className="learning-summary-main">
          <div className="learning-summary-top">
            <span className={`badge ${card.tierClass}`}>{card.tierLabel}</span>
            <Link className="icon-button learning-star" href={`/professions/${card.professionSlug}?competency=${card.competencyId}`} aria-label="Открыть компетенцию" title="Открыть компетенцию">
              <IconStar />
            </Link>
          </div>
          <h3>
            <Link href={`/professions/${card.professionSlug}?competency=${card.competencyId}`}>{card.title}</Link>
          </h3>
          <p>{card.definition}</p>
          <span className="learning-meta">
            {knowledge.length} {plural(knowledge.length, ["знание", "знания", "знаний"])} ·{" "}
            {skills.length} {plural(skills.length, ["навык", "навыка", "навыков"])} ·{" "}
            {card.materials.reduce((sum, group) => sum + group.sources.length, 0)}{" "}
            {plural(card.materials.reduce((sum, group) => sum + group.sources.length, 0), ["материал", "материала", "материалов"])}
          </span>
        </div>

        <div className="learning-summary-progress">
          <div className="learning-percent">
            <strong>{percent}%</strong>
            <span>{learnedCount} из {total} знаний и навыков изучено</span>
          </div>
          <ProgressBar value={knowledge.length > 0 ? Math.round((knowledgeLearned / knowledge.length) * 100) : 0} label={`Знания: ${knowledgeLearned} из ${knowledge.length}`} />
          <ProgressBar value={skills.length > 0 ? Math.round((skillsLearned / skills.length) * 100) : 0} label={`Навыки: ${skillsLearned} из ${skills.length}`} />
          <p className="learning-progress-note">
            {percent === 100 ? "Компетенция изучена" : "Каждая отметка «Изучено» продвигает вас по маршруту."}
          </p>
        </div>
      </div>

      {expanded ? (
        <div className="learning-body">
          <div className="learning-columns">
            <section className="learning-part">
              <h4>Знания и навыки</h4>
              <p className="learning-part-note">Отметьте элемент, чтобы изучить подробности и отметить результат.</p>
              <div className="learning-rows">
                {card.items.map((item, index) => (
                  <div className="learning-row" key={item.id}>
                    <span className="learning-row-num">{String(index + 1).padStart(2, "0")}</span>
                    <div className="learning-row-text">
                      <span className="learning-row-title">{item.title}</span>
                      <span className="learning-row-desc">
                        {item.kind === "SKILL" ? "Навык" : "Знание"} · {item.definition ?? ""}
                      </span>
                    </div>
                    <span className={`learning-row-state${learned[item.id] ? " is-learned" : ""}`}>
                      {learned[item.id] ? <IconCheckCircle /> : null}
                      {learned[item.id] ? "Изучено" : "Хочу изучить"}
                    </span>
                    <button className="learning-row-open" type="button" onClick={() => setOpenIndex(index)}>
                      Открыть
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {nextItem ? (
              <aside className="learning-next">
                <span className="learning-next-label">Следующий шаг</span>
                <h4>{nextItem.title}</h4>
                <p>Откройте любой неизученный элемент. Каждая отметка делает ваш прогресс заметным.</p>
                <button
                  className="button learning-next-cta"
                  type="button"
                  onClick={() => setOpenIndex(card.items.findIndex((item) => item.id === nextItem.id))}
                >
                  Изучить {nextItem.kind === "SKILL" ? "навык" : "знание"} <IconArrowRight />
                </button>
                <span className="learning-next-note">Углубляйтесь в профессию в своем темпе</span>
              </aside>
            ) : (
              <aside className="learning-next">
                <span className="learning-next-label">Готово</span>
                <h4>Все элементы изучены</h4>
                <p>Компетенция отмечена как изученная. Можно перейти к следующей.</p>
              </aside>
            )}
          </div>

          {card.materials.map((group) =>
            group.sources.length > 0 ? (
              <section className="learning-part" key={group.title}>
                <h4>
                  {group.title} <span className="learning-count">{group.sources.length}</span>
                </h4>
                <div className="learning-materials">
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
                    />
                  ))}
                </div>
              </section>
            ) : null,
          )}

          {card.occurrences.length > 0 ? (
            <section className="learning-part">
              <h4>Входит в профессии</h4>
              <div className="learning-occurrences">
                {card.occurrences.map((occurrence) => (
                  <Link
                    className="learning-occurrence"
                    key={`${occurrence.professionSlug}-${occurrence.sectionTitle}`}
                    href={`/professions/${occurrence.professionSlug}?competency=${card.competencyId}`}
                  >
                    <span>
                      <strong>{occurrence.professionTitle}</strong>
                      <span>{occurrence.sectionTitle}</span>
                    </span>
                    <IconArrowRight />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {openIndex !== null ? (
        <KnowledgeSheet
          competencyId={card.competencyId}
        competencyTitle={card.title}
        items={studyItems}
        index={openIndex ?? 0}
        learnedIds={new Set(card.items.filter((item) => learned[item.id]).map((item) => item.id))}
        onNavigate={setOpenIndex}
        onClose={() => setOpenIndex(null)}
          onLearnedChange={markLearned}
        />
      ) : null}
    </article>
  );
}
