"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  IconBox,
  IconCat,
  IconChart,
  IconHome,
  IconGraduation,
  IconGraphUp,
  IconHomeAdd,
  IconPlaster,
  IconQuestion,
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
    label: "Направления",
    icon: IconStructure,
    match: (pathname: string) => pathname === "/professions" || pathname.startsWith("/professions/"),
  },
  {
    href: "/saved",
    label: "Изучаю",
    icon: IconGraduation,
    match: (pathname: string) => pathname === "/saved" || pathname.startsWith("/saved/"),
  },
  {
    href: "/plan",
    label: "План",
    icon: IconGraphUp,
    match: (pathname: string) => pathname === "/plan" || pathname.startsWith("/plan/"),
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
  // Контентные страницы (схема профессии и выбор направления) — mini-рейл.
  const expanded = !isCanvas && pathname !== "/professions";
  const railRef = useRef<HTMLElement | null>(null);
  const hoverPillRef = useRef<HTMLDivElement | null>(null);
  const hoverGroupRef = useRef<"top" | "bottom" | null>(null);
  const hoverItemRef = useRef<HTMLElement | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  /**
   * Перетекающий ховер: одна голубая плашка едет по рейлу между пунктами.
   * Внутри блока (меню или низ рейла) она перетекает с небольшой задержкой и
   * «догоняет» курсор; между блоками — перелетает быстро, без задержки.
   * Позиция пишется в CSS-переменные напрямую, без ре-рендера.
   */
  function moveRailHover(element: HTMLElement) {
    const pill = hoverPillRef.current;
    if (!pill) return;
    if (hoverItemRef.current === element) return;
    hoverItemRef.current = element;

    const group: "top" | "bottom" = element.closest(".rail-bottom") ? "bottom" : "top";
    pill.classList.toggle("is-jumping", hoverGroupRef.current !== null && hoverGroupRef.current !== group);
    hoverGroupRef.current = group;

    pill.style.setProperty("--pill-x", `${element.offsetLeft}px`);
    pill.style.setProperty("--pill-y", `${element.offsetTop}px`);
    pill.style.setProperty("--pill-w", `${element.offsetWidth}px`);
    pill.style.setProperty("--pill-h", `${element.offsetHeight}px`);
    pill.classList.add("is-visible");
  }

  function hideRailHover() {
    hoverItemRef.current = null;
    hoverGroupRef.current = null;
    hoverPillRef.current?.classList.remove("is-visible");
  }

  function onRailPointerOver(event: React.PointerEvent<HTMLElement>) {
    const item = (event.target as HTMLElement).closest<HTMLElement>(".rail-item");
    // У «Войти/Аккаунт» своя заливка — плашку туда не ведём.
    if (!item || item.closest(".rail-cta")) {
      hideRailHover();
      return;
    }
    moveRailHover(item);
  }

  function onRailFocus(event: React.FocusEvent<HTMLElement>) {
    const item = (event.target as HTMLElement).closest<HTMLElement>(".rail-item");
    if (item && !item.closest(".rail-cta")) moveRailHover(item);
  }

  function onRailBlur(event: React.FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideRailHover();
  }

  // Смена маршрута меняет набор пунктов и ширину рейла — плашку убираем.
  useEffect(() => {
    hideRailHover();
  }, [pathname]);

  // Нижняя часть рейла останавливается за 40px до футера: при скролле меню
  // не заходит на подвал, а сжимается по высоте.
  useEffect(() => {
    const rail = railRef.current;
    const footer = document.querySelector<HTMLElement>(".site-footer");
    let frame = 0;
    let lastOffset = -1;

    // Высота, нужная рейлу в обычной плотности. Меряем один раз, сняв
    // .is-compact: сам класс меняет padding и gap, поэтому сравнение
    // scrollHeight > clientHeight создавало обратную связь — у футера рейл
    // сжимался, контент влезал, класс снимался, контент снова не влезал и так
    // по кадру (бесконечное дёрганье). Фиксированный порог петли не даёт.
    const measureRequiredHeight = (): number => {
      if (!rail) return 0;
      const wasCompact = rail.classList.contains("is-compact");
      rail.classList.remove("is-compact");
      const railStyles = window.getComputedStyle(rail);
      const px = (value: string) => Number.parseFloat(value) || 0;
      const children = Array.from(rail.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && window.getComputedStyle(child).position !== "absolute",
      );
      const content = children.reduce(
        (sum, child) => sum + child.getBoundingClientRect().height,
        0,
      );
      const required =
        content +
        px(railStyles.rowGap) * Math.max(0, children.length - 1) +
        px(railStyles.paddingTop) +
        px(railStyles.paddingBottom) +
        px(railStyles.borderTopWidth) +
        px(railStyles.borderBottomWidth);
      if (wasCompact) rail.classList.add("is-compact");
      return required;
    };

    let requiredHeight = measureRequiredHeight();

    // clientHeight рейла задаётся top/bottom и от плотности не зависит,
    // поэтому решение принимается по стабильному порогу, без мигания класса.
    const updateCompact = () => {
      if (!rail || requiredHeight <= 0) return;
      rail.classList.toggle("is-compact", rail.clientHeight < requiredHeight);
    };

    const updateOffset = () => {
      frame = 0;
      const viewport = window.innerHeight;
      let offset = 40;
      if (footer) {
        offset = Math.max(40, Math.round(viewport - footer.getBoundingClientRect().top + 40));
      }
      if (offset === lastOffset) return;
      lastOffset = offset;
      document.documentElement.style.setProperty("--rail-bottom-offset", `${offset}px`);
      updateCompact();
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(updateOffset);
    };

    const onResize = () => {
      requiredHeight = measureRequiredHeight();
      updateCompact();
      schedule();
    };

    updateOffset();
    updateCompact();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);

    // Шрифт и логотип догружаются после гидрации — порог пересчитываем.
    let cancelled = false;
    void document.fonts?.ready?.then(() => {
      if (cancelled) return;
      requiredHeight = measureRequiredHeight();
      updateCompact();
    });

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
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
      onPointerOver={onRailPointerOver}
      onPointerLeave={hideRailHover}
      onFocus={onRailFocus}
      onBlur={onRailBlur}
    >
      <div className="rail-hover-pill" ref={hoverPillRef} aria-hidden="true" />
      <div className="rail-top">
        <Link className="rail-brand" href="/" aria-label="AXIONA — на главную">
          {/* Развёрнутый рейл — новый лого-лок: знак + вордмарк одним фреймом (Brand.svg).
              Свёрнутый — только знак: отдельный ассет того же знака 34×32. */}
          <img className="brand-lockup" src="/brand/Brand.svg" alt="" width={148} height={31} />
          <img className="brand-mark" src="/brand/logo-mark.svg" alt="" width={34} height={32} />
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

        <Link className="rail-item" href="/feedback" title="Обратная связь">
          <IconPlaster />
          <span className="rail-label">Обратная связь</span>
        </Link>

        {user ? (
          <button
            className="rail-cta"
            type="button"
            title={`Аккаунт ${user.email}`}
            onClick={() => setAccountOpen(true)}
          >
            <IconCat />
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
