"use client";

import { useEffect } from "react";

/** На 404 скрываем рейл, мобильное меню и футер — страница самодостаточная. */
export function NotFoundShell() {
  useEffect(() => {
    document.body.classList.add("not-found-active");
    return () => document.body.classList.remove("not-found-active");
  }, []);
  return null;
}
