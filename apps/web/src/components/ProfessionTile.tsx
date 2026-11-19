"use client";

import Link from "next/link";
import { memo } from "react";
import { IconAcademicCapOutline } from "@/components/icons";
import { SaveButton } from "@/components/SaveButton";

export interface SearchProfession {
  slug: string;
  title: string;
  description: string;
  countText: string;
  percent: number;
  searchText: string;
  sphereTitle: string;
  sphereStyle: { color: string; backgroundColor: string };
}

interface ProfessionTileProps {
  profession: SearchProfession;
  index: number;
  saved: boolean;
  viewer: boolean;
  href?: string;
  badge?: string;
  /** Показывать прогресс покрытия. На главной он скрыт (макет 369-14582). */
  showCoverage?: boolean;
}

/**
 * Плитка профессии из раздела «Направления» — единая карточка профессии в
 * системе. Используется и на `/professions`, и во втором табе «Изучаю».
 */
export const ProfessionTile = memo(function ProfessionTile({
  profession,
  index,
  saved,
  viewer,
  href,
  badge,
  showCoverage = true,
}: ProfessionTileProps) {
  return (
    <div
      className="profession-tile"
      data-enter
      // Волна появления: слева направо и сверху вниз, по порядку сетки.
      // Шаг 60 мс, потолок 720 мс (COS-EAR-016).
      style={{ animationDelay: `${Math.min(index * 60, 720)}ms` }}
    >
      <Link
        className="tile-hit"
        href={href ?? `/professions/${profession.slug}`}
        aria-label={`Открыть профессию «${profession.title}»`}
      />
      <div className="tile-top">
        {badge ? <span className="badge">{badge}</span> : null}
        <span className="tile-count">{profession.countText}</span>
        <span className="tile-action">
          {viewer ? (
            <SaveButton
              variant="icon"
              targetType="PROFESSION"
              targetId={profession.slug}
              initialSaved={saved}
              title={profession.title}
              description={profession.description}
            />
          ) : (
            <Link
              className="icon-button"
              href={`/login?returnTo=${encodeURIComponent("/professions")}`}
              aria-label="Войти, чтобы изучать профессию"
              title="Войти, чтобы изучать профессию"
            >
              <IconAcademicCapOutline />
            </Link>
          )}
        </span>
      </div>
      <h3 className="tile-title">{profession.title}</h3>
      <p className="tile-desc">{profession.description}</p>
      {showCoverage ? (
        <div className="coverage">
          <div className="coverage-bar" aria-hidden="true">
            <span style={{ width: `${profession.percent}%` }} />
          </div>
          <div className="coverage-text">
            <span>Покрытие Beta</span>
            <span>{profession.percent}%</span>
          </div>
        </div>
      ) : null}
    </div>
  );
});
