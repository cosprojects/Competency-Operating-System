# Investor artifacts

| Файл | Что это | Источник |
|---|---|---|
| `AXIONA-One-Pager.pdf` | One-pager на A4, 1 страница | `COS-BP-020` |
| `AXIONA-One-Pager.html` | Исходник one-pager для правок/экспорта | `COS-BP-020` |
| `AXIONA-Investor-Deck.pdf` | Deck 16:9, 14 слайдов | `COS-BP-019`, `COS-BP-021` |
| `AXIONA-Investor-Deck.html` | Исходник deck для правок/экспорта | `COS-BP-019`, `COS-BP-021` |

## Как обновлять

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
