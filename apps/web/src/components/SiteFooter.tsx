import Link from "next/link";

/**
 * Подвал сайта по макету Footer/ru (2:10328): тёмная полоса, слева — правовая
 * информация, по центру — знак и крупный логотип, справа — навигация и контакты.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-left">
          <div className="site-footer-legal">
            <Link href="/legal/privacy">Политика конфиденциальности</Link>
            <Link href="/legal/terms">Условия использования</Link>
          </div>
          <p>Операционная система человеческого развития</p>
          <p>© 2026 Все права защищены.</p>
        </div>

        <div className="site-footer-mark">
          <img src="/brand/logo-mark-white.svg" alt="" width={162} height={154} />
        </div>

        <div className="site-footer-right">
          <div className="site-footer-nav">
            <Link href="/">Главная</Link>
            <Link href="/professions">Направления</Link>
            <Link href="/feedback">Ваш фидбек</Link>
            <Link href="/login">Войти</Link>
          </div>
          <div className="site-footer-nav">
            <a href="https://t.me/myaxiona" target="_blank" rel="noopener noreferrer">
              Мой телеграм
            </a>
            <a href="https://www.axiona.world/en" target="_blank" rel="noopener noreferrer">
              Сайт компании
            </a>
            <Link href="/legal/cookies">Cookies</Link>
          </div>
          <a className="site-footer-mail" href="mailto:hi.axiona@protonmail.com">
            hi.axiona@protonmail.com
          </a>
        </div>
      </div>

      <img
        className="site-footer-wordmark"
        src="/brand/Footer/big-logo-footer.svg"
        alt=""
        aria-hidden="true"
      />
    </footer>
  );
}
