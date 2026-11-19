import type { ReactNode } from "react";

/** Aside «Следующий шаг» из «Изучаю»; используется в «Плане». */
export function NextStepCard({
  label = "Следующий шаг",
  title,
  children,
  note,
  className,
  titleId,
}: {
  label?: string;
  title: ReactNode;
  children: ReactNode;
  note?: ReactNode;
  className?: string;
  titleId?: string;
}) {
  return (
    <aside className={`learning-next${className ? ` ${className}` : ""}`}>
      <span className="learning-next-label">{label}</span>
      <h4 id={titleId}>{title}</h4>
      {children}
      {note ? <span className="learning-next-note">{note}</span> : null}
    </aside>
  );
}
