"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFeedback, type FeedbackOptions } from "./FeedbackProvider";

export function FeedbackTrigger({
  options,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  options?: FeedbackOptions;
  children: ReactNode;
}) {
  const { open } = useFeedback();
  return (
    <button type="button" {...rest} onClick={() => open(options)}>
      {children}
    </button>
  );
}
