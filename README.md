# Competency Operating System (COS)

AI-native platform for competency assessment, learning pathways and workforce development.

## Status

🚧 Research & Architecture


## Визуализация компетенций

`npm run canvas:page -- --domain it --profession uxui --source review --include-seed` собирает `web/uxui-competency-canvas.html` — самодостаточную страницу-канвас с сетью UX/UI-компетенций.


## Каноническая карта UX/UI

`src/methodology/v1/competency/canonical/uxui.json` — два блока (UX/UI), 8 разделов и 34 компетенции со статусами `covered` / `partial` / `gap`. Сейчас: 9 covered / 25 partial / 0 gap. Проверка и coverage-отчёт:

```bash
npm run canonical:validate -- --domain it --profession uxui --source review --include-seed --report
```
