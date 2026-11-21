"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

  // Старые ссылки на /feedback ведут на «/?feedback=1»: открываем диалог сразу
  // и убираем параметр из адреса, чтобы он не открывался при каждом обновлении.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("feedback") !== "1") return;
    params.delete("feedback");
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
    );
    setOptions({});
  }, []);

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
