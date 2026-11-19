import Link from "next/link";

export type PlanStepKey = "profession" | "grade" | "assess" | "result";

const STEPS: Array<{ key: PlanStepKey; label: string; short: string }> = [
  { key: "profession", label: "Профессия", short: "Роль" },
  { key: "grade", label: "Грейд", short: "Грейд" },
  { key: "assess", label: "Самооценка", short: "Оценка" },
  { key: "result", label: "Результат", short: "Итог" },
];

/** Четыре шага «Плана». Это индикатор, а не отдельные обязательные экраны. */
export function PlanStepper({
  current,
  links,
}: {
  current: PlanStepKey;
  links?: Partial<Record<PlanStepKey, string>>;
}) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);
  return (
    <nav className="plan-stepper" aria-label="Шаги плана">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const href = links?.[step.key];
        const content = (
          <>
            <span className="plan-stepper-marker" aria-hidden="true">
              {done ? "✓" : index + 1}
            </span>
            <span className="plan-stepper-label">{step.label}</span>
            <span className="plan-stepper-short">{step.short}</span>
          </>
        );
        return (
          <div
            className={`plan-stepper-item${done ? " is-done" : ""}${active ? " is-active" : ""}`}
            key={step.key}
            aria-current={active ? "step" : undefined}
          >
            {href && !active ? (
              <Link className="plan-stepper-link" href={href}>
                {content}
              </Link>
            ) : (
              <span className="plan-stepper-link">{content}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
