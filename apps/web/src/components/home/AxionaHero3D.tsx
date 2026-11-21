"use client";

import { useEffect, useRef } from "react";

import styles from "./AxionaHero3D.module.css";

type AxionaHeroModule = typeof import("@/vendor/axiona-hero/axiona-hero.esm.js");

/**
 * Реалтайм 3D-фигура героя главной (WebGL, three.js).
 *
 * Заменяет фоновое видео: тот же силуэт и свет, но сцена живая — сфера
 * реагирует на курсор, спутники дышат, вне вьюпорта рендер встаёт на паузу.
 *
 * Бандл грузится динамическим импортом, поэтому не попадает в основной
 * клиентский чанк и не задерживает гидрацию. Пока сцена не готова (или если
 * WebGL недоступен) виден статичный постер из CSS (::after контейнера).
 */
export function AxionaHero3D({
  className,
  theme = "light",
}: {
  className?: string;
  theme?: "light" | "dark";
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // На экранах ≤1280px сцену не поднимаем: там фигура скрыта (CSS модуля),
    // а WebGL не должен отнимать кадры у прокрутки.
    if (window.matchMedia("(max-width: 1280px)").matches) return;

    let disposed = false;
    let hero: import("@/vendor/axiona-hero/axiona-hero.esm.js").AxionaHeroInstance | null = null;
    let resumeTimer = 0;

    // Прокрутка: сцена рендерится каждый кадр и на главной отнимает кадры у
    // скролла (катится только она — остальные страницы без WebGL). На время
    // прокрутки останавливаем рендер и запускаем его снова через 200 мс после
    // остановки. Прокрутка всё равно идёт композитом, анимированная фигура
    // успевает восстановиться до того, как это станет заметно.
    const onScroll = () => {
      if (!hero) return;
      hero.pause();
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        resumeTimer = 0;
        if (!disposed) hero?.play();
      }, 200);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    void (async () => {
      try {
        // на сервере модуль не нужен и не должен попасть в SSR-бандл
        const mod = (await import(
          "@/vendor/axiona-hero/axiona-hero.esm.js"
        )) as AxionaHeroModule;

        if (disposed) return;

        hero = mod.createAxionaHero(host, {
          theme,
          // 2× DPR — это 4× пикселей на кадр: на встроенной графике сцена
          // заметно отнимала кадры у прокрутки. 1.5× визуально почти не отличить.
          dpr: Math.min(window.devicePixelRatio || 1, 1.5),
          parallax: 1,
          frame: 1.3,
        });

        await hero.ready;
        if (disposed) return;

        host.dataset.ready = "true";
      } catch (error) {
        // WebGL отключён, контекст не создался и т.п. — остаётся постер.
        if (process.env.NODE_ENV !== "production") {
          console.warn("[AxionaHero3D] 3D-фигура не запустилась, показываю постер", error);
        }
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(resumeTimer);
      window.removeEventListener("scroll", onScroll);
      hero?.destroy();
      hero = null;
      delete host.dataset.ready;
    };
  }, [theme]);

  const classes = className ? `${styles.figure} ${className}` : styles.figure;

  return <div ref={hostRef} className={classes} aria-hidden="true" />;
}
