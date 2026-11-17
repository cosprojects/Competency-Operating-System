"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CookieModalLink } from "@/components/CookieModal";

/** Подвал сайта по макету Footer/ru: правовая информация, знак и навигация. */
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

  return (    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-left">
          <div className="site-footer-legal">
            <Link href="/legal/privacy">Политика конфиденциальности</Link>
            <Link href="/legal/terms">Условия использования</Link>
          </div>
          <p>Операционная система человеческого развития</p>
          <p>© 2026 Все права защищены.</p>
          <p className="site-footer-operator">Невзоров Кирилл Игоревич, ИНН 480708141554</p>
        </div>

        <div className="site-footer-right">
          <div className="site-footer-nav">
            <Link href="/">Главная</Link>
            <Link href="/professions">Направления</Link>
            <Link href="/feedback">Ваш фидбек</Link>
            {authed ? <Link href="/account">Аккаунт</Link> : <Link href="/login">Войти</Link>}
          </div>
          <div className="site-footer-nav">
            <a href="https://t.me/myaxiona" target="_blank" rel="noopener noreferrer">
              Мой телеграм
            </a>
            <a href="https://www.axiona.world/en" target="_blank" rel="noopener noreferrer">
              Сайт компании
            </a>
            <CookieModalLink />
          </div>
          <a className="site-footer-mail" href="mailto:hi.axiona@protonmail.com">
            hi.axiona@protonmail.com
          </a>
        </div>
      </div>

      <img
        className="site-footer-wordmark"
        src="/brand/Footer/logo-3.svg"
        alt=""
        aria-hidden="true"
      />
    </footer>
  );
}
