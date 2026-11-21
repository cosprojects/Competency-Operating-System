"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFeedback, type FeedbackOptions } from "./FeedbackProvider";

/**
 * Кнопка, которая открывает модалку обратной связи.
 * Свой onClick выполняется первым — например, чтобы закрыть мобильное меню.
 */
export function FeedbackTrigger({
  options,
  children,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  options?: FeedbackOptions;
  children: ReactNode;
}) {
  const { open } = useFeedback();
  return (
    <button
      type="button"
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        open(options);
      }}
    >
      {children}
    </button>
  );
}
