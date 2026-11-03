"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <aside className={`nav-rail${expanded ? "" : " is-mini"}`} aria-label="Основная навигация">
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
