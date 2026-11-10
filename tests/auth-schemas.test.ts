import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emailChangeSchema, emailSchema, loginRequestSchema } from "../apps/web/src/lib/validation.ts";

describe("loginRequestSchema", () => {
  it("принимает валидный адрес без согласия: согласие фиксируется на шаге подтверждения", () => {
    const parsed = loginRequestSchema.safeParse({ email: "  User@Example.COM ", returnTo: "/saved" });
    assert.equal(parsed.success, true);
    assert.equal(parsed.success ? parsed.data.email : "", "user@example.com");
    assert.equal(parsed.success ? parsed.data.returnTo : "", "/saved");
  });

  it("пропускает лишние поля, включая honeypot", () => {
    const parsed = loginRequestSchema.safeParse({ email: "a@b.co", website: "spam" });
    assert.equal(parsed.success, true);
    assert.equal(parsed.success && "website" in parsed.data, false);
  });

  it("отклоняет пустой и невалидный адрес", () => {
    assert.equal(loginRequestSchema.safeParse({}).success, false);
    assert.equal(loginRequestSchema.safeParse({ email: "" }).success, false);
    assert.equal(loginRequestSchema.safeParse({ email: "not-an-email" }).success, false);
    assert.equal(loginRequestSchema.safeParse({ email: "a@b" }).success, false);
  });

  it("ограничивает длину адреса и returnTo", () => {
    assert.equal(loginRequestSchema.safeParse({ email: `${"a".repeat(250)}@example.com` }).success, false);
    assert.equal(
      loginRequestSchema.safeParse({ email: "a@b.co", returnTo: `/${"a".repeat(300)}` }).success,
      false,
    );
  });
});

describe("emailSchema и emailChangeSchema", () => {
  it("нормализует адрес", () => {
    assert.equal(emailSchema.parse("  A@B.CO "), "a@b.co");
  });

  it("проверяет новый адрес для смены email", () => {
    assert.equal(emailChangeSchema.safeParse({ newEmail: "new@example.com" }).success, true);
    assert.equal(emailChangeSchema.safeParse({ newEmail: "broken" }).success, false);
    assert.equal(emailChangeSchema.safeParse({}).success, false);
  });
});
