import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMagicLinkEmail } from "../apps/web/src/lib/email-templates/magic-link.ts";
import { renderWelcomeEmail } from "../apps/web/src/lib/email-templates/welcome.ts";
import {
  renderEmailChangeEmail,
  renderEmailChangedNoticeEmail,
} from "../apps/web/src/lib/email-templates/email-change.ts";
import { renderFeedbackNotificationEmail } from "../apps/web/src/lib/email-templates/feedback.ts";

const base = {
  url: "https://app.axiona.world/auth/verify?token=abc123&next=%2Fsaved",
  expiresText: "30 дней",
  supportEmail: "hi.axiona@protonmail.com",
  privacyUrl: "https://app.axiona.world/legal/privacy",
  logoUrl: "https://app.axiona.world/brand/email-logo.png",
};

describe("magic link email template", () => {
  it("возвращает тему, текст и HTML с кнопкой и запасной ссылкой", () => {
    const rendered = renderMagicLinkEmail(base);
    assert.match(rendered.subject, /AXIONA/);
    assert.match(rendered.text, /auth\/verify\?token=abc123/);
    assert.match(rendered.text, /30 дней/);
    assert.equal((rendered.html.match(/href="https:\/\/app\.axiona\.world\/auth\/verify/g) ?? []).length, 2);
    assert.match(rendered.html, /Войти в AXIONA/);
    assert.match(rendered.html, /Политика конфиденциальности/);
    assert.match(rendered.html, /brand\/email-logo\.png/);
    assert.match(rendered.html, /hi\.axiona@protonmail\.com/);
    assert.match(rendered.html, /30 дней/);
  });

  it("экранирует спецсимволы и не пропускает сырые теги", () => {
    const rendered = renderMagicLinkEmail({
      ...base,
      url: "https://app.axiona.world/auth/verify?token=a&b=<script>alert(1)</script>",
      supportEmail: 'support@example.com"><script>',
    });
    assert.match(rendered.html, /&amp;b=/);
    assert.doesNotMatch(rendered.html, /<script>alert/);
    assert.match(rendered.html, /support@example\.com&quot;&gt;&lt;script&gt;/);
  });

  it("в текстовой версии есть ссылка, срок и поддержка", () => {
    const rendered = renderMagicLinkEmail(base);
    assert.ok(rendered.text.includes(base.url));
    assert.ok(rendered.text.includes("30 дней"));
    assert.ok(rendered.text.includes("Нужна помощь"));
    assert.ok(rendered.text.includes("Политика конфиденциальности"));
  });
});

describe("welcome email template", () => {
  const input = {
    appUrl: "https://app.axiona.world",
    supportEmail: "hi.axiona@protonmail.com",
    privacyUrl: "https://app.axiona.world/legal/privacy",
    logoUrl: "https://app.axiona.world/brand/email-logo.png",
  };

  it("использует ту же вёрстку с кнопкой: логотип, заголовок, кнопка, подвал", () => {
    const rendered = renderWelcomeEmail(input);
    assert.equal(rendered.subject, "Аккаунт в AXIONA создан");
    assert.match(rendered.html, /<table role="presentation"/);
    assert.match(rendered.html, /brand\/email-logo\.png/);
    assert.match(rendered.html, /Аккаунт в AXIONA создан/);
    assert.match(rendered.html, /Выбрать профессию/);
    assert.match(rendered.html, /href="https:\/\/app\.axiona\.world\/professions"/);
    assert.match(rendered.html, /Политика конфиденциальности/);
    assert.match(rendered.html, /hi\.axiona@protonmail\.com/);
    // Кнопка — та же, что в письме входа: цвет и скругление каркаса.
    assert.match(rendered.html, /background-color:#4f46e5/);
    assert.match(rendered.html, /border-radius:12px/);
  });

  it("в текстовой версии есть кнопка-ссылка, сохранённое и поддержка", () => {
    const rendered = renderWelcomeEmail(input);
    assert.ok(rendered.text.includes("Выбрать профессию: https://app.axiona.world/professions"));
    assert.ok(rendered.text.includes("Сохранённое: https://app.axiona.world/saved"));
    assert.ok(rendered.text.includes("hi.axiona@protonmail.com"));
    assert.ok(rendered.text.includes("Политика конфиденциальности"));
  });

  it("не теряет корректный адрес, если APP_URL с завершающим слэшем", () => {
    const rendered = renderWelcomeEmail({ ...input, appUrl: "https://app.axiona.world/" });
    assert.match(rendered.html, /href="https:\/\/app\.axiona\.world\/professions"/);
    assert.doesNotMatch(rendered.html, /axiona\.world\/\/professions/);
  });

  it("экранирует служебные адреса", () => {
    const rendered = renderWelcomeEmail({
      ...input,
      supportEmail: 'support@example.com"><script>',
      logoUrl: 'https://app.axiona.world/brand/x.png" onerror="alert(1)',
    });
    assert.doesNotMatch(rendered.html, /<script>alert/);
    assert.doesNotMatch(rendered.html, /onerror="alert/);
  });
});

describe("email change templates", () => {
  const baseInput = {
    supportEmail: "hi.axiona@protonmail.com",
    privacyUrl: "https://app.axiona.world/legal/privacy",
    logoUrl: "https://app.axiona.world/brand/email-logo.png",
  };

  it("подтверждение нового адреса: каркас с кнопкой и ссылкой", () => {
    const rendered = renderEmailChangeEmail({
      ...baseInput,
      url: "https://app.axiona.world/auth/email-change?token=abc",
    });
    assert.equal(rendered.subject, "Подтверждение нового адреса в AXIONA");
    assert.match(rendered.html, /email-button/);
    assert.match(rendered.html, /href="https:\/\/app\.axiona\.world\/auth\/email-change\?token=abc"/);
    assert.match(rendered.html, /Подтвердить адрес/);
    assert.ok(rendered.text.includes("https://app.axiona.world/auth/email-change?token=abc"));
    assert.ok(rendered.text.includes("15 минут"));
  });

  it("уведомление старому адресу: новый email и завершение сессий", () => {
    const rendered = renderEmailChangedNoticeEmail({
      ...baseInput,
      appUrl: "https://app.axiona.world",
      newEmail: "new-address@example.com",
    });
    assert.equal(rendered.subject, "Адрес в AXIONA изменён");
    assert.match(rendered.html, /Адрес изменён/);
    assert.match(rendered.html, /new-address@example\.com/);
    assert.match(rendered.html, /Все сессии завершены/);
    assert.match(rendered.html, /href="https:\/\/app\.axiona\.world"/);
    assert.ok(rendered.text.includes("new-address@example.com"));
  });

  it("экранирует новый email в уведомлении", () => {
    const rendered = renderEmailChangedNoticeEmail({
      ...baseInput,
      appUrl: "https://app.axiona.world",
      newEmail: 'bad@example.com<script>alert(1)</script>',
    });
    assert.doesNotMatch(rendered.html, /<script>alert/);
    assert.match(rendered.html, /bad@example\.com&lt;script&gt;/);
  });
});

describe("feedback notification template", () => {
  it("переводит отзыв в каркас с кнопкой в админку", () => {
    const rendered = renderFeedbackNotificationEmail({
      appUrl: "https://app.axiona.world",
      privacyUrl: "https://app.axiona.world/legal/privacy",
      logoUrl: "https://app.axiona.world/brand/email-logo.png",
      type: "material",
      rating: 4,
      comment: "Полезно, но мало примеров.",
      contactEmail: "reader@example.com",
      pagePath: "/professions/uxui",
      targetType: "COMPETENCY",
      targetId: "ux-design-thinking",
    });
    assert.equal(rendered.subject, "AXIONA: новый отзыв");
    assert.match(rendered.html, /email-button/);
    assert.match(rendered.html, /href="https:\/\/app\.axiona\.world\/admin\/feedback"/);
    assert.match(rendered.html, /Полезно, но мало примеров/);
    assert.match(rendered.html, /reader@example\.com/);
    assert.ok(rendered.text.includes("Тип: material"));
    assert.ok(rendered.text.includes("Страница: /professions/uxui"));
  });

  it("экранирует текст комментария и сохраняет переносы строк", () => {
    const rendered = renderFeedbackNotificationEmail({
      appUrl: "https://app.axiona.world",
      privacyUrl: "https://app.axiona.world/legal/privacy",
      logoUrl: "https://app.axiona.world/brand/email-logo.png",
      type: "idea",
      comment: "Первая строка\n<script>alert(1)</script>",
      pagePath: "/saved",
    });
    assert.doesNotMatch(rendered.html, /<script>alert/);
    assert.match(rendered.html, /&lt;script&gt;alert/);
    assert.match(rendered.html, /Первая строка<br\/>/);
  });
});
