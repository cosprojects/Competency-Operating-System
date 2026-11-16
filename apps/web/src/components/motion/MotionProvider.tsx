"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { startPointerTracking } from "@/lib/motion/pointer";
import { prepareReveals } from "@/lib/motion/reveal";
import { REDUCED_MOTION_QUERY } from "@/lib/motion/tokens";

/**
 * Владелец движения в приложении (COS-EAR-016).
 *
 * Ничего не рендерит от себя и не хранит состояние: включает трекер курсора,
 * ставит `data-motion` на `<html>` (по нему CSS решает, применять ли параллакс
 * и входные анимации) и заново готовит появление секций после смены маршрута.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    root.dataset.motion = reduced ? "off" : "on";
    if (reduced) {
      return () => {
        delete root.dataset.motion;
      };
    }

    const stopPointer = startPointerTracking();
    return () => {
      stopPointer();
      delete root.dataset.motion;
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    let cleanup = () => {};
    // Кадр после коммита: к этому моменту раскладка новая, а первый экран уже
    // отрисован — прятать видимое не нужно и вредно.
    const frame = window.requestAnimationFrame(() => {
      cleanup = prepareReveals(document);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      cleanup();
    };
  }, [pathname]);

  return <>{children}</>;
}
