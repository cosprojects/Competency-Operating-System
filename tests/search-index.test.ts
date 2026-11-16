import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactSearchText, matchesSearchTokens } from "../apps/web/src/lib/search-index.ts";

describe("компактный поисковый индекс", () => {
  it("оставляет только уникальные слова, нижний регистр и «е» вместо «ё»", () => {
    assert.equal(
      compactSearchText("Исследование ёмкости рынка исследование Ёмкости"),
      "исследование емкости рынка",
    );
  });

  it("чистит пунктуацию и не оставляет пустых токенов", () => {
    assert.equal(compactSearchText("UX/UI-дизайн, (прототипы)!"), "ux ui дизайн прототипы");
    assert.equal(compactSearchText("   "), "");
  });

  it("дедупликация реально уменьшает текст", () => {
    const text = "навык знания навык навык компетенция знания";
    const compact = compactSearchText(text);
    assert.ok(compact.length < text.length);
    assert.equal(compact.split(" ").length, 3);
  });
});

describe("поиск по токенам", () => {
  const index = compactSearchText("ux ui дизайнер исследование прототипов");

  it("пустой запрос совпадает с чем угодно", () => {
    assert.equal(matchesSearchTokens(index, ""), true);
  });

  it("находит по недописанному слову", () => {
    assert.equal(matchesSearchTokens(index, "исслед"), true);
    assert.equal(matchesSearchTokens(index, "протот"), true);
  });

  it("все слова запроса обязательны", () => {
    assert.equal(matchesSearchTokens(index, "дизайнер прототип"), true);
    assert.equal(matchesSearchTokens(index, "дизайнер космос"), false);
  });

  it("порядок слов не важен (в старом индексе фраза искалась только подряд)", () => {
    assert.equal(matchesSearchTokens(index, "прототипов исследование"), true);
  });

  it("подстрока не совпадает с пустой строкой искомого", () => {
    assert.equal(matchesSearchTokens("", "ux"), false);
  });
});
