# Figma parity — макеты из вёрстки

Пайплайн собирает экраны Beta-1 в Figma из реально отрендеренной вёрстки,
а не из старых макетов. Контент, тексты и размеры берутся из DOM приложения,
визуальная система (точечный канвас, подложки, боковое меню) — из файла
`AXIONA — mvp` (узлы `108:4400`, `18:167`, `34:2969`).

```
next dev → extract.mjs → scenes/*.json → shell.mjs → build.mjs → plugin/
                              ↓                          ↓
                        preview.mjs (PNG)        mock-figma.mjs (dry-run)
```

## Быстрый старт

```bash
# 1. Поднять вёрстку и Chrome с CDP
cd apps/web && node ../../node_modules/next/dist/bin/next dev -p 3100 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox \
  --user-data-dir=/tmp/cr-parity --remote-debugging-port=9222 about:blank &

# 2. Снять публичные экраны (desktop 1440 + mobile 390)
node scripts/web/figma-parity/extract.mjs --base http://127.0.0.1:3100 --cdp 9222

# 3. Предпросмотр без Figma (HTML + PNG)
node scripts/web/figma-parity/preview.mjs

# 4. Собрать плагин и прогнать сухой тест
node scripts/web/figma-parity/build.mjs
node scripts/web/figma-parity/mock-figma.mjs
```

### Закрытые экраны (`/saved`, `/account`, `/admin/*`)

Нужна локальная сессия в SQLite:

```bash
# клиент Prisma под локальную sqlite-схему (потом вернуть: npx prisma generate)
npx prisma generate --schema prisma/schema.local.prisma

# пользователь + сессия, печатает cookie
node scripts/web/figma-parity/dev-session.mjs --email designer@axiona.local

# dev-сервер с админом (иначе /admin/* отдаст 404/редирект)
cd apps/web && ADMIN_EMAILS=designer@axiona.local \
  node ../../node_modules/next/dist/bin/next dev -p 3100 &

# съёмка с cookie
node scripts/web/figma-parity/extract.mjs --cdp 9222 \
  --cookie "axiona_session=<token из dev-session>"
```

Без `--cookie` закрытые экраны пропускаются с сообщением в логе.

## Как запустить в Figma

Плагин создан через Figma → `Plugins` → `Development` → `New plugin…`, поэтому
живёт в отдельной папке-проекте:

```
scripts/web/AXIONA _ Web parity builder/   ← code.js + code.ts + manifest.json
```

`build.mjs` после сборки **сам кладёт бандл в этот проект**: `code.js` —
готовый к запуску бандл, `code.ts` — он же с `@ts-nocheck` (чтобы `npm run
build` не затёр сборку шаблоном), манифест получает `documentAccess:
dynamic-page`, figma-`id` сохраняется. Переимпортировать плагин не нужно:
достаточно запустить его снова.

1. `Plugins` → `Development` → **AXIONA — Web parity builder**
2. Должен появиться тост «Готово: 12 десктоп + 8 мобильных экранов…» и три
   страницы в начале списка.

Если нужен отдельный плагин из `scripts/web/figma-parity/plugin/` — импортировать
его манифест тоже можно, это тот же бандл.

Диагностика окружения (если что-то не запускается) — `smoke/manifest.json`:
отдельный мини-плагин на 4 KB, показывает стили Geist, доступные Figma, и
проверяет `createImage` / `createNodeFromSvg`.

Плагин создаёт три страницы:

- **Beta-1 · Web parity** — 12 десктопных фреймов 1500×H слева направо;
- **Beta-1 · Mobile parity** — 8 фреймов 390×H;
- **Beta-1 · Components** — библиотека компонентов (nav-rail, button, badge,
  card, profession-card, competency-card, source-card, notice, pill, auth-card).

Повторный запуск **очищает эти страницы** и собирает заново — так макеты
остаются синхронными с кодом: поменяли вёрстку → `extract` → `build` → Run.

## Геометрия

| Что | Десктоп | Мобильный |
|---|---|---|
| Фрейм | 1500 × H (мин. 1000) | 390 × H (мин. 844) |
| Фон | точечный канвас: тайл 24px, точка Ø1.5 `#E2E8F0` на `#FEFEFE` | то же |
| Нав-рэйл | 188 × 590 в (40, 40) | нет |
| Workspace-подложка | 1200 × H в (260, 40), padding 40, radius 16, `#F9FAFB` | не заливается: фундамент — канвас, поверхности несут карточки |
| Контент | 1120, 1:1 из вёрстки (контейнер 160…1280) | 358, 1:1 из вёрстки (контейнер 16…374) |
| Карточки | `#FFFFFF`, border `#E2E8F0`, radius 16, тень `0 12px 20px rgba(181,172,172,0.35)` | то же |

Радиусы из вёрстки приводятся к шкале макета: ≥18 → 16, 13–17 → 12, пилюли
(999px) остаются пилюлями.

## Что вырезается из вёрстки

- `.site-header` — заменён нав-рэйлом;
- `.footer` — вне экранных макетов;
- `.consent-banner` — баннер согласия, не часть экрана;
- `.notice` без `.info` — черновой preview-варнинг («не публиковать без
  release:validate»), это не продуктовый UI.

Список — в `dropRule()` в `shell.mjs`.

## Текст

- **Однострочные** метки (бейджи, кнопки, заголовки в одну строку) ставятся по
  ink-box с `WIDTH_AND_HEIGHT` — позиция и переносы точные.
- **Многострочные** блоки — один редактируемый параграф, ширина = самая длинная
  строка + 2px. Переносы совпадают с браузером, потому что вёрстка и макеты
  используют один шрифт (**Geist**, подключён в `apps/web` через `@font-face`).

## Ограничения

- **Градиенты** поддерживаются (`GRADIENT_LINEAR` + матрица из CSS-угла,
  проверена на 90° и 180°); 135° на неквадратных объектах может дать чуть
  другой наклон — это стоит один раз сверить глазами в Figma.
- **Один снимок состояния:** снимается дефолтное состояние маршрута.
  Hover/focus/error/empty не снимаются.
- **Pseudo-элементы** (`::before`/`::after`) не снимаются.
- **Закрытые экраны** требуют sqlite-сессии (см. выше) и снимаются только в
  desktop-варианте.
- **Данные в макетах живые:** админка показывает то, что реально в
  `data/local.db` (1 пользователь, 1 событие), а не выдуманные цифры.

## Изменения в приложении

Пайплайн потребовал двух правок в `apps/web` — они про дизайн-систему, не про
фикстуры:

1. `apps/web/public/fonts/Geist-VariableFont_wght.ttf` — Geist положен в
   репозиторий (OFL), чтобы рендер не зависел от установленных шрифтов.
2. `apps/web/src/app/globals.css` — `@font-face` для Geist и
   `--font: "Geist", "Inter", …` вместо `"Inter", …` без подключения.

До этого вёрстка рендерилась системным SF Pro: `Inter` был объявлен, но нигде
не загружался, поэтому макеты и браузер расходились по метрикам.

## Файлы

| Файл | Что делает |
|---|---|
| `routes.json` | экраны (публичные + закрытые), вьюпорты, селекторы компонентов |
| `extract.mjs` | снимает геометрию/стили через CDP, пишет `scenes/*.json` |
| `shell.mjs` | оболочка: канвас, нав-рэйл, подложки, ремап стилей |
| `preview.mjs` | HTML/PNG предпросмотр без Figma → `preview/` |
| `build.mjs` | собирает `plugin/code.js` + `manifest.json`, генерит PNG тайла |
| `renderer.js` | тело плагина: рендер сцен, компоненты, стили, инстансы |
| `mock-figma.mjs` | сухой прогон плагина на моке Plugin API |
| `dev-session.mjs` | пользователь + сессия в `data/local.db` для закрытых экранов |
| `assets/` | SVG из файла: лого, 5 иконок, тайл канваса |

`scenes/`, `preview/` и `plugin/code.js` — генерируемые, в git не входят.
