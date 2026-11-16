"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconBox,
  IconCat,
  IconChart,
  IconCloseSquare,
  IconHome,
  IconHomeAdd,
  IconMenu,
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
  { href: "/", label: "Главная", icon: IconHome, match: (p: string) => p === "/" },
  {
    href: "/professions",
    label: "Направления",
    icon: IconStructure,
    match: (p: string) => p === "/professions" || p.startsWith("/professions/"),
  },
  {
    href: "/saved",
    label: "Сохранённое",
    icon: IconStarCircle,
    match: (p: string) => p === "/saved" || p.startsWith("/saved/"),
  },
];

const ADMIN_ITEMS = [
  {
    href: "/admin/materials",
    label: "Материалы",
    icon: IconBox,
    match: (p: string) => p.startsWith("/admin/materials") || p === "/admin",
  },
  {
    href: "/admin/metrics",
    label: "Аналитика",
    icon: IconChart,
    match: (p: string) => p.startsWith("/admin/metrics"),
  },
  {
    href: "/admin/users",
    label: "Пользователи",
    icon: IconUsers,
    match: (p: string) => p.startsWith("/admin/users"),
  },
];

/** Мобильная навигация: нижняя панель с бургером и меню снизу по контенту. */
export function MobileNav({ user }: { user: ShellUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const items = user?.isAdmin ? [...ITEMS, ...ADMIN_ITEMS] : ITEMS;

  return (
    <>
      <div className="mobile-nav">
        <div className="mobile-nav-bar">
          <Link className="mobile-nav-brand" href="/" aria-label="AXIONA — на главную">
            <img className="brand-mark" src="/brand/logo-mark.svg" alt="" width={34} height={32} />
          </Link>
          <img
            className="mobile-nav-wordmark"
            src="/brand/logo-wordmark.svg"
            alt="AXIONA"
            width={107}
            height={18}
          />
          <button
            className="mobile-nav-burger"
            type="button"
            aria-label="Открыть меню"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <IconMenu />
          </button>
        </div>
      </div>

      {open ? (
        <>
          <div className="mobile-nav-backdrop" onClick={() => setOpen(false)} role="presentation" />
          <nav className="mobile-nav mobile-nav-panel" aria-label="Мобильная навигация">
            <ul className="mobile-nav-list">
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.match(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      className={`mobile-nav-item${active ? " is-active" : ""}`}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <Icon />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  className="mobile-nav-item"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setWhyOpen(true);
                  }}
                >
                  <IconQuestion />
                  Зачем это?
                </button>
              </li>
              <li>
                <Link className="mobile-nav-item" href="/feedback" onClick={() => setOpen(false)}>
                  <IconPlaster />
                  Ваш фидбек
                </Link>
              </li>
              {user ? (
                <li>
                  <button
                    className="mobile-nav-item"
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setAccountOpen(true);
                    }}
                  >
                    <IconCat />
                    Аккаунт
                  </button>
                </li>
              ) : (
                <li>
                  <Link className="mobile-nav-item" href="/login" onClick={() => setOpen(false)}>
                    <IconHomeAdd />
                    Войти
                  </Link>
                </li>
              )}
            </ul>

            <div className="mobile-nav-bottom">
              <img className="brand-mark" src="/brand/logo-mark.svg" alt="" width={34} height={32} />
              <img
                className="mobile-nav-wordmark"
                src="/brand/logo-wordmark.svg"
                alt="AXIONA"
                width={107}
                height={18}
              />
              <button
                className="mobile-nav-close"
                type="button"
                aria-label="Закрыть меню"
                onClick={() => setOpen(false)}
              >
                <IconCloseSquare />
              </button>
            </div>
          </nav>
        </>
      ) : null}

      {user ? (
        <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} email={user.email} />
      ) : null}
      <WhyDialog open={whyOpen} onClose={() => setWhyOpen(false)} />
    </>
  );
}
