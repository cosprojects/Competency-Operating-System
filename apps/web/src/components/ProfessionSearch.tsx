"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IconCloseSquare, IconStar } from "@/components/icons";
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

export interface SearchGroup {
  id: string;
  title: string;
  professions: SearchProfession[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

export function ProfessionSearch({
  groups,
  viewer,
  savedSlugs,
}: {
  groups: SearchGroup[];
  viewer: { email: string } | null;
  savedSlugs: string[];
}) {
  const router = useRouter();
  const saved = new Set(savedSlugs);
  const [query, setQuery] = useState("");
  const normalized = normalize(query);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          professions: group.professions.filter(
            (profession) => !normalized || profession.searchText.includes(normalized),
          ),
        }))
        .filter((group) => group.professions.length > 0),
    [groups, normalized],
  );

  const firstMatch = visibleGroups[0]?.professions[0];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (firstMatch) router.push(`/professions/${firstMatch.slug}`);
  }

  return (
    <div className="search-screen">
      <h1 className="sr-only">Профессии дизайнера</h1>
      <form className="search-bar" role="search" onSubmit={submit}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Введите название профессии или навыка"
          aria-label="Поиск профессии или навыка"
          enterKeyHint="go"
        />
        {query ? (
          <button
            className="search-clear"
            type="button"
            onClick={() => setQuery("")}
            aria-label="Очистить поиск"
          >
            <IconCloseSquare />
          </button>
        ) : null}
      </form>

      {visibleGroups.length === 0 ? (
        <div className="empty">
          <h2>Ничего не нашли</h2>
          <p>
            По запросу «{query.trim()}» нет профессии или навыка. Попробуйте другое название — например,
            «исследования» или «дизайн».
          </p>
        </div>
      ) : (
        <div className="profession-groups">
          {visibleGroups.map((group) => (
            <section className="profession-group" key={group.id}>
              <h2 className="group-title">{group.title}</h2>
              <div className="profession-grid">
                {group.professions.map((profession) => (
                  <div className="profession-tile" key={profession.slug}>
                    <Link
                      className="tile-hit"
                      href={`/professions/${profession.slug}`}
                      aria-label={`Открыть профессию «${profession.title}»`}
                    />
                    <div className="tile-top">
                      <span className="badge" style={profession.sphereStyle}>
                        {profession.sphereTitle}
                      </span>
                      <span className="tile-count">{profession.countText}</span>
                      <span className="tile-action">
                        {viewer ? (
                          <SaveButton
                            variant="icon"
                            targetType="PROFESSION"
                            targetId={profession.slug}
                            initialSaved={saved.has(profession.slug)}
                          />
                        ) : (
                          <Link
                            className="icon-button"
                            href={`/login?returnTo=${encodeURIComponent("/professions")}`}
                            aria-label="Войти, чтобы сохранить профессию"
                            title="Войти, чтобы сохранить профессию"
                          >
                            <IconStar />
                          </Link>
                        )}
                      </span>
                    </div>
                    <h3 className="tile-title">{profession.title}</h3>
                    <p className="tile-desc">{profession.description}</p>
                    <div className="coverage">
                      <div className="coverage-bar" aria-hidden="true">
                        <span style={{ width: `${profession.percent}%` }} />
                      </div>
                      <div className="coverage-text">
                        <span>Покрытие Beta</span>
                        <span>{profession.percent}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
