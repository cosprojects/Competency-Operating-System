import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_LEGAL_VERSION,
  hashToken,
  newToken,
  normalizeEmail,
  rateLimit,
  requestIpHashValues,
  safeReturnTo,
  sameOriginValues,
  shouldSendLink,
} from "../apps/web/src/lib/auth-core.ts";

describe("auth-core: email и токены", () => {
  it("нормализует адрес: trim и нижний регистр", () => {
    assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
  });

  it("хеширует токен детерминированно и необратимо", () => {
    const raw = "token-value";
    assert.equal(hashToken(raw), hashToken(raw));
    assert.notEqual(hashToken(raw), hashToken(`${raw}2`));
    assert.match(hashToken(raw), /^[0-9a-f]{64}$/);
    assert.equal(hashToken(raw).includes(raw), false);
  });

  it("генерирует разные токены достаточной длины", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => newToken()));
    assert.equal(tokens.size, 20);
    for (const token of tokens) assert.ok(token.length >= 40, token);
  });

  it("держит версию legal по умолчанию", () => {
    assert.equal(DEFAULT_LEGAL_VERSION, "1.0.0");
  });
});

describe("auth-core: safeReturnTo", () => {
  it("оставляет внутренние пути", () => {
    assert.equal(safeReturnTo("/competencies/ux-research"), "/competencies/ux-research");
    assert.equal(safeReturnTo("/saved?q=ux"), "/saved?q=ux");
  });

  it("не пускает наружу и в технические маршруты", () => {
    assert.equal(safeReturnTo(undefined), "/saved");
    assert.equal(safeReturnTo(""), "/saved");
    assert.equal(safeReturnTo("https://evil.example"), "/saved");
    assert.equal(safeReturnTo("//evil.example"), "/saved");
    assert.equal(safeReturnTo("/\\evil.example"), "/saved");
    assert.equal(safeReturnTo("/api/auth/request"), "/saved");
    assert.equal(safeReturnTo("/auth/verify"), "/saved");
    assert.equal(safeReturnTo("/saved\n"), "/saved");
  });
});

describe("auth-core: rateLimit", () => {
  it("считает в окне и сбрасывается после него", () => {
    const key = `test-limit-${Math.random()}`;
    assert.equal(rateLimit(key, 2, 1000, 1_000), true);
    assert.equal(rateLimit(key, 2, 1000, 1_100), true);
    assert.equal(rateLimit(key, 2, 1000, 1_200), false);
    assert.equal(rateLimit(key, 2, 1000, 2_001), true);
  });

  it("изолирует ключи", () => {
    const suffix = Math.random();
    assert.equal(rateLimit(`a-${suffix}`, 1, 1000, 5_000), true);
    assert.equal(rateLimit(`a-${suffix}`, 1, 1000, 5_100), false);
    assert.equal(rateLimit(`b-${suffix}`, 1, 1000, 5_100), true);
  });
});

describe("auth-core: origin и IP", () => {
  it("пропускает пустой origin и совпадающие origin", () => {
    assert.equal(sameOriginValues(null, "https://app.example/login"), true);
    assert.equal(sameOriginValues("https://app.example", "https://app.example/login"), true);
    assert.equal(
      sameOriginValues("https://app.example", "https://internal.example/login", "https://app.example"),
      true,
    );
  });

  it("отклоняет чужой origin", () => {
    assert.equal(sameOriginValues("https://evil.example", "https://app.example/login"), false);
  });

  it("хэширует IP стабильно и без сырого адреса", () => {
    const a = requestIpHashValues("1.2.3.4, 5.6.7.8", null, "salt");
    const b = requestIpHashValues("1.2.3.4", null, "salt");
    const c = requestIpHashValues("1.2.3.4", null, "other-salt");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^[0-9a-f]{32}$/);
    assert.equal(a.includes("1.2.3.4"), false);
    assert.equal(requestIpHashValues(null, "9.9.9.9", "salt"), requestIpHashValues(null, "9.9.9.9", "salt"));
    assert.equal(requestIpHashValues(null, null, "salt").length, 32);
  });
});

describe("auth-core: политики регистрации", () => {
  it("шлёт ссылку при открытой регистрации любому", () => {
    assert.equal(shouldSendLink({ registrationDisabled: false, userExists: false }), true);
    assert.equal(shouldSendLink({ registrationDisabled: false, userExists: true }), true);
  });

  it("при выключенной регистрации шлёт только существующим", () => {
    assert.equal(shouldSendLink({ registrationDisabled: true, userExists: false }), false);
    assert.equal(shouldSendLink({ registrationDisabled: true, userExists: true }), true);
  });
});
