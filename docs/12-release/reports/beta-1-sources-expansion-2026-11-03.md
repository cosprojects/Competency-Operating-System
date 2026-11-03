# Beta 1 — ресурсная база по профессиям (финальная сводка)

- Дата: 2026-11-03
- Релиз: `beta-1` (manifest `draft`)
- Источник данных: `registry.json`, `learning-source-links.json`, `competencies.json`, `catalog/it.json`, `data/learning-sources/open-sources-by-profession-2026-11-03.json`

## Итог

| Показатель | Значение |
|---|---:|
| Источников в реестре | 160 |
| Активных | 127 |
| Автонайденных (`discoveredBy: search`) | 39 |
| Связей «компетенция–источник» (links) | 400 |
| Связей в модели (уникальных) | 468 |
| Сумма связей по view профессий | 2006 |
| Решений source review | 1153 |
| release gate | PASS |

## По профессиям

| Профессия | Компетенций | Связей | Уникальных источников | Активных | Из них авто | Открытых (free/freemium) | Материалов | Без открытого источника | В публикации |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| UX/UI-дизайнер | 43 | 201 | 60 | 58 | 16 | 31 | 21 | 6 | 34/34 |
| Графический дизайнер | 27 | 151 | 50 | 49 | 10 | 27 | 12 | 4 | 18/18 |
| Моушн-дизайнер | 37 | 205 | 54 | 52 | 13 | 25 | 16 | 3 | 28/28 |
| Продуктовый дизайнер | 39 | 192 | 56 | 54 | 15 | 25 | 24 | 5 | 30/30 |
| 3D-дизайнер | 24 | 155 | 53 | 52 | 8 | 29 | 7 | 4 | 15/15 |
| Дизайнер приложений | 35 | 172 | 52 | 50 | 12 | 25 | 13 | 4 | 26/26 |
| Арт-директор | 25 | 145 | 46 | 45 | 8 | 23 | 9 | 4 | 16/16 |
| Дизайнер интерьеров | 23 | 142 | 49 | 48 | 8 | 25 | 4 | 5 | 14/14 |
| Дизайнер презентаций | 22 | 138 | 48 | 47 | 8 | 24 | 8 | 4 | 13/13 |
| UX-исследователь | 27 | 150 | 43 | 43 | 9 | 23 | 8 | 6 | 18/18 |
| Веб-дизайнер | 33 | 173 | 55 | 53 | 10 | 30 | 15 | 3 | 24/24 |
| AI-дизайнер | 27 | 182 | 56 | 55 | 7 | 34 | 5 | 1 | 0/27 |

## Новые авто-источники по профессиям

- **UX/UI-дизайнер**: tilda.education, hse.ru, stepik.org, learn.rarus.ru, netology.ru, contented.ru, online.spbu.ru, skillbox.ru, hudozhnik.online, bangbangeducation.ru, bureau.ru, itproger.com, cloud.itstep.org, developer.mozilla.org, intuit.ru, spb.hse.ru
- **Графический дизайнер**: tilda.education, hudozhnik.online, bangbangeducation.ru, bureau.ru, skillbox.ru, spb.hse.ru, developer.mozilla.org, intuit.ru, britishdesign.ru, prjctr.com
- **Моушн-дизайнер**: tilda.education, animationschool.ru, britishdesign.ru, hudozhnik.online, bangbangeducation.ru, bureau.ru, skillbox.ru, spb.hse.ru, cloud.itstep.org, contented.ru, online-vfx.ru, profileschool.ru, itproger.com
- **Продуктовый дизайнер**: tilda.education, skillbox.ru, spb.hse.ru, hse.ru, uplab.ru, obrazum.com, stepik.org, learn.rarus.ru, netology.ru, contented.ru, online.spbu.ru, hudozhnik.online, bangbangeducation.ru, bureau.ru, productlab.ru
- **3D-дизайнер**: tilda.education, hudozhnik.online, skillbox.ru, 3d.itmo.ru, smirnov.school, spb.hse.ru, dev.epicgames.com, animationschool.ru
- **Дизайнер приложений**: tilda.education, hudozhnik.online, bangbangeducation.ru, bureau.ru, skillbox.ru, spb.hse.ru, hse.ru, prjctr.com, netology.ru, contented.ru, itproger.com, online.spbu.ru
- **Арт-директор**: tilda.education, hudozhnik.online, bangbangeducation.ru, bureau.ru, skillbox.ru, spb.hse.ru, britishdesign.ru, setters.education
- **Дизайнер интерьеров**: tilda.education, hudozhnik.online, obrazum.com, designschool.ru, skillbox.ru, spb.hse.ru, britishdesign.ru, synergy.ru
- **Дизайнер презентаций**: tilda.education, bangbangeducation.ru, bureau.ru, hudozhnik.online, skillbox.ru, spb.hse.ru, cbsd.ru, hse.ru
- **UX-исследователь**: tilda.education, stepik.org, skillbox.ru, spb.hse.ru, openedu.ru, hse.ru, freeuniversity.education, productlab.ru, privet.marketing
- **Веб-дизайнер**: tilda.education, hudozhnik.online, bangbangeducation.ru, bureau.ru, skillbox.ru, spb.hse.ru, contented.ru, itproger.com, developer.mozilla.org, intuit.ru
- **AI-дизайнер**: tilda.education, aistudio.yandex.ru, stepik.org, learn.rarus.ru, skillbox.ru, bangbangeducation.ru, spb.hse.ru

## Что это значит

- Авто-расширение дало 39 источников; после spot-check удалены 3 нерелевантных.
- Все профессии покрыты активными источниками 100% (`learning:map`: 0 ошибок, 3 предупреждения по planned-источникам).
- Brave free-тариф: израсходовано ≈724 из ≈1000 запросов на полный прогон 12 профессий; запись из журналов и аудит HTTP квоту не тратят.
- «Без открытого источника» — компетенции, где есть только платный/mixed источник; это честный пробел, а не отсутствие данных.
- Авто-источники: 3 planned, 1 blocked (`specialist.ru`, HTTP 500) — в публикацию не идут; 6 источников с `access: unknown` ждут ручной проверки.

## Как воспроизвести

```bash
npm run sources:expand -- --profession <slug> --provider brave --per-competency 2 --classify
npm run sources:expand -- --profession <slug> --from-journal data/learning-sources/expansion-<slug>-<date>.json --write --audit --review-decisions
npm run sources:repair -- --write
npm run model:sync -- --domain it --profession uxui --write
npm run reviews:decide -- --release beta-1 --write
npm run learning:map && npm run learning:aggregate
npm run release:validate -- --release beta-1 && npm run release:build:draft
```