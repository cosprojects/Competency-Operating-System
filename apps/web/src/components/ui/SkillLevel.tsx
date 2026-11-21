import type { MatrixLevel } from "../../../../../src/methodology/v1/matrix/logic";

/** Сегмент шкалы: индекс = уровень, который он обозначает. */
const SEGMENTS: MatrixLevel[] = [1, 2, 3, 4];

/**
 * Шкала уровня навыка из макета (компонент «measure», node 474:11255).
 *
 * Четыре сегмента 10×24, зазор 2. Сегменты до текущего уровня залиты цветом
 * своего уровня (Figma: заливка с opacity 0.5), пустые — светло-синие.
 * Целевой уровень помечается синей обводкой 1 px внутри сегмента.
 */
export function SkillLevel({
  level,
  target,
  label,
  className,
}: {
  level: MatrixLevel;
  /** Цель по уровню: сегмент получает обводку --accent. */
  target?: MatrixLevel;
  /** Подпись для скринридера; по умолчанию собирается из уровня и цели. */
  label?: string;
  className?: string;
}) {
  const safe = (level >= 0 && level <= 4 ? level : 0) as MatrixLevel;
  const caption =
    label ??
    (safe === 0
      ? `Уровень не задан${target ? `, цель ${target}` : ""}`
      : `Уровень ${safe} из 4${target ? `, цель ${target}` : ""}`);

  return (
    <span className={`skill-level${className ? ` ${className}` : ""}`} role="img" aria-label={caption}>
      {SEGMENTS.map((segment) => (
        <span
          key={segment}
          className={`skill-level-bar${segment <= safe ? ` is-level-${segment}` : ""}${
            segment === target ? " is-target" : ""
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
