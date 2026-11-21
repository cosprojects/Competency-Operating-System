"use client";

import type { ReactNode } from "react";
import { PrimaryCta } from "@/components/ui/PrimaryCta";
import { useFeedback, type FeedbackOptions } from "./FeedbackProvider";

/** Главная кнопка-действие, которая открывает модалку обратной связи. */
export function FeedbackCta({
  className,
  children,
  options,
}: {
  className?: string;
  children: ReactNode;
  options?: FeedbackOptions;
}) {
  const { open } = useFeedback();
  return (
    <PrimaryCta type="button" className={className} onClick={() => open(options)}>
      {children}
    </PrimaryCta>
  );
}
