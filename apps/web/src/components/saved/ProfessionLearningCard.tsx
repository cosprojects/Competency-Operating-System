"use client";

import Link from "next/link";
import { SaveButton } from "@/components/SaveButton";

export interface LearningProfessionData {
  slug: string;
  title: string;
  description: string;
  sphereTitle: string;
  sphereStyle: { color: string; backgroundColor: string };
  countText: string;
  percent: number;
}

/**
 * Карточка профессии во втором табе «Изучаю» (макет 404-24323):
 * бейдж сферы, счётчик компетенций, звезда изучения, название, описание и
 * покрытие Beta. Вся карточка кликабельна, звезда — поверх.
 */
export function ProfessionLearningCard({ profession }: { profession: LearningProfessionData }) {
  return (
    <article className="learning-profession-card">
      <Link
        className="learning-profession-hit"
        href={`/professions/${profession.slug}`}
        aria-label={`Открыть профессию «${profession.title}»`}
      />
      <div className="learning-profession-top">
        <span className="learning-profession-badge" style={profession.sphereStyle}>
          {profession.sphereTitle}
        </span>
        <span className="learning-profession-count">{profession.countText}</span>
        <SaveButton
          variant="icon"
          targetType="PROFESSION"
          targetId={profession.slug}
          initialSaved
          title={profession.title}
          description={profession.description}
        />
      </div>
      <h3>{profession.title}</h3>
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
