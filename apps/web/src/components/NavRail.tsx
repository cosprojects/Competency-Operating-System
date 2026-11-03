"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  IconHome,
  IconHomeAdd,
  IconPlaster,
  IconStarCircle,
  IconStructure,
} from "@/components/icons";

const ITEMS = [
  { href: "/", label: "Главная", icon: IconHome, match: (pathname: string) => pathname === "/" },
  {
    href: "/professions",
    label: "Профессии",
    icon: IconStructure,
    match: (pathname: string) => pathname === "/professions" || pathname.startsWith("/professions/"),
  },
  {
    href: "/saved",
    label: "Избранное",
    icon: IconStarCircle,
    match: (pathname: string) => pathname === "/saved" || pathname.startsWith("/saved/"),
  },
];

export function NavRail({ user }: { user: { email: string } | null }) {
  const pathname = usePathname();
  const expanded = pathname === "/";
  const railRef = useRef<HTMLElement | null>(null);

  // Нижняя часть рейла останавливается за 40px до футера и рейл сжимается,
  // а не наезжает на тёмную подвал страницы.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const footer = document.querySelector<HTMLElement>(".site-footer");
      const viewport = window.innerHeight;
      let offset = 40;
      if (footer) {
        const rect = footer.getBoundingClientRect();
        offset = Math.max(40, Math.round(viewport - rect.top + 40));
      }
      document.documentElement.style.setProperty("--rail-bottom-offset", `${offset}px`);
      const rail = railRef.current;
      if (rail) {
        // Если рейл сжался сильнее, чем помещается контент — включаем компактный
        // режим: меньше отступы, чтобы нижние пункты остались на виду.
        const compressed = rail.scrollHeight > rail.clientHeight + 1;
        rail.classList.toggle("is-compact", compressed);
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty("--rail-bottom-offset");
      railRef.current?.classList.remove("is-compact");
    };
  }, [pathname]);

  return (
    <aside
      className={`nav-rail${expanded ? "" : " is-mini"}`}
      ref={railRef}
      aria-label="Основная навигация"
    >
      <div className="rail-top">
        <Link className="rail-brand" href="/" aria-label="AXIONA — на главную">
          <img className="brand-mark" src="/brand/logo-mark.svg" alt="" width={34} height={32} />
          <img
            className="brand-wordmark"
            src="/brand/logo-wordmark.svg"
            alt="AXIONA"
            width={107}
            height={18}
          />
        </Link>

        <nav className="rail-menu">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                className={`rail-item${active ? " is-active" : ""}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                <Icon />
                <span className="rail-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="rail-bottom">
        <Link className="rail-item" href="/feedback" title="Ваш фидбек">
          <IconPlaster />
          <span className="rail-label">Ваш фидбек</span>
        </Link>

        {user ? (
          <Link className="rail-cta" href="/account" title={`Аккаунт ${user.email}`}>
            <IconHomeAdd />
            <span className="rail-label">Аккаунт</span>
          </Link>
        ) : (
          <Link className="rail-cta" href="/login" title="Войти">
            <IconHomeAdd />
            <span className="rail-label">Войти</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
