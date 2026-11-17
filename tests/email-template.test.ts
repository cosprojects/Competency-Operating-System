import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMagicLinkEmail } from "../apps/web/src/lib/email-templates/magic-link.ts";

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
