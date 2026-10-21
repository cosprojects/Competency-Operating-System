# Приоритеты компетенций

Файл `<profession>.json` — human-owned маркировка для `COS-RES-015`.

1. Сгенерируйте шаблон:
   `npm run priority:template -- --domain it --profession uxui --source review --include-seed`
2. Заполните `tier`, `order`, `prerequisites`, `rationale`, `confidence`, `reviewer`, `reviewedAt` в `<profession>.json`.
3. Проверьте:
   `npm run priority:validate -- --domain it --profession uxui --source review --include-seed --require-complete`
4. Соберите раскладку:
   `npm run competency:canvas -- --domain it --profession uxui --source review --include-seed --allow-partial`

Для accepted-каталога используйте `--source catalog`. `tier` не выставляет LLM; `isCore`/`marketDemandWeight` — только сигналы.
