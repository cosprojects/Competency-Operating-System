"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CookieModalLink } from "@/components/CookieModal";

/** Подвал сайта по новому макету 369-14582. */
export function SiteFooter() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session")
      .then((response) => (response.ok ? response.json() : { authed: false }))
      .then((data: { authed?: boolean }) => {
        if (!cancelled) setAuthed(Boolean(data.authed));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="site-footer">
      <div className="footer2-inner">
        <div className="footer2-left">
          <div className="footer2-legal">
            <Link href="/legal/privacy">Политика конфиденциальности</Link>
            <Link href="/legal/terms">Условия использования</Link>
          </div>
          <p>Операционная система человеческого развития</p>
          <p>© 2026 Все права защищены.</p>
        </div>

        <div className="footer2-center">
          <img src="/brand/Footer/logo-mark-footer.svg" alt="" aria-hidden="true" className="footer2-logo" />
        </div>

        <div className="footer2-right">
          <div className="footer2-nav">
            <Link href="/">Главная</Link>
            <Link href="/professions">Профессии</Link>
            <Link href="/feedback">Ваш фидбек</Link>
            {authed ? <Link href="/account">Аккаунт</Link> : <Link href="/login">Войти</Link>}
          </div>
          <div className="footer2-nav footer2-nav-sub">
            <a href="https://t.me/myaxiona" target="_blank" rel="noopener noreferrer">
              Мой телеграм
            </a>
            <a href="https://www.axiona.world/en" target="_blank" rel="noopener noreferrer">
              Сайт компании
            </a>
            <CookieModalLink />
          </div>
          <a className="footer2-mail" href="mailto:hi.axiona@protonmail.com">
            hi.axiona@protonmail.com
          </a>
        </div>
      </div>

      <img
        className="footer2-wordmark"
        src="/brand/Footer/wordmark-footer.svg"
        alt=""
        aria-hidden="true"
      />
    </footer>
  );
}
