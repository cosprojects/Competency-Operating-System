import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMagicLinkEmail } from "../apps/web/src/lib/email-templates/magic-link.ts";
import { renderWelcomeEmail } from "../apps/web/src/lib/email-templates/welcome.ts";

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
