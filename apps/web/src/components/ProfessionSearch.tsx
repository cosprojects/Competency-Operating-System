"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { IconCloseSquare } from "@/components/icons";
import { ProfessionTile } from "@/components/ProfessionTile";
import type { SearchProfession } from "@/components/ProfessionTile";
import { matchesSearchTokens } from "@/lib/search-index";

export type { SearchProfession } from "@/components/ProfessionTile";

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
  const saved = useMemo(() => new Set(savedSlugs), [savedSlugs]);
  const [query, setQuery] = useState("");
  // Фильтрация идёт по отложенному значению: поле ввода не ждёт пересчёта
  // списка и остаётся отзывчивым на каждом символе.
  const deferredQuery = useDeferredValue(query);
  const normalized = normalize(deferredQuery);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          professions: group.professions.filter((profession) =>
            matchesSearchTokens(profession.searchText, normalized),
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

      <div className="search-head" data-enter>
        <h1>Выберите направление</h1>
        <p>И погрузитесь в профессию, изучив компетенции, знания, навыки и учебные материалы.</p>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="empty" data-enter>
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
                {group.professions.map((profession, index) => (
                  <ProfessionTile
                    key={profession.slug}
                    profession={profession}
                    index={index}
                    saved={saved.has(profession.slug)}
                    viewer={Boolean(viewer)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
