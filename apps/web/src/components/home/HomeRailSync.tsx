"use client";

import { useEffect } from "react";

/**
 * Высота правого рейла главной равна высоте основного блока с контентом:
 * лог обновлений не растягивает страницу, а прокручивается внутри.
 */
export function HomeRailSync() {
  useEffect(() => {
    const rail = document.querySelector<HTMLElement>(".home-rail");
    const workspace = document.querySelector<HTMLElement>(".home-layout .workspace");
    if (!rail || !workspace) return;

    const desktop = window.matchMedia("(min-width: 1181px)");

    const update = () => {
      if (!desktop.matches) {
        rail.style.removeProperty("height");
        return;
      }
      const height = Math.max(520, Math.round(workspace.getBoundingClientRect().height));
      rail.style.height = `${height}px`;
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(workspace);
    desktop.addEventListener("change", update);

    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", update);
      rail.style.removeProperty("height");
    };
  }, []);

  return null;
}
