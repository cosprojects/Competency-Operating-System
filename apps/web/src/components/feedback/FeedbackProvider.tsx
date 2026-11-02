"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FeedbackDialog } from "./FeedbackDialog";

export type FeedbackType =
  | "CONTENT_ERROR"
  | "MISSING_COMPETENCY"
  | "BAD_MATERIAL"
  | "MISSING_FEATURE"
  | "IMPROVEMENT"
  | "GENERAL";

export interface FeedbackOptions {
  context?: "general" | "competency" | "source";
  type?: FeedbackType;
  targetType?: "COMPETENCY" | "SOURCE";
  targetId?: string;
  title?: string;
}

interface FeedbackContextValue {
  open: (options?: FeedbackOptions) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<FeedbackOptions | null>(null);
  const open = useCallback((next: FeedbackOptions = {}) => setOptions(next), []);
  const close = useCallback(() => setOptions(null), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackDialog options={options} onClose={close} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback должен использоваться внутри FeedbackProvider");
  return context;
}
