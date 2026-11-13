"use client";

import Link from "next/link";
import { SaveButton } from "@/components/SaveButton";

export interface SavedProfessionView {
  slug: string;
  title: string;
  description: string;
  published: number;
  total: number;
  percent: number;
}

export interface SavedSkillView {
  id: string;
  title: string;
  definition: string;
  tierLabel: string;
  tierClass: "foundation" | "core" | "optional";
  summary: string;
  professionSlug: string;
}

/** Карточка сохранённой профессии (в секции «Профессии»). */
export function SavedProfessionCard({ profession }: { profession: SavedProfessionView }) {
  return (
    <article className="saved-profession-card">
      <div className="saved-profession-top">
        <span className="badge neutral">Профессия</span>
        <span className="small muted">
          {profession.published} из {profession.total} компетенций
        </span>
        <SaveButton targetType="PROFESSION" targetId={profession.slug} initialSaved variant="icon" />
      </div>
      <h3>
        <Link className="stretched-link" href={`/professions/${profession.slug}`}>
          {profession.title}
        </Link>
      </h3>
      <p>{profession.description}</p>
      <div className="coverage">
        <div className="coverage-bar" aria-hidden="true">
          <span style={{ width: `${profession.percent}%` }} />
        </div>
        <div className="coverage-text">
          <span>Покрытие Beta</span>
          <span>{profession.percent}%</span>
        </div>
      </div>
    </article>
  );
}

/** Карточка сохранённой компетенции (в секции «Компетенции»). */
export function SavedSkillCard({ skill }: { skill: SavedSkillView }) {
  return (
    <article className="saved-skill-card">
      <div className="saved-skill-top">
        <span className={`badge ${skill.tierClass}`}>{skill.tierLabel}</span>
        <SaveButton
          targetType="COMPETENCY"
          targetId={skill.id}
          initialSaved
          variant="icon"
          contextProfession={skill.professionSlug}
        />
      </div>
      <h3>
        <Link
          className="stretched-link"
          href={`/professions/${skill.professionSlug}?competency=${skill.id}`}
        >
          {skill.title}
        </Link>
      </h3>
      <p>{skill.definition}</p>
      <div className="saved-skill-meta">{skill.summary}</div>
    </article>
  );
}