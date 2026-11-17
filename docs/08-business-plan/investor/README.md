# Investor artifacts

> **Актуальная версия (2026-11-13): `deck-v2/`** — Казахстан first, без цен, тарифов,
> выручки и платящих. 14 слайдов 16:9, HTML/PDF/PNG, проверка цифр 13 / 132 / 131 / 292
> и ask $120 тыс. Собрано по `COS-BP-023` на визуальном языке AXIONA.
> Сборка: `npm run deck:build`, проверка: `npm run deck:verify`.
>
> **Важно:** PDF/HTML ниже — версия под рынок РФ (исторический слой, цены/выручка).
> После решения «РФ — только тест, запуск из Беларуси, рынки СНГ/Европа» тексты
> обновлены в `COS-BP-017/018/019/020`; эти файлы не использовать в новом раунде.

| Файл | Что это | Источник |
|---|---|---|
| `deck-v2/AXIONA-Investor-Deck.html` | **актуальный** deck 2026-11: 14 слайдов, Казахстан first, без цен/выручки | `COS-BP-023` |
| `deck-v2/AXIONA-Investor-Deck.pdf` | **актуальный** PDF 16:9, 14 страниц | `COS-BP-023` |
| `AXIONA-One-Pager.pdf` | One-pager на A4, 1 страница (РФ-версия) | `COS-BP-020` |
| `AXIONA-One-Pager.html` | Исходник one-pager для правок/экспорта | `COS-BP-020` |
| `AXIONA-Investor-Deck.pdf` | Deck 16:9, 14 слайдов | `COS-BP-019`, `COS-BP-021` |
| `AXIONA-Investor-Deck.html` | Исходник deck для правок/экспорта | `COS-BP-019`, `COS-BP-021` |

## Как обновлять

**Актуальный deck (`deck-v2/`):**

1. Правь контент и композицию в `scripts/deck/decks/axiona-pitch-ru-2026-11.mjs`.
2. Собери всё одной командой: `npm run deck:build` — карты, HTML, PDF, PNG, contact sheet и проверки.
3. Открой `deck-v2/VERIFY.md`: должно быть 43/43, 0 переполнений в layout-audit и «нет цен/выручки/платящих».
4. PDF — 14 страниц, PNG — 14 файлов 2560×1440. HTML листается `←` `→`, `F` — полный экран, `N` — заметки.

**Исторические файлы (РФ-версия, не использовать в новом раунде):**

1. Правь `COS-BP-019` (текст) и `COS-BP-021` (структура/визуалы).
2. Правь HTML-исходники.
3. Экспорт PDF (Chrome headless):

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --user-data-dir=/tmp/axiona-pdf --disable-gpu --no-sandbox \
  --no-pdf-header-footer \
  --print-to-pdf=docs/08-business-plan/investor/AXIONA-One-Pager.pdf \
  "file://$PWD/docs/08-business-plan/investor/AXIONA-One-Pager.html"
```

4. Проверь, что one-pager — 1 страница, deck — 14 страниц.
5. После первых Beta заменить placeholder-метрики и пересобрать PDF.
