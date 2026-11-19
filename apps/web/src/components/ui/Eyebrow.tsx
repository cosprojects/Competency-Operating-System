import type { ElementType, ReactNode } from "react";

/** Единый eyebrow системы: accent, uppercase, 11/17 800. */
export function Eyebrow({
  children,
  className,
  as: Tag = "p",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return <Tag className={`eyebrow${className ? ` ${className}` : ""}`}>{children}</Tag>;
}
