"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  IconBox,
  IconChart,
  IconHome,
  IconHomeAdd,
  IconPlaster,
  IconQuestion,
  IconStarCircle,
  IconStructure,
  IconUsers,
} from "@/components/icons";
import { AccountDialog } from "@/components/account/AccountDialog";
import { WhyDialog } from "@/components/WhyDialog";
import type { ShellUser } from "@/components/AppShell";

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
    label: "Сохранённое",
    icon: IconStarCircle,
    match: (pathname: string) => pathname === "/saved" || pathname.startsWith("/saved/"),
  },
];

const ADMIN_ITEMS = [
  {
    href: "/admin/materials",
    label: "Материалы",
    icon: IconBox,
    match: (pathname: string) => pathname.startsWith("/admin/materials") || pathname === "/admin",
  },
  {
    href: "/admin/metrics",
    label: "Аналитика",
    icon: IconChart,
    match: (pathname: string) => pathname.startsWith("/admin/metrics"),
  },
  {
    href: "/admin/users",
    label: "Пользователи",
    icon: IconUsers,
    match: (pathname: string) => pathname.startsWith("/admin/users"),
  },
];

export function NavRail({ user }: { user: ShellUser | null }) {
  const pathname = usePathname();
  const isCanvas = /^\/professions\/[^/]+$/.test(pathname);
  const expanded = !isCanvas;
  const railRef = useRef<HTMLElement | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  // Нижняя часть рейла останавливается за 40px до футера: при скролле меню
  // не заходит на подвал, а сжимается по высоте.
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
          {user?.isAdmin
            ? ADMIN_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    className={`rail-item rail-item--admin${active ? " is-active" : ""}`}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                  >
                    <Icon />
                    <span className="rail-label">{item.label}</span>
                  </Link>
                );
              })
            : null}
        </nav>
      </div>

      <div className="rail-bottom">
        <button className="rail-item rail-item--why" type="button" title="Зачем это?" onClick={() => setWhyOpen(true)}>
          <IconQuestion />
          <span className="rail-label">Зачем это?</span>
        </button>

        <Link className="rail-item" href="/feedback" title="Ваш фидбек">
          <IconPlaster />
          <span className="rail-label">Ваш фидбек</span>
        </Link>

        {user ? (
          <button
            className="rail-cta"
            type="button"
            title={`Аккаунт ${user.email}`}
            onClick={() => setAccountOpen(true)}
          >
            <IconHomeAdd />
            <span className="rail-label">Аккаунт</span>
          </button>
        ) : (
          <Link className="rail-cta" href="/login" title="Войти">
            <IconHomeAdd />
            <span className="rail-label">Войти</span>
          </Link>
        )}
      </div>

      {user ? (
        <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} email={user.email} />
      ) : null}
      <WhyDialog open={whyOpen} onClose={() => setWhyOpen(false)} />
    </aside>
  );
}
