# Release manifests

`beta-1.json` — human-owned состав публичной Beta. Менять только вместе с `COS-REL-001`/`COS-REL-008`.

```bash
npm run release:report -- --release beta-1     # черновой отчёт, exit 0
npm run release:validate -- --release beta-1   # строгий gate, exit 1 при пробелах
npm run release:build -- --release beta-1      # публичная сборка только после gate
npm run release:build:draft                    # локальный preview, не публиковать
```

`beta-1-source-review.json` — решения по парам «компетенция–источник». `professionId` можно не указывать (или `*`), если решение общее для всех профессий. Одна запись:

```json
{
  "professionId": "it.uxui",
  "competencyId": "ux-design-thinking",
  "sourceId": "practicum-design-catalog",
  "decision": "accepted",
  "reason": "Программа покрывает введение в дизайн-мышление.",
  "reviewedBy": "founder",
  "reviewedAt": "2026-10-28"
}
```

`decision`:
- `accepted` — источник подходит; нужны `reviewedBy`/`reviewedAt`.
- `replaced` — заменён на `replacementSourceId`.
- `excluded` — не публиковать; нужна причина.

Пока файл пуст, `release:validate` считает source gate не пройденным. Это ожидаемо для draft.
