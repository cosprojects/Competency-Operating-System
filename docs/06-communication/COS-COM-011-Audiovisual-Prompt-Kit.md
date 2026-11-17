---
id: COS-COM-011
title: Аудиовизуальный контент — визуальный язык, сценарий и промпт-кит
version: 0.1.0
status: Draft
owner: Brand / Product
last_updated: 2026-11-12
references:
  - COS-COM-006
  - COS-COM-010
  - COS-WEB-001
  - apps/web/src/app/globals.css
  - apps/web/public/brand/logo-mark.svg
---

# COS-COM-011 — Аудиовизуальный контент

Промпт-кит для видеоролика AXIONA: визуальный язык, сценарий, раскадровка,
промпты кадров и видео, аудио-бриф и пайплайн производства.

Документ — рабочая основа для одного ролика (33 s, 16:9) и его вертикальной
версии. Он не описывает «фирменный стиль» заново: визуальная философия взята из
`COS-COM-006`, голос и правила текста — из `COS-COM-010`, значения цвета,
радиусов, теней и типографики — из токенов `apps/web/src/app/globals.css` и
ассетов `apps/web/public/brand/`.

---

## 0. Что внутри и как этим пользоваться

| Шаг | Раздел | Артефакт |
|---|---|---|
| 1 | §2 Визуальный язык | словарь из 6 понятий, палитра, камера, движение |
| 2 | §3 Сценарий | 8 битов, 33 s, титры и VO |
| 3 | §4 Раскадровка | промпт на каждый кадр + видео-промпт |
| 4 | §5 Платформенные ворота | настройки Nano Banana / MJ / GPT Image / Kling / Seedance |
| 5 | §6 Консистентность | style anchor, референсы, порядок генерации |
| 6 | §7 Аудио | музыка, SFX, VO, микс |
| 7 | §8 Пайплайн | 7 шагов, бюджет генераций |
| 8 | §9–10 Поставка и QA | спеки, чеклист |

Артефакты раскадровки уже собраны в репозитории и пересобираются одной командой:

```sh
node scripts/av/storyboard.mjs            # 8 кадров → docs/design/av
```

- `docs/design/av/storyboard-contact-sheet.png` — контактный лист (смотреть первым);
- `docs/design/av/storyboard.html` — тот же лист как HTML;
- `docs/design/av/s01.svg … s08.svg` — векторные кадры из токенов;
- `docs/design/av/frames/s01.png … s08.png` — PNG 1920×1080;
- `docs/design/av/frames.json` — машинная связка кадр → спека и ссылка на §4.

**Важно:** это не AI-рендер и не финальный арт. Это проверка композиции, ритма
и масштаба до трат на генерацию. Финальные кадры делаются по §4–§5; слой текста,
логотипа и интерфейса — детерминированный (§5.6).

---

## 1. Что именно визуализируем

Исходный абзац раскладывается на пять визуальных утверждений. Каждое — один
кадр или пара кадров; ни одно не показывается словами, если его можно показать
структурой.

| Смысл из текста | Визуальное утверждение | Кадр |
|---|---|---|
| «У каждой профессии есть своя структура» | структура существует, но её не видно | S01 |
| «знания, навыки и компетенции» | узлы разные, связи разные, вместе — система | S02, S03 |
| «непросто понять, что изучать и с чего начать» | один узел без связей бесполезен | S01–S02 |
| «AXIONA помогает увидеть профессию целиком и разобраться в составляющих» | внутрь узла: знания → навыки → материалы | S03, S04 |
| «выберите профессию… посмотрите связанные знания и навыки… найдите материалы» | связи делают соседнее релевантным | S05, S06, S07 |
| «необязательно знать всё заранее… начните с того, что интересно» | выбор одной точки, а не прохождение плана | S06 |
| «постепенно картина складывается» | отъезд: карта читается целиком | S07 |

Ключевая мысль ролика (одна строка, по ней проверяется каждый кадр):

> **Структура профессии уже есть. AXIONA делает её видимой.**

Чего в ролике нет: героя-студента, офиса, ноутбуков, графиков роста, обещаний
трудоустройства, «прогресса» с процентами и наград. Это прямо запрещено
`COS-COM-010 §3–4` и не поддерживается визуальным языком.

---

## 2. Визуальный язык и стиль

Название рабочей версии: **«Светлая структура»**.

Английская формула для промптов: *light, paper, hairline, calm — a system becoming
legible.* Это не «эстетика», а перенос шести принципов `COS-COM-006` в киноязык.

### 2.1 Принципы → решения в кадре

| Принцип `COS-COM-006` | Что это значит в кадре | Что запрещено |
|---|---|---|
| Взаимосвязи важнее объектов | объект в кадре только вместе со своей связью; пустой узел — это проблема | «красивые карточки» без связей |
| Постепенное раскрытие | каждый кадр открывает ровно один новый слой структуры | показать всю карту в первом кадре |
| Структурная целостность | один и тот же узел, одна и та же нить на всех масштабах: от макро до всей карты | разные стили для «абстракции» и «интерфейса» |
| Спокойная сложность | плотность растёт, а напряжение — нет: ровный свет, ровный ритм | вспышки, ускорения, «эпичные» ризеры |
| Осмысленная видимость | в кадре нет декоративных частиц и фоновых «схем» | plexus, частицы, блики, сетки «на удачу» |
| Живая структура | связи растут, тянутся, завязываются — но не «моргают» | пульсация, свечение, «дыхание» без причины |

### 2.2 Палитра: токены и их роли

Цвет в ролике — не настроение, а сигнал. Основа кадра всегда светлая.

| Токен | HEX | Роль в кадре | Доля площади |
|---|---|---|---|
| `--bg` | `#F8FAFC` | бумажная плоскость, фон | 55–70 % |
| `--surface` | `#FFFFFF` | карточка, светотень | 15–25 % |
| `--ink` | `#132238` | текст в пост-слое, тёмные узлы знака | 0 % в AI-кадре* |
| `--line` / `--line-soft` | `#E2E8F0` / `#EEF2F7` | hairline-контуры, направляющие полос | 8–14 % |
| `--muted` | `#5F6F85` | подписи в пост-слое | 0 % в AI-кадре |
| `--accent` | `#4F46E5` | активная связь, выбранный узел, ядро знака | **3–6 %** |
| `--accent-sky` | `#0EA5E9` | только в прогресс-градиенте UI-инсёртов | ≤1 % |
| `--tier-foundation` | `#B45309` / `#FFF7ED` | чип фундаментальной компетенции | ≤1 % |
| `--tier-core` | `#1D4ED8` / `#EFF6FF` | чип основной | ≤1 % |
| `--tier-optional` | `#64748B` / `#F8FAFC` | чип дополнительной | ≤1 % |

\* Тёмный текст в AI-кадре не генерируется вообще — он накладывается в пост-слое
(§2.6). В кадре тёмными могут быть только узлы логотипа в эндкарде.

Жёсткие правила:

- индиго никогда не фон и не «заливка» — только линия, точка, чип, ядро;
- нет второго акцентного цвета: тёплый амбер существует только как чип уровня;
- белый не «перекрашивается» грейдом: `#F8FAFC` на выходе должен остаться
  `#F8FAFC` (проверка пипеткой, §10);
- переходы между кадрами не затемняют картинку: ролик не уходит в чёрный ни разу.

### 2.3 Материалы: четыре объекта, ничего больше

1. **Бумажная плоскость.** `#F8FAFC`, еле заметная точечная сетка (точки 2 px,
   шаг 32/64 px — как `background-image` в `globals.css`), мелкое зерно 3–5 %.
2. **Карточка-узел.** Белая, матовая, неклеевая бумага; радиус 16 px; контур
   1 px холодный hairline; лёгкая тень `#CAD4EB`. На карточке — только чип
   уровня и номерной бейдж. **Текст на карточках не генерируется.**
3. **Нить.** Тонкая физическая нить 1.5–2 px, с еле заметным провисом; цвет
   `#C7D2E1`; активная — `#4F46E5` 2.4 px. Нить именно физическая: не лазер, не
   молния, не «энергия».
4. **Ядро.** Индиговая точка `#4F46E5` — из знака AXIONA. Появляется один раз как
   смысловой финал (S08) и один раз как «точка понимания» (S06).

Всё остальное — шум. Никаких стеклянных панелей, 3D-хрома, изометрии, людей,
рук, техники.

### 2.4 Камера и оптика

Ролик снят как «продуктовый натюрморт»: камера — спокойный наблюдатель.

| Параметр | Решение |
|---|---|
| Высота | 90 % кадров — top-down (смотрим на канвас, как в продукте); один кадр (S04) — низкий угол 20° |
| Объективы | 35 mm — вся карта (S03), 50 mm — средний план (S02, S05), 85–100 mm macro — деталь (S01, S04) |
| Диафрагма | f/2.8–f/5.6: глубина есть, но края объектов остаются резкими |
| Движение | push-in 6–10 %, crane up 8–12 %, orbit 15°, rack focus. Скорость ≤8 % масштаба в секунду |
| Штатив | всегда. Руки, дрожание, «дыхание камеры» — запрещены |
| Кроп | 16:9 мастер; вертикаль — перекадровка (§Приложение C), не «зум на центр» |

### 2.5 Движение и время

| Приём | Параметры |
|---|---|
| Появление карточки | масштаб 0.94→1.0, opacity 0→1, 0.6 s, ease-out; тень догоняет |
| Рост нити | отрисовка от одного конца к другому, 0.8–1.2 s, ease-out, без overshoot |
| Камера | старт через 0.3 s после склейки, стоп за 0.3 s до следующей — **режем на покое** |
| Ритм | 3.5 / 3.5 / 5.0 / 4.0 / 4.5 / 4.5 / 4.0 / 4.0 s — длиннее к середине, спокойный финал |
| Переходы | только два: dive-in + dissolve 8 кадров S03→S04 и match cut «край карточки → край панели» S05→S06 |
| Overshoot / bounce / spring | запрещены полностью |

### 2.6 Типографика и оверлеи (пост-слой, не генерация)

Шрифт — Geist (`apps/web/public/fonts/Geist-VariableFont_wght.ttf`). Титр живёт
2.2–2.8 s, появляется через 0.4 s после склейки, поднимается на 12 px с
opacity 0→1 за 0.45 s.

| Элемент | Кегль @1080p | Начертание | Цвет |
|---|---|---|---|
| Заголовок-титр | 64–72 px, интерлиньяж 1.1, tracking −1 % | 700 | `#132238` |
| Надзаголовок (eyebrow) | 22 px, tracking 0.12em, uppercase | 600 | `#3730A3` |
| Подпись | 28 px | 400 | `#5F6F85` |

Правила текста — из `COS-COM-010`: до 6 слов в заголовке, без восклицательных
знаков, без CAPS в предложениях, без эмодзи, обращение на «ты», никаких чисел и
обещаний. Безопасные поля — 96 px по краям 1080p.

### 2.7 Анти-слоп: что запрещено писать и показывать

Эти слова и образы — главная причина, по которой «сеть компетенций» превращается
в чужой ролик. Их нет ни в одном промпте, а в негативном промпте они стоят явно:

```text
plexus, neural network, brain, hologram, glowing orb, energy field, particles,
digital nodes, sci-fi HUD, cyber, neon, dark mode, glassmorphism, chrome, 3D
isometric clipart, rocket, gear, ladder, stairs, lightbulb, target, graduation cap,
laptop on desk, office, team meeting, handshake, stock-photo person, lens flare,
bokeh balls, chromatic aberration, vignette, epic rise, motivational caption
```

Проверка одной фразой: **если кадр можно подписать «AI technology background» —
он не наш.**

### 2.8 Ориентиры по ощущению (не по стилю)

- свет и воздух — как в макросъёмке бумаги, а не как в 3D-рендере;
- плотность и точность — как в документации к продукту, а не в рекламе;
- темп — как в спокойном туториале: зритель успевает прочитать структуру;
- эмоция — облегчение («так вот как это устроено»), а не восторг.

---

## 3. Сценарий

### 3.1 Драматургия в одну строку

> Одинокая карточка → появляются связи → из связей складывается карта → внутрь
> узла → связи делают соседнее нужным → выбираешь свою точку → видно целиком →
> знак.

### 3.2 Сценарий по битам

| # | Время | Бит | Что происходит на экране | Смысл |
|---|---|---|---|---|
| S01 | 0:00.0–0:03.5 | Один узел | одна карточка на пустой точечной плоскости, медленный push-in | структура есть, но она не видна |
| S02 | 0:03.5–0:07.0 | Появляются связи | от карточки тянется нить и завязывается на второй; проявляются ещё три | знания/навыки/компетенции — не список, а связи |
| S03 | 0:07.0–0:12.0 | Карта складывается | узлы съезжаются в три полосы (фундаментальные / основные / дополнительные), нити прошивают полосы; камера поднимается | профессия целиком |
| S04 | 0:12.0–0:16.0 | Внутри узла | одна карточка приподнимается и расходится на три слоя; орбита камеры | внутри — знания, навыки и материалы |
| S05 | 0:16.0–0:20.5 | Связи | передний план уходит в расфокус, в фокусе — цепочка из трёх узлов; одна ветка наливается индиго | связанное становится релевантным |
| S06 | 0:20.5–0:25.0 | Выбор | match cut: край карточки становится краем панели в продукте; курсор выбирает компетенцию, канвас подсвечивает связи | начать можно с любого места |
| S07 | 0:25.0–0:29.0 | Целиком | канвас продукта отъезжает: вся карта, зум-контролы, счётчики | картина складывается постепенно |
| S08 | 0:29.0–0:33.0 | Эндкард | три узла докидываются в знак AXIONA, в центре загорается индиговое ядро, вордмарк и строка | бренд |

30-секундная версия: S03 −1.5 s, S05 −1.0 s, S08 −0.5 s.

### 3.3 Титры и VO

Рекомендуемый формат (A) — сайт/autoplay без звука: **4 титра + музыка и SFX**,
VO нет. Формат (B) — соцсети/презентация: **VO 5 строк + только финальный титр**.

| Кадр | Титр (формат A) | VO (формат B) |
|---|---|---|
| S01 | У профессии есть структура | «У каждой профессии есть структура.» |
| S02 | — | «Знания. Навыки. Компетенции.» |
| S03 | — | — |
| S04 | Внутри — знания, навыки и материалы | «Внутри — свои знания, навыки и материалы.» |
| S05 | — | — |
| S06 | Начать можно с любого места | «Начать можно с любого места.» |
| S07 | — | «Картина складывается постепенно.» |
| S08 | Карта компетенций, которая объясняет профессию | — |

Правило: не больше одного титра на два кадра; титр не спорит с VO; строка в S08 —
подпись продукта, она не читается как слоган-обещание.

---

## 4. Раскадровка и промпты кадров

Каждый кадр описан тремя слоями:

1. **Спека** — что должно быть в кадре и что меняется (для режиссёра/художника);
2. **FRAME PROMPT** — готов к вставке в Nano Banana Pro (16:9, 4K). Промпт
   самодостаточен: в конце уже стоит сжатая стилевая часть. Полный STYLE TOKEN
   (§Приложение A) дописывается в конец, только если серия «плывёт» по материалу
   или свету;
3. **VIDEO PROMPT** — для Kling 2.5 / Seedance 1.0 pro, image-to-video с этим
   кадром как первым.

Негатив — общий (§Приложение B), если не указано дополнение.

### S01 · Один узел

**Спека.** Top-down, 100 mm macro. Одна карточка в левой трети, вокруг — только
бумага. Справа — обрубок нити, который никуда не ведёт: это и есть проблема.

```text
FRAME — S01 · «Один узел» · 16:9 · 4K

Extreme overhead top-down macro shot. A single blank white matte card with rounded
corners sits alone, slightly left of centre, floating two millimetres above a
paper-white surface with a barely visible dot grid. Three quarters of the frame is
empty surface. One thin hairline grey thread leaves the right edge of the card and
fades out of the frame. Very high-key, one large soft daylight source from the upper
left, soft blue-grey shadow. 100 mm macro lens at f/5.6, crisp card edges, gentle
falloff in the far corner.

Style: photoreal product still of paper and thread, editorial calm, matte uncoated
paper, no specular highlights, 4% fine film grain. The scene contains no text, no
letters, no numbers, no logos, no icons, no people, no hands, no interface.
```

```text
VIDEO — S01 · 5 s image-to-video

Static top-down shot. The camera pushes in 8% over the full duration with an
extremely smooth ease-in-out. The card stays perfectly still; only the shadow
drifts by a few pixels and the paper grain shimmers slightly. One hairline thread
on the right stays motionless. No text, no people, no camera shake, no zoom pulse,
no flicker.
```

### S02 · Появляются связи

**Спека.** Top-down, 50 mm. Пять карточек; активная — с индиговым контуром.
Индиговая нить тянется к соседу и завязывается узлом у его угла. Остальные связи
пока пунктирные и бледные.

```text
FRAME — S02 · «Появляются связи» · 16:9 · 4K

Overhead top-down photograph of five blank white matte cards arranged loosely on a
paper-white dot-grid surface: one larger card slightly below centre carries a thin
indigo hairline border, a second card sits to its right, three smaller cards are
further away. A thin physical indigo filament runs from the central card to the
right card and is knotted at the far corner. Threads to the outer cards are faint,
dashed and slightly sagging. Shallow focus on the central pair, soft falloff to the
edges. 50 mm at f/4, soft daylight from the upper left, blue-grey shadows.

Style: photoreal product still of paper and thread, matte uncoated paper, 4% grain.
Blank cards only: no text, no letters, no numbers, no logos, no people.
```

```text
VIDEO — S02 · 5 s image-to-video

Locked-off top-down shot. A thin indigo thread grows from the right edge of the
central card and connects to the card on the right in 1.6 s, easing out and settling
with a tiny sag. Then the three outer cards fade in one by one with a 0.4 s stagger
and land perfectly still. Nothing else moves. No text, no people, no camera move,
no flicker, no morphing.
```

Резервный путь, если модель «делает молнию»: нить отрисовывается в пост-слое
маской по статичному плате (S02 генерируется без нити, только карточки).

### S03 · Карта складывается

**Спека.** Top-down, 35 mm, всё в фокусе. 15 карточек в трёх полосах, строгая
сетка, равные отступы, бледные направляющие. Это style anchor ролика — именно
этот кадр утверждается первым и служит референсом для остальных.

```text
FRAME — S03 · «Карта складывается» · 16:9 · 4K  (STYLE ANCHOR)

Wide overhead top-down photograph of fifteen blank white matte cards arranged in
three strict horizontal bands on a paper-white dot-grid surface. Cards are aligned
to a grid with equal gaps; each band is marked by one very faint horizontal
hairline guide; thin grey hairlines cross the gaps between bands. Generous empty
margins on all sides. 35 mm at f/5.6, everything in focus, flat even daylight,
soft blue-grey shadows, high-key.

Style: photoreal product still, paper and thread, matte uncoated paper, 4% grain,
no colour except a single restrained indigo accent on one connector. No text, no
letters, no numbers, no logos, no people.
```

```text
VIDEO — S03 · 5 s image-to-video

Top-down. The camera rises 12% and pulls back slowly while cards slide gently into
three aligned horizontal bands with a 0.5 s stagger; the hairlines stretch and
settle between them. All motion eases out, nothing overshoots, final frame holds
still. No text, no people, no camera shake, no flicker.
```

### S04 · Внутри узла

**Спека.** Низкий угол 20° над плоскостью, 85 mm f/2.8. Карточка приподнята и
расходится на три параллельных слоя, как pop-up book. Верхний слой — в фокусе.
Самый «физический» кадр ролика: именно он объясняет вложенность систем.

```text
FRAME — S04 · «Внутри узла» · 16:9 · 4K

Low-angle macro photograph, twenty degrees above the surface: a white matte card
lifted off the paper and splitting into three parallel thin layers floating above
each other like a pop-up book. Each layer is a clean white plane with a hairline
edge; the top layer is crisp and detailed, the lower two fall slightly out of
focus; a deep but soft blue-grey shadow sits under the stack. Paper-white
background, single soft daylight source from the upper left, 85 mm at f/2.8.

Style: photoreal product still, matte uncoated paper, 4% grain, high-key. Blank
layers only: no text, no letters, no numbers, no icons, no people, no hands.
```

```text
VIDEO — S04 · 5 s image-to-video

Low-angle macro. The card lifts and separates into three parallel layers over 2.5 s;
the camera orbits 15 degrees to the left and tilts up 5 degrees, keeping the top
layer in focus. Shadows deepen softly and settle. No text, no people, no morphing
artefacts, no camera shake, no bounce.
```

### S05 · Связи

**Спека.** Top-down, 50 mm f/2. Rack focus с переднего плана на цепочку из трёх
узлов. Одна ветка наливается индиго — «как чернила в бумаге». Кадр-мост к продукту.

```text
FRAME — S05 · «Связи» · 16:9 · 4K

Overhead photograph of a loose network of eight blank white matte cards on a
paper-white dot-grid surface. The cards in the foreground on the left are softly
out of focus; a chain of three cards in the middle plane is crisp; one indigo
branch between two of them is denser and brighter than the rest, as if ink soaked
into the thread. Faint grey hairlines connect the remaining cards. 50 mm at f/2,
soft daylight, high-key, generous negative space top right.

Style: photoreal product still of paper and thread, matte uncoated paper, 4% grain.
No text, no letters, no numbers, no logos, no people.
```

```text
VIDEO — S05 · 5 s image-to-video

Top-down. Rack focus from the blurred foreground cards to the crisp chain of three
cards in 1.4 s, then a slow 4% slide to the right. One indigo branch brightens
gradually like ink soaking into paper. Everything else stays still. No text, no
people, no camera shake, no flicker.
```

### S06 · Выбор

**Спека.** Это **не AI-кадр**. Нужны две вещи: (а) плата для match cut — макро
скруглённого угла карточки; (б) реальная запись интерфейса Beta 1: курсор
выбирает компетенцию, канвас подсвечивает связи.

```text
FRAME — S06a · «Плата перехода» · 16:9 · 4K

Extreme macro top-down of the rounded corner and one-pixel edge of a white matte
card positioned at the very left edge of the frame. The rest of the frame is clean
paper-white surface with a faint dot grid. The card edge is razor sharp, the
hairline is visible as a single crisp line. 100 mm macro at f/8, very high-key,
no shadow gradient. No text, no letters, no interface, no people.
```

```text
VIDEO — S06b · продукт (screen capture, не генерация)

Screen recording at 2x resolution, 24 fps: the competency map canvas pans 120 px to
the right; one competency card receives a selected state — indigo 2 px border and a
soft indigo tint; connected nodes and edges highlight within 0.6 s. The cursor
moves in a straight line and stops without wobble. No zoom pulse, no fake 3D tilt.
```

### S07 · Целиком

**Спека.** Тоже **не AI-кадр**: запись реального канваса с отъездом от 100 % к
«вся карта». Финальный кадр держится 0.6 s — это пауза перед эндкардом.

```text
VIDEO — S07 · продукт (screen capture, не генерация)

Screen recording: the canvas zooms out from 100% to fit-all over 2.4 s with a smooth
ease-in-out; all nodes and hairlines stay crisp, no motion blur, no text jitter,
no scaling artefacts. The final frame holds still for 0.6 s.
```

### S08 · Эндкард

**Спека.** Motion design, не генерация: знак собирается из трёх узлов, ядро
загорается, вордмарк поднимается. Используются реальные ассеты
`logo-mark.svg` и `logo-wordmark.svg` — генеративный логотип запрещён.

```text
MOTION — S08 · 4 s (After Effects / Rive / код, не AI)

Three black nodes slide in from 40 px offsets and dock into the AXIONA mark in
0.9 s; arc connectors draw between them in 0.4 s; the indigo nucleus fades up and
settles; the wordmark rises 12 px with opacity 0→1; the product line fades in
0.3 s later. No camera move, no particles, no shine sweep, no lens flare.
```

Если нужен AI-комп для превиза — можно сгенерировать «три чёрных круга на
бумаге», но **знак и вордмарк всегда вставляются вектором**:

```text
FRAME — S08-comp (только превиз, не финал)

Three small matte black circular beads resting on paper-white dot-grid surface,
arranged in a wide triangle, thin black threads connecting them, a single small
indigo bead in the middle. Overhead, flat even daylight, 4% grain, macro.
No text, no letters, no logo, no people.
```

---

## 5. Как генерировать: платформенные ворота

Одна и та же идея требует разных формулировок. Ниже — роль каждой модели, точный
формат промпта и типовые провалы.

### 5.1 Nano Banana Pro — ключевые кадры (основная модель)

- **Роль:** S01–S05 (фотореалистичная «бумага и нить»), плата S06a.
- **Настройки:** 16:9, 4K (или 2K + апскейл), одна и та же «seed-семья» на серию,
  если интерфейс это позволяет.
- **Сильные стороны:** свет, материалы, матовая бумага, следование длинному
  описанию, отсутствие «пластика».
- **Слабые стороны:** любит добавлять надписи на карточки, глянец и «дизайнерский»
  беспорядок.
- **Страховки:** писать `blank cards`, `matte uncoated paper, no specular`, в
  негатив — `text, letters, watermark`; первым делом генерировать S03 и утвердить.
- **Лечение провалов** — таблица в Приложении D: симптом → что добавить/убрать.

Формула промпта (не менять порядок):

```text
[ПЛАН + РАКУРС + ОПТИКА] + [ЧТО В КАДРЕ, по объектам] + [СВЕТ] +
[STYLE TOKEN] + [ЗАПРЕТЫ: no text / no people / no interface]
```

### 5.2 Midjourney v7 — поиск текстуры и вертикальные кадры

- **Роль:** mood-варианты, фактура бумаги, 9:16-перекадровки для соцсетей.
  **Не** для финальных ключевых кадров: не держит консистентность серии.
- **Формат:** сокращённый промпт + параметры.
- **Параметры:** `--ar 16:9` (или `9:16`), `--style raw`, `--v 7`, `--s 100–150`,
  `--no text, letters, words, logo, watermark`.

```text
/imagine overhead macro photo, blank white matte rounded card floating above
paper-white dot-grid surface, one thin indigo thread, soft daylight upper left,
blue-grey shadow, editorial product still, high-key, matte paper, 100mm --ar 16:9
--style raw --v 7 --s 120 --no text, letters, words, logo, watermark
```

- **Консистентность:** после утверждения S03 сохранить её URL и добавлять
  `--sref <url> --sw 80`. Для перекадровки в 9:16 — `--sref` обязателен.
- **Провал:** MJ «украшает» свет и добавляет глубину. Лечится `--style raw` и
  словами `flat even daylight, high-key, 85% white frame`.

### 5.3 GPT Image — точные раскладки и вертикальные рефреймы

- **Роль:** служебные кадры: плашки под текст, чистые фоны, перекомпоновка в 9:16
  с направляющими, компы эндкарда (без логотипа).
- **Сильные стороны:** лучше всех держит заданную раскладку и «зоны» кадра.
- **Слабые стороны:** по умолчанию «3D-рендер» и «глянцевый» вид.
- **Страховка:** обязательно добавлять `photograph, 50 mm lens, f/4, real paper
  texture, natural dust, no CGI` и явно перечислять зоны: `left 40% empty`.

### 5.4 Kling 2.5 — image-to-video для «бумаги и нити»

- **Роль:** S01–S05, 5 s, 1080p, первый кадр — наш keyframe.
- **Формат:** «субъект + микро-действие + камера + свет + всё остальное статично»
  + негатив в отдельном поле.
- **Камера:** значения `static`, `push in 8%`, `orbit 15° left`, `tilt up 5°`.
  Ставить минимальную амплитуду, а не пресеты «dynamic».
- **Провалы:** нить превращается в молнию/энергию; карточки «дышат»; появляется
  текст. Лечение: `static camera`, `thread is a physical string with a slight sag`,
  `+2% motion only`, негатив с `text, lightning, energy`.
- **Правило:** амплитуда движения в кадре — не больше 2 % площади; всё, что
  больше, — уже «эффект», и он нам не нужен.

### 5.5 Seedance 1.0 pro — длинные проезды и физика

- **Роль:** альтернатива для S03 и S05 (длинные плавные движения, 1080p, 5–10 s).
- **Сильная сторона:** понимает киноязык (план, движение, переход) и лучше держит
  физику бумаги; поддерживает первый и последний кадр — можно задать и старт, и
  финиш из раскадровки.
- **Приём:** для S03 сгенерировать кадр-финиш (три полосы) и подать его как
  last frame — движение станет предсказуемым.
- **Провал:** любит добавлять «кинематографичный» контражур и глубину резкости
  шире заданной. Лечиться словами `flat overhead daylight, no rim light`.

### 5.6 Детерминированный путь (обязателен для S06–S08)

Продуктовый интерфейс, текст, логотип, счётчики и проценты **не генерируются**:

- S06–S07 — запись реального интерфейса Beta 1 (2×, 24 fps, без «наклонов» и
  фейкового 3D);
- титры — Geist в пост-слое;
- S08 — векторная анимация из `logo-mark.svg` / `logo-wordmark.svg`;
- раскадровка — `node scripts/av/storyboard.mjs` (SVG из токенов).

Причина простая: любая генерация текста и логотипа даёт брак, который нельзя
исправить грейдом. Гибрид «AI-метафора + честный продукт» — единственная
конфигурация, которая одновременно выглядит дорого и не врёт.

---

## 6. Консистентность серии

1. **Style anchor.** Первым генерируется S03. Он утверждается владельцем
   продукта и дальше подаётся как референс-изображение во все остальные кадры.
2. **Порядок генерации:** S03 → S01 → S02 → S04 → S05 → S06a.
3. **Референсы** (`anchor_s03.png`, `logo-mark.png`, `plate_white.jpg`, `ui-beta1.png`)
   складываются в `docs/design/av/refs/` — папку создаём при первом использовании.
4. **Именование файлов:** `av-v1_s03_key_v03.png`, `av-v1_s02_video_kling_v02.mp4`.
   Версия — всегда в имени, «final» запрещено.
5. **Seed-дисциплина:** один seed на серию, если платформа позволяет; иначе — один
   и тот же `--sref` и одинаковый текстовый STYLE TOKEN.
6. **Грейд:** без LUT. Только +2 контраста в светах, лёгкий roll-off, зерно 3–5 %,
   белый не трогать.
7. **Проверка серии:** все кадры рядом в контактном листе; если один кадр выпадает
   по свету/масштабу карточки — перегенерировать, а не «вытягивать» грейдом.

---

## 7. Аудио

### 7.1 Музыка

- 84 BPM, тональный центр A minor, размер 4/4.
- Инструменты: felt piano (близкий микрофон), маримба, стеклянный пэд, мягкий
  саб-пульс, тихий перкуссионный «бумажный» шорох.
- Структура: 0–7 s — две ноты мотива; 7–16 s — пэд и пульс; 16–25 s — маримба и
  арпеджио; 25–33 s — открытый аккорд и одна стеклянная нота в финал.
- Ощущение: сдержанное, тёплое, «наставник рядом», без триумфа.
- Запрещено: эпические ризеры, драм-дропы, trap-хэты, corporate ukulele,
  «вдохновляющие» струнные тутти, восторженные вокализы.

### 7.2 Звуковой дизайн

| Время | Событие | Звук | Уровень |
|---|---|---|---|
| 0:00 | старт | тихий room-tone бумаги | −30 dBFS |
| 0:04 | нить тянется | натяжение нити, почти шёлк | −20 |
| 0:07 | карта складывается | шелест бумаги, 3 коротких | −18 |
| 0:12 | слои расходятся | мягкий лифт-вуш | −19 |
| 0:16 | ветка наливается | «чернила в бумаге», без ризера | −22 |
| 0:21 | выбор | клик интерфейса + тихий тик | −20 |
| 0:25 | отъезд | воздушный вуш на отъезд | −24 |
| 0:29 | ядро загорается | одна стеклянная нота | −16 |
| 0:31 | вордмарк | мягкий клик, тишина | −26 |

### 7.3 Голос (формат B)

- Мужской или женский, 30–40 лет, тёплый, не «радийный», темп 130–140 слов/мин.
- 5 строк, ~35 слов на весь ролик, паузы длиннее обычных: зритель смотрит схему.
- Обращение на «ты», без восторга и давления (`COS-COM-010`).
- Запись: сухой близкий микрофон, без ревера; музыка автоматизируется под голос.

### 7.4 Микс и поставка

- Music/SFX: −18 dBFS под VO; интегральная громкость −14 LUFS, пик −1 dBTP.
- VO: −16 LUFS short-term, де-эссер, без компрессии «в бочку».
- Стемы: music / sfx / vo отдельными WAV 48 kHz 24 bit.

---

## 8. Пайплайн

| # | Шаг | Кто | Время | Выход |
|---|---|---|---|---|
| 1 | утвердить визуальный язык и контактный лист | владелец продукта | 0.5 дня | решение по §2–§3 |
| 2 | сгенерировать S03 (anchor), 4 варианта | промпт-дизайнер | 0.5 дня | `anchor_s03.png` |
| 3 | сгенерировать S01–S05 + S06a, по 4 варианта | промпт-дизайнер | 1 день | 24 изображения |
| 4 | image-to-video S01–S05, по 2–3 тейка | motion | 1 день | 15 клипов × 5 s |
| 5 | запись UI S06–S07 (2×), сборка S08 | motion | 1 день | клипы + mograph |
| 6 | монтаж, титры, match cut, грейд | motion | 1 день | мастер 33 s |
| 7 | звук, микс, версии 9:16/1:1/6 s loop | звук + motion | 1 день | поставка |

Бюджет генераций: ~32 изображения и ~15 видео на один ролик. При 2–3 итерациях
по кадрам — до 80 изображений; это нормальная цена консистентной серии.

---

## 9. Технические спецификации и поставка

| Параметр | Значение |
|---|---|
| Мастер | 3840×2160, 24 fps, ProRes 422 HQ, Rec.709 / sRGB, без HDR |
| Web | H.264 1920×1080, 18–20 Mbps, AAC 192 kbps, `-movflags +faststart` |
| Вертикаль | 1080×1920, 24 fps, H.264 12 Mbps |
| Квадрат | 1080×1080, 15 s, H.264 |
| Луп | 6 s без звука (S03 → S08), seamless по первому/последнему кадру |
| Громкость | −14 LUFS integrated, −1 dBTP |
| Безопасные поля | 96 px @1080p; в 9:16 — центральные 60 % по высоте |
| Цветовой контроль | `#F8FAFC` в кадре = `#F8FAFC` в мастере (пипетка, §10) |

Комплект поставки: `axiona-av-v1_16x9_33s`, `_16x9_30s`, `_9x16_33s`,
`_1x1_15s`, `_loop_6s`, `_bumper_0.6s`, плюс стемы звука и исходники титров.

---

## 10. QA-чеклист перед «готово»

Кадры:

- [ ] ни одного тёмного кадра и ни одного ухода в чёрный на переходах;
- [ ] белый фон пипеткой = `#F8FAFC` (±2), индиго не больше 6–8 % площади;
- [ ] на карточках нет сгенерированного текста, цифр, иконок;
- [ ] связи — физические нити, не молнии, не частицы, не «энергия»;
- [ ] нет людей, рук, техники, офиса, стекла, 3D-хрома;
- [ ] карточки не «дышат» и не деформируются между кадрами;
- [ ] тени сине-серые, не чёрные; глянца на бумаге нет.

Смысл и текст:

- [ ] каждый кадр открывает ровно один новый слой структуры;
- [ ] титры ≤6 слов, без восклицаний, без CAPS, без эмодзи, на «ты»;
- [ ] ни одного обещания, числа, процента, «уровня» и награды;
- [ ] VO не спорит с титрами и не пересказывает кадр.

Бренд:

- [ ] логотип и вордмарк — вектор из `public/brand`, не генерация;
- [ ] знак с индиговым ядром, пропорции не нарушены, охранное поле есть;
- [ ] UI-инсёрты — реальный интерфейс Beta 1, а не «нарисованный»;
- [ ] шрифт титров — Geist, вес и кегль по §2.6.

Звук и техника:

- [ ] −14 LUFS, −1 dBTP, стемы приложены;
- [ ] вертикальная версия проверена на телефоне, титры в безопасной зоне;
- [ ] луп без стыка, файл весит в пределах бюджета страницы.

---

## 11. Открытые вопросы

1. Формат по умолчанию — 16:9 или сразу 9:16? От этого зависит, какие кадры
   генерировать первыми (в 9:16 верхние полосы карты обрезаются).
2. Без VO (сайт, autoplay, muted) или с VO (соцсети)? Влияет на длину паузы и
   тайминг титров.
3. 33 s или сразу 30 s мастер? Разница — S03 и S05.
4. Метафора «бумага и нить» принимается как основа? Альтернатива — чистая 3D-сцена
   из тех же плоскостей; она дороже, но ближе к продуктовому CGI.
5. Показывать ли реальный UI Beta 1 (там 63–79 % покрытия и сырые состояния)?
   Если нет — S06–S07 заменяются на «схематичный» интерфейс, что слабее.
6. Музыка: лицензионный трек или заказ композитору? Требования — §7.1.
7. Нужен ли отдельный 6-секундный луп для главной страницы в этой итерации?

---

## Приложение A · STYLE TOKEN (вставлять в каждый кадровый промпт)

```text
STYLE TOKEN — AXIONA «Светлая структура»

Photoreal editorial product still of paper and thread. Paper-white surface
(#F8FAFC) with a barely visible dot grid: 2 px dots, 32–64 px rhythm. White matte
uncoated cards with 16 px rounded corners and a 1 px cool hairline edge (#E2E8F0)
float two millimetres above the surface. Hairline connectors (#C7D2E1, 1.5 px) and
restrained indigo accents (#4F46E5) are the only colour. One large soft daylight
source from the upper left; soft blue-grey shadows (#CAD4EB, 35–45% opacity);
high-key, no dark areas, no black shadows. Gentle depth of field, crisp subject
edges. Quiet, calm, ordered, expensive-looking restraint. 4% fine film grain.

The scene contains no text, no letters, no numbers, no glyphs, no logos, no
interface, no icons, no people, no hands.
```

## Приложение B · Глобальный негативный промпт

```text
text, letters, words, numbers, glyphs, watermark, signature, logo, ui, browser,
icons, people, hands, faces, skin, office, laptop, desk accessories, coffee,
dark background, black background, neon, glow, hologram, plexus, neural network,
particles, energy, lightning, electricity, lens flare, bokeh balls, chromatic
aberration, heavy vignette, hdr, oversaturated, teal and orange, glassmorphism,
chrome, glossy plastic, 3d render, cgi, isometric clipart, stock photo, collage,
motion blur, distorted card edges, warped geometry, duplicated objects, random
floating debris
```

## Приложение C · Перекадровка в 9:16

| Кадр | Что делать |
|---|---|
| S01 | карточка по центру, вертикальный ориентир — нить уходит вниз; пустоты сверху больше |
| S02 | активная пара карточек в центре, три дальних — по вертикали; нить вертикальнее |
| S03 | три полосы читаются как вертикальный стек: 4 / 5 / 4 карточки, ширина уменьшена |
| S04 | слои расходятся вверх — идеальная вертикаль, оставить воздух сверху |
| S05 | цепочка из трёх узлов по диагонали снизу-слева вверх-справа |
| S06 | рейл убрать, оставить канвас и панель компетенции, курсор в нижней трети |
| S07 | карта в fit-all, зум-контролы снизу, титр сверху |
| S08 | знак над вордмарком по центру, подпись в две строки |

Правило: вертикаль — не центр 16:9-кадра, а **своя композиция**; генерировать
`sref`-версию, а не кропить.

## Приложение D · Формула промпта и лечение типовых провалов

Формула: **план → ракурс → оптика → объекты → свет → STYLE TOKEN → запреты.**

| Симптом | Что добавить/убрать |
|---|---|
| тёмный, контрастный фон | `high-key, 85% white frame, no dark areas, background #F8FAFC` |
| неон, голограммы, «энергия» | `physical paper and a real thread only, no glow, no neon, no hologram` |
| на карточках появился текст | `cards are blank, no glyphs, no letters, no numbers` |
| глянцевые карточки | `matte uncoated paper, no specular highlight, no reflection` |
| «3D-рендер» вместо фото | `photograph, 50 mm lens, f/4, real paper texture, natural dust, no CGI` |
| слишком симметрично/скучно | `off-centre composition, generous negative space on the left` |
| связей слишком много | `only four threads, each connects two cards, nothing else` |
| карточки мелкие | `macro, the card fills 40% of the frame height` |
| в видео карточки «плывут» | `static camera, cards perfectly still, 1–2% motion only` |
| нить стала молнией | `a physical string with a slight sag, single strand, no branching` |
| появилась глубина/контражур | `flat even overhead daylight, no rim light, no side light` |
| тени чёрные | `shadows are blue-grey #CAD4EB, never black` |

## Приложение E · Файлы

| Артефакт | Путь |
|---|---|
| Этот документ | `docs/06-communication/COS-COM-011-Audiovisual-Prompt-Kit.md` |
| Рендер раскадровки (генератор) | `scripts/av/storyboard.mjs` |
| Контактный лист | `docs/design/av/storyboard-contact-sheet.png` |
| HTML раскадровки | `docs/design/av/storyboard.html` |
| Векторные кадры | `docs/design/av/s01.svg … s08.svg` |
| PNG кадров | `docs/design/av/frames/s01.png … s08.png` |
| Машинная связка кадр → спека | `docs/design/av/frames.json` |
| Токены | `apps/web/src/app/globals.css` |
| Знак и вордмарк | `apps/web/public/brand/logo-mark.svg`, `logo-wordmark.svg` |
| Визуальная философия | `docs/06-communication/COS-COM-006-Visual-Language.md` |
| Голос и правила текста | `docs/06-communication/COS-COM-010-Voice-and-Tone.md` |
