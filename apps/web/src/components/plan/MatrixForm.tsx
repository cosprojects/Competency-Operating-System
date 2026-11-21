"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { SkillLevel } from "@/components/ui/SkillLevel";
import type { MatrixRow } from "@/lib/matrix";

const LEVELS = [0, 1, 2, 3, 4] as const;
const LEVEL_LABEL: Record<number, string> = {
  0: "Не владею",
  1: "Осведомлённость",
  2: "Умение",
  3: "Экспертиза",
  4: "Лидерство",
};

type Tab = "all" | "core" | "professional";

function groupLabel(group: MatrixRow["group"]): string {
  return group === "universal" || group === "digital" ? "Ядро" : "Профессиональные";
}

export function MatrixForm({
  professionSlug,
  professionTitle,
  gradeCode,
  gradeTitle,
  gradeScope,
  rows,
  initialLevels,
}: {
  professionSlug: string;
  professionTitle: string;
  gradeCode: string;
  gradeTitle: string;
  gradeScope: string;
  rows: MatrixRow[];
  initialLevels: Record<string, number>;
}) {
  const router = useRouter();
  const [levels, setLevels] = useState<Record<string, number | undefined>>(() => {
    const initial: Record<string, number | undefined> = {};
    for (const row of rows) initial[row.id] = initialLevels[row.id];
    return initial;
  });
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = useMemo(() => rows.filter((row) => levels[row.id] !== undefined).length, [levels, rows]);
  const complete = answered === rows.length;
  const groups = useMemo(() => {
    const map = new Map<string, MatrixRow[]>();
    for (const row of rows) {
      const label = groupLabel(row.group);
      map.set(label, [...(map.get(label) ?? []), row]);
    }
    return [...map.entries()];
  }, [rows]);
  const coreCount = useMemo(
    () => rows.filter((row) => groupLabel(row.group) === "Ядро").length,
    [rows],
  );
  const professionalCount = rows.length - coreCount;
  const visibleGroups = groups.filter(([label]) => {
    if (tab === "all") return true;
    return tab === "core" ? label === "Ядро" : label === "Профессиональные";
  });
  const ratio = rows.length === 0 ? 0 : Math.round((answered / rows.length) * 100);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete) {
      setError("Заполни все компетенции: «Не владею» — тоже ответ.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(rows.map((row) => [row.id, levels[row.id] ?? 0]));
      const response = await fetch("/api/matrix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ professionSlug, gradeCode, levels: payload }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Матрица не сохранилась");
      }
      router.push("/plan/result");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Матрица не сохранилась. Попробуй ещё раз — отметки остались на экране.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="plan-form" onSubmit={submit}>
      <header className="plan-page-head">
        <Eyebrow>План · самооценка</Eyebrow>
        <h1>Оцени свои компетенции</h1>
        <p className="plan-lead">
          {professionTitle} · {gradeTitle}. Отметь текущий уровень по требованиям грейда. Это
          самооценка, а не аттестация.
        </p>
        <div className="plan-progress">
          <div className="plan-progress-head">
            <span className="small muted">
              Заполнено {answered} из {rows.length}
            </span>
            <span className="plan-progress-value">{ratio}%</span>
          </div>
          <div className="plan-progress-bar" aria-hidden="true">
            <span style={{ width: `${ratio}%` }} />
          </div>
        </div>
      </header>

      <div className="plan-tabs" role="tablist" aria-label="Группы компетенций">
        <button
          className={`plan-tab${tab === "all" ? " is-active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          onClick={() => setTab("all")}
        >
          Все <span>{rows.length}</span>
        </button>
        <button
          className={`plan-tab${tab === "core" ? " is-active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "core"}
          onClick={() => setTab("core")}
        >
          Ядро <span>{coreCount}</span>
        </button>
        <button
          className={`plan-tab${tab === "professional" ? " is-active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "professional"}
          onClick={() => setTab("professional")}
        >
          Профессиональные <span>{professionalCount}</span>
        </button>
      </div>

      {visibleGroups.map(([label, groupRows]) => (
        <section className="plan-group" key={label} aria-labelledby={`plan-group-${label}`}>
          <div className="plan-group-head">
            <h2 id={`plan-group-${label}`}>{label}</h2>
            <span className="small muted">{groupRows.length} компетенций</span>
          </div>
          {groupRows.map((row) => {
            const value = levels[row.id];
            return (
              <article className="plan-row" key={row.id}>
                <div className="plan-row-head">
                  <h3>{row.title}</h3>
                  <div className="plan-row-target">
                    <span className="plan-row-target-label">Цель {row.targetLevel}</span>
                    <SkillLevel level={row.targetLevel} label={`Цель ${row.targetLevel} из 4`} />
                  </div>
                </div>
                <p className="plan-row-definition">{row.definition}</p>
                <fieldset className="plan-levels" aria-label={`Уровень: ${row.title}`}>
                  <legend className="sr-only">Текущий уровень</legend>
                  {LEVELS.map((level) => (
                    <label
                      className={`plan-level${value === level ? " is-selected" : ""}`}
                      data-level={level}
                      key={level}
                    >
                      <input
                        type="radio"
                        name={`level-${row.id}`}
                        value={level}
                        checked={value === level}
                        onChange={() => setLevels((current) => ({ ...current, [row.id]: level }))}
                      />
                      <span className="plan-level-code">{level}</span>
                      <span className="plan-level-label">{LEVEL_LABEL[level]}</span>
                    </label>
                  ))}
                </fieldset>
                {value !== undefined ? (
                  <p className="plan-descriptor">
                    <span className="plan-descriptor-dot" data-level={value} aria-hidden="true" />
                    <span>
                      {value > 0
                        ? row.descriptors[String(value) as "1" | "2" | "3" | "4"]
                        : "Пока не владею — это честный старт"}
                    </span>
                  </p>
                ) : null}
              </article>
            );
          })}
        </section>
      ))}

      {error ? (
        <p className="plan-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="plan-actions plan-actions--save">
        <button className="button" type="submit" disabled={busy || !complete}>
          {busy ? "Сохраняю…" : "Сохранить и посмотреть результат"}
          {!busy ? <span aria-hidden="true">→</span> : null}
        </button>
        <p className="small muted">Потом можно переоценить уровень и собрать матрицу заново.</p>
      </div>
    </form>
  );
}
