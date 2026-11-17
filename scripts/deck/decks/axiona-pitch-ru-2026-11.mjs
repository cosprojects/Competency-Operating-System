/**
 * AXIONA — Investor deck · Казахстан first · 2026-11
 *
 * Контент: docs/08-business-plan/COS-BP-023-Designer-Copy-Kazakhstan.md
 * (финальный copy deck от 2026-11-13). Цифры — COS-BP-017/018, источники S-01…S-45.
 * В этом раунде не показываем цены, тарифы, выручку и платящих: их нет.
 *
 * Правки смысла не приветствуются: текст уже согласован. Верстальщик может
 * менять композицию и переносы, но не цифры и не утверждения.
 */
import {
  T, esc, icon, chip, tag, stat, card, bullets, route, screenshot, person,
  rowsTable, donut, inlineMap, logoMark, logoWordmark, logoLockup,
} from "../engine.mjs";

const footerCover = (n, left) => `<footer class="footer footer--bare">
  <div class="footer__src">${left}</div>
  <div class="footer__right">${logoMark({ width: 16, height: 15 })}<span>${String(n).padStart(2, "0")} / 14</span></div>
</footer>`;

const cover = (slide) => slide.html;

export const deck = {
  slug: "axiona-investor-deck-2026-11",
  title: "AXIONA — Investor deck · Казахстан first",
  lang: "ru",
  meta: {
    description: "14 слайдов для инвесторского питча AXIONA: карта компетенций, обучение, проверка, доказательства роста. Запуск из Беларуси, Казахстан first, Европа English, РФ — тест.",
  },
  slides: [
    // ---------------------------------------------------------------- 01 Title
    {
      id: "title",
      section: "Title",
      time: "0:30",
      theme: "dark",
      bare: true,
      notes:
        "Мы строим систему, которая помогает человеку понять разрыв, учиться и доказывать прогресс. Продукт уже работает; сейчас pre-traction, первые тесты — на дизайн-сообществе. В этом раунде показываем продукт, рынок и план проверки, без коммерческого слоя.",
      html: cover({
        html: `<div class="cover">
          <div class="cover__top">
            <div class="cover-logo">${logoMark({ white: true, width: 44, height: 41 })}${logoWordmark({ white: true, width: 146, height: 24 })}</div>
            <div class="cover__meta">Investor deck · 2026-11 · 10–12 минут</div>
          </div>
          <div class="cover__map">${inlineMap("map-europe-cis-dark-plain.svg")}</div>
          <div class="cover__shade" aria-hidden="true"></div>
          <div class="cover__body">
            <div class="cover__route"><span>Минск · запуск</span><span class="dash"></span><span>Алматы · первый рынок</span><span class="dash"></span><span>Европа · English</span></div>
            <h1>Система профессионального<br/>развития</h1>
            <p class="cover__lede">Карта компетенций → обучение → проверка → доказательства роста. AI-native Competency Operating System.</p>
            <div class="cover__tags">
              <span class="tag tag--on">Pre-traction</span>
              <span class="tag">продукт работает</span>
              <span class="tag">closed Beta</span>
              <span class="tag">Казахстан first</span>
            </div>
            <div class="cover__people">
              <div class="cover__person"><b>Кирилл Невзоров</b> — co-founder / CTO / Product Owner<span>продукт и разработка</span></div>
              <div class="cover__person"><b>Луиза Смольская</b> — founder / CEO<span>исследования, методология, оценка</span></div>
            </div>
          </div>
          <div class="cover__contact"><b>app.axiona.world</b><span>hi.axiona@protonmail.com</span></div>
          ${footerCover(1, "AXIONA / Competency Operating System · investor deck")}
        </div>`,
      }),
    },

    // --------------------------------------------------------------- 02 Problem
    {
      id: "problem",
      section: "Problem",
      time: "1:00",
      kicker: "Проблема",
      title: "Люди не понимают разрыв — и учатся без доказательств",
      lede: "Боль не в доступе к контенту — его много и он дешёвый. Боль в навигации, проверке и доказательстве.",
      footerSource: "Источник: WEF Future of Jobs 2025",
      notes:
        "Боль не в доступе к контенту — его много и он дешёвый. Боль в навигации, проверке и доказательстве. Это одинаково в СНГ и Европе.",
      html: `<div class="grid-2" style="grid-template-columns: 1.08fr .92fr; gap: 34px; align-items: stretch;">
        <div class="stackcol">
          ${bullets([
            "Курсы фрагментированы: после них нет карты, проверки и <b>evidence</b>.",
            "AI меняет требования: <b>39% навыков изменятся к 2030</b> (WEF).",
            "Работодатель не видит разницы между «прошёл курс» и «умеет».",
            "Карьерный переход дорогой и непрозрачный.",
          ])}
          ${card({
            eyebrow: "Определение",
            title: "Разрыв — это цель минус текущий уровень",
            text: "Без диагностики его не видно; без evidence — нечего показать работодателю. Курс закрывает доступ к контенту, но не этот разрыв.",
            className: "mt-16",
          })}
        </div>
        <div class="gapflow">
          <div class="gapflow__item">
            <span class="gapflow__ic">${icon("lesson", { size: 22 })}</span>
            <div class="gapflow__body"><b>Курс</b><span>видео, файлы, вебинары</span></div>
          </div>
          <span class="gapflow__link"></span>
          <div class="gapflow__item">
            <span class="gapflow__ic">${icon("star", { size: 22 })}</span>
            <div class="gapflow__body"><b>Сертификат</b><span>факт просмотра, не уровня</span></div>
          </div>
          <span class="gapflow__link"></span>
          <div class="gapflow__item is-q">
            <span class="gapflow__ic">${icon("gap", { size: 22 })}</span>
            <div class="gapflow__body"><b>?</b><span>нет карты, проверки и следующего шага</span></div>
          </div>
        </div>
      </div>
      <div class="takeaway"><div class="takeaway__k">Вывод</div><div class="takeaway__t">Разрыв — не между человеком и контентом, а <b>между обучением и доказательством</b>. Отсюда — фрагментация, дорогой переход и невидимый прогресс.</div></div>`,
    },

    // ---------------------------------------------------------------- 03 Why now
    {
      id: "why-now",
      section: "Why now",
      time: "1:00",
      kicker: "Почему сейчас",
      title: "AI ускорил переобучение,<br/>а Казахстан и Европа инвестируют в навыки",
      lede: "Четыре факта, которые объясняют окно возможностей — без «рынок вырастет сам».",
      footerSource: "Источники: S-38, S-39, S-40, S-41 · WEF Future of Jobs 2025",
      notes:
        "Российский рынок мы не берём в расчёт — там тестируем. Экономика истории — Европа и СНГ, запуск из Беларуси.",
      html: `<div class="stat-grid grid-4" style="margin-top: 2px;">
        ${stat({ value: "$103,9", unit: "млрд", label: "онлайн-образование Европы, 2025", note: "CAGR 10,44% до 2034", className: "stat--tall" })}
        ${stat({ value: "39,5", unit: "%", label: "взрослых в ЕС учатся", note: "цели: 47% к 2025 · 60% к 2030", className: "stat--tall" })}
        ${stat({ value: "СНГ", label: "взрослое онлайн-ДПО и цифровые профессии", note: "Казахстан, Узбекистан — быстрый рост", className: "stat--tall" })}
        ${stat({ value: "$3", unit: "млрд", label: "экспорт ИТ-услуг ПВТ Беларуси", note: "61 тыс. специалистов — база запуска", className: "stat--tall" })}
      </div>
      <div class="card card--plain mt-24" style="padding: 16px 20px; display: flex; flex-direction: row; align-items: center; gap: 14px; border: 1px solid var(--line-soft);">
        <span class="card__ic" style="margin: 0; flex: 0 0 38px;">${icon("progress", { size: 22 })}</span>
        <p class="card__x" style="font-size: 15px; color: #334155;">
          <b>Выигрывает не контент, а система:</b> разрыв → практика → доказательство → следующий шаг.
          Поэтому наш продукт — не курс, а инфраструктура развития.
        </p>
      </div>
      <div class="takeaway"><div class="takeaway__k">Для нас</div><div class="takeaway__t">Сначала Европа и СНГ, запуск из Беларуси, РФ — тест. <b>Wedge — карта, проверка и evidence</b>, а не ещё один курс.</div></div>`,
    },

    // --------------------------------------------------------------- 04 Solution
    {
      id: "solution",
      section: "Solution",
      time: "1:30",
      kicker: "Решение",
      title: "Один контур: цель → разрыв → путь → практика → доказательство → следующий шаг",
      lede: "Не школа и не job board — слой навигации и доказательств.",
      footerSource: "Карта: сфера → профессия → компетенция → знания/навыки → материалы",
      notes:
        "Мы не продаём контент. Мы продаём понятный путь и доказательство, что человек продвинулся.",
      html: `<div style="margin-top: 0;">
        ${route([
          { icon: "target", name: "Цель", sub: "роль и уровень" },
          { icon: "gap", name: "Разрыв", sub: "что не хватает" },
          { icon: "route", name: "Путь", sub: "персональный маршрут" },
          { icon: "lesson", name: "Практика", sub: "10–20 минут" },
          { icon: "evidence", name: "Доказательство", sub: "квиз, mastery, проект" },
          { icon: "progress", name: "Следующий шаг", sub: "уровень и история" },
        ], { activeFrom: 0 })}
        <div class="grid-4 mt-24" style="margin-top: 30px;">
          ${card({ iconName: "map", eyebrow: "Карта", title: "Структура профессии", text: "Сфера → профессия → компетенция → знания и навыки → материалы." })}
          ${card({ iconName: "target", eyebrow: "Диагностика", title: "Где человек сейчас", text: "Самооценка и мини-тест. Про личность — не собираем." })}
          ${card({ iconName: "lesson", eyebrow: "Обучение", title: "10–20 минут", text: "Микро-уроки, квизы и mastery-проверки по компетенции." })}
          ${card({ iconName: "progress", eyebrow: "Прогресс", title: "Видно, что изменилось", text: "Уровень, история, FSRS, dashboard и следующий шаг." })}
        </div>
        <div class="takeaway"><div class="takeaway__k">Смысл</div><div class="takeaway__t">Карта — не каталог, а <b>маршрут</b>: каждая компетенция ведёт к следующему шагу, а не просто лежит в списке.</div></div>
      </div>`,
    },

    // ---------------------------------------------------------------- 05 Product
    {
      id: "product",
      section: "Product",
      time: "1:00",
      kicker: "Продукт",
      title: "Уже работает: 13 профессий, 132 компетенции, 292 связи",
      lede: "app.axiona.world — карта профессий, профиль, сохранения и статусы. Честная граница: обучение — следующий слой.",
      footerSource: "Данные продукта на 2026-11-13 · QA 77/79 PASS, 0 FAIL · app.axiona.world",
      notes:
        "Показываем живой продукт, но честно: обучение — следующий слой, не текущая функция. РФ — только тест.",
      html: `<div class="grid-2" style="grid-template-columns: .86fr 1.14fr; gap: 30px; align-items: start; height: 100%;">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="stat-grid" style="grid-template-columns: 1fr 1fr;">
            ${stat({ value: "13", label: "профессий", tone: "accent", className: "stat--mid" })}
            ${stat({ value: "132", label: "компетенции в модели", tone: "accent", className: "stat--mid" })}
            ${stat({ value: "131", label: "компетенция опубликована", tone: "accent", className: "stat--mid" })}
            ${stat({ value: "292", label: "связи", tone: "accent", className: "stat--mid" })}
          </div>
          ${bullets([
            "Production VDS, TLS, backup; QA <b>77/79 PASS, 0 FAIL</b>.",
            "Тест — дизайн-сообщество в РФ; регистрация закрыта.",
            "Следующий слой: диагностика, уроки, квизы, evidence.",
          ], { className: "mt-8" })}
        </div>
        <div class="stack" style="position: relative; height: 420px;">
          ${screenshot({ src: "assets/screens/profession-map.png", alt: "Карта профессии 3D-дизайнер в AXIONA: компетенции и связи", className: "shot--big", slot: "map" })}
          ${screenshot({ src: "assets/screens/saved.png", alt: "Профиль «Сохранённое»: профессии, компетенции и прогресс", className: "shot--small", slot: "saved" })}
        </div>
      </div>`,
    },

    // ------------------------------------------------------------- 06 Learning
    {
      id: "learning-loop",
      section: "Learning loop",
      time: "1:30",
      kicker: "Learning loop",
      title: "Не «посмотрел видео», а «проверил и доказал»",
      lede: "Диагностика → урок → квиз → практика → evidence → следующий шаг.",
      footerSource: "Learning science: retrieval, spacing, mastery, deliberate practice",
      notes:
        "Главный риск — не бюджет, а качество learning loop. Поэтому сначала 3 профессии, а не 50.",
      html: `<div class="grid-2" style="grid-template-columns: 1.02fr .98fr; gap: 34px; align-items: start;">
        <div>
          <div class="steps">
            <div class="step"><span class="step__n">${icon("target", { size: 18 })}</span><div><div class="step__t">Диагностика</div><div class="step__x">Где человек сейчас и где цель.</div></div></div>
            <div class="step"><span class="step__n">${icon("quiz", { size: 18 })}</span><div><div class="step__t">Урок → квиз → mastery</div><div class="step__x">Проверка по компетенции, а не по факту просмотра.</div></div></div>
            <div class="step"><span class="step__n">${icon("lesson", { size: 18 })}</span><div><div class="step__t">Практика</div><div class="step__x">Проект или артефакт; для нецифровых — фото и видео.</div></div></div>
            <div class="step"><span class="step__n">${icon("eye", { size: 18 })}</span><div><div class="step__t">AI-фидбек по рубрике</div><div class="step__x">Черновики проверки; финальное решение — за человеком.</div></div></div>
            <div class="step"><span class="step__n">${icon("progress", { size: 18 })}</span><div><div class="step__t">Фиксация</div><div class="step__x">Competency level, история, FSRS, следующий шаг.</div></div></div>
          </div>
          <div class="card card--plain mt-20" style="padding: 13px 16px; border: 1px solid var(--line-soft);">
            <div class="card__eyebrow" style="margin-bottom: 3px;">MVP</div>
            <div class="card__x" style="font-size: 13px; color: #334155;"><b>3 профессии</b> · 3–5 уроков · 5–10 квизов · 1 проект</div>
          </div>
          <div class="note-line mt-16">${icon("evidence", { size: 18 })}<span>Evidence — не сертификат, а подтверждённый результат: квиз, mastery, проект.</span></div>
        </div>
        <div>
          ${screenshot({ src: "assets/screens/competency.png", alt: "Карточка компетенции в AXIONA: знания, навыки и материалы", slot: "competency" })}
        </div>
      </div>
      <div class="takeaway"><div class="takeaway__k">Риск</div><div class="takeaway__t">Главный риск — не бюджет, а <b>качество learning loop</b>. Поэтому MVP — 3 профессии, а не 50.</div></div>`,
    },

    // ------------------------------------------------------------ 07 Kazakhstan
    {
      id: "kazakhstan-first",
      section: "Kazakhstan first",
      time: "1:00",
      kicker: "Первый рынок",
      title: "Казахстан first: язык, спрос и локальные каналы",
      lede: "Не «большой рынок без цифр», а конкретный первый рынок для проверки.",
      footerSource: "Казахстан — первый рынок проверки; РФ — тест",
      notes:
        "Казахстан — первый рынок проверки: язык, спрос, локальные каналы. Решение о коммерческом слое — после пилота.",
      html: `<div class="grid-2" style="grid-template-columns: .98fr 1.02fr; gap: 34px; align-items: start;">
        <div>
          ${bullets([
            "Русский язык и знакомая аудитория; высокий спрос на цифровые профессии.",
            "Взрослое онлайн-ДПО растёт; локальные каналы — Telegram, Instagram, вузы.",
            "Пилот: <b>5–10 тыс. регистраций</b>, 10% email capture, D7 20% — бесплатно.",
            "Коммерческий слой — после пилота; в этом раунде не показываем.",
          ])}
          <div class="row mt-24" style="gap: 7px;">
            ${chip("Telegram / Instagram", { iconName: "users" })}
            ${chip("вузы и Astana Hub", { iconName: "lesson" })}
            ${chip("локальные партнёры", { iconName: "link" })}
          </div>
        </div>
        <div class="map-frame">
          ${inlineMap("map-kazakhstan.svg")}
          <div class="map-note">Схема рынка, не политическая карта: без границ, флагов и орнаментов.</div>
        </div>
      </div>
      <div class="takeaway"><div class="takeaway__k">Фокус</div><div class="takeaway__t">Казахстан — не «большой рынок», а <b>первый рынок для проверки спроса и удержания</b>. Пилот бесплатный, решение — по данным.</div></div>`,
    },

    // ---------------------------------------------------------------- 08 Market
    {
      id: "market",
      section: "Market",
      time: "1:00",
      kicker: "Рынок",
      title: "Европа — большой рынок;<br/>Казахстан и СНГ — быстрый рост; РФ — тест",
      lede: "Не «TAM $104 млрд, значит мы вырастем», а конкретный wedge в Европе и СНГ.",
      footerSource: "Источники: S-38, S-39, S-40, S-01",
      notes:
        "Мы не обещаем выиграть весь EdTech. Нам нужен wedge в Европе и СНГ и доказанная экономика на нём.",
      html: `<div class="stat-grid grid-3">
        ${stat({ value: "$103,9", unit: "млрд", label: "TAM · онлайн-образование Европы, 2025" })}
        ${stat({ value: "$3,4–6,0", unit: "млрд", label: "SAM · Европа + СНГ, bottom-up" })}
        ${stat({ value: "15–20", unit: "тыс.", label: "регистраций за 24 месяца — пилот" })}
      </div>
      <div class="grid-2 mt-24" style="grid-template-columns: .92fr 1.08fr; gap: 32px; align-items: center;">
        <div>
          ${bullets([
            "Европа: <b>39,5%</b> взрослых учатся; цели 47% и 60%.",
            "Казахстан: цифровые профессии и взрослое онлайн-ДПО.",
            "РФ: 217 тыс. дизайнеров — тест продукта, не рынок.",
          ])}
        </div>
        <div class="map-frame">
          ${inlineMap("map-europe-cis.svg")}
          <div class="map-note">Схема: Европа и СНГ, без политических границ. РФ — только тест.</div>
        </div>
      </div>`,
    },

    // --------------------------------------------------------------- 09 Roadmap
    {
      id: "roadmap",
      section: "Pilot / roadmap",
      time: "1:30",
      kicker: "Pilot / roadmap",
      title: "Pre-traction: продукт есть, метрик ещё нет —<br/>это предмет инвестиции",
      lede: "Не выдаём гипотезы за тракшн: 24 месяца и понятные ворота.",
      footerSource: "Ворота T1/T2 · COS-BP-023",
      notes:
        "Мы не выдаём гипотезы за тракшн. Инвестор финансирует проверку: 24 месяца и понятные ворота.",
      html: `<div class="timeline">
        <div class="tcol is-now">
          <div class="tcol__dot"></div>
          <div class="tcol__card">
            <div class="tcol__when">Сейчас</div>
            <div class="tcol__title">Продукт работает. Метрик ещё нет</div>
            <ul class="tcol__list">
              <li>13 профессий, 292 связи</li>
              <li>карта, профиль, сохранения</li>
              <li>production, closed Beta</li>
              <li>тест — дизайн-сообщество в РФ</li>
            </ul>
          </div>
        </div>
        <div class="tcol">
          <div class="tcol__dot"></div>
          <div class="tcol__card">
            <div class="tcol__when">T1 · 12 месяцев</div>
            <div class="tcol__title">Бесплатный пилот в Казахстане</div>
            <ul class="tcol__list">
              <li>5–10 тыс. регистраций</li>
              <li>10% email, D7 20%</li>
              <li>learning MVP: 3 профессии</li>
              <li>Казахстан, русский язык</li>
            </ul>
          </div>
        </div>
        <div class="tcol">
          <div class="tcol__dot"></div>
          <div class="tcol__card">
            <div class="tcol__when">T2 · 24 месяца</div>
            <div class="tcol__title">Казахстан + Европа English</div>
            <ul class="tcol__list">
              <li>15–20 тыс. регистраций</li>
              <li>D7/D30, 300+ активных</li>
              <li>8–10 профессий, evidence</li>
              <li>СНГ + Европа English</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="gates">
        <div class="gates__item"><span class="gates__k">Ворота T1</span><span class="gates__v">активация ≥40% · D7 ≥20% · 10% email</span></div>
        <div class="gates__item"><span class="gates__k">Ворота T2</span><span class="gates__v">D30 ≥10% · 300+ активных · проверка спроса</span></div>
      </div>
      <div class="takeaway"><div class="takeaway__k">Правило</div><div class="takeaway__t">${icon("alert", { size: 20 })} Если не проходим ворота — <b>пивот или сокращение</b>, а не «дорисовываем» план.</div></div>`,
    },

    // ----------------------------------------------------------- 10 Competition
    {
      id: "competition",
      section: "Competition",
      time: "1:00",
      kicker: "Конкуренты",
      title: "Не школа и не job board — слой навигации и доказательств",
      lede: "Конкурируем не контентом, а связкой карта → проверка → evidence → следующий шаг.",
      footerSource: "Нас могут скопировать по контенту, но не по связке карта → проверка → evidence",
      notes:
        "Нас могут скопировать по контенту, но не по связке карта → проверка → evidence → следующий шаг.",
      html: `${rowsTable({
        head: ["Категория", "Игроки в Европе и СНГ", "Наше отличие"],
        rows: [
          { cells: ["<b>Массовые курсы</b>", "Coursera, Udemy, LinkedIn Learning", "карта + разрыв + evidence"] },
          { cells: ["<b>Школы</b>", "Skillbox, Netology, локальные школы", "переход и рост, не «с нуля»"] },
          { cells: ["<b>AI-курсы</b>", "мелкие игроки", "методология, оценка, human review"] },
          { cells: ["<b>Career services</b>", "консультанты, hh", "масштабируемая система"] },
          { cells: ["<b>LMS</b>", "Moodle, Open edX", "consumer-навигация"] },
        ],
      })}
      <div class="glue mt-16">
        <span class="glue__k">Связка</span>
        ${chip("карта", { iconName: "map" })}
        <span class="glue__arr">${icon("arrow", { size: 14 })}</span>
        ${chip("разрыв", { iconName: "gap" })}
        <span class="glue__arr">${icon("arrow", { size: 14 })}</span>
        ${chip("evidence", { iconName: "evidence" })}
        <span class="glue__arr">${icon("arrow", { size: 14 })}</span>
        ${chip("следующий шаг", { iconName: "progress" })}
      </div>
      <div class="takeaway"><div class="takeaway__k">Защита</div><div class="takeaway__t">Контент копируется. <b>Связка карта → проверка → evidence → следующий шаг — нет.</b></div></div>`,
    },

    // -------------------------------------------------------------------- 11 GTM
    {
      id: "gtm",
      section: "Go-to-market",
      time: "1:00",
      kicker: "Go-to-market",
      title: "Казахстан first → СНГ → Европа English",
      lede: "Сначала сообщество и SEO, потом масштаб. РФ — тест, не рынок.",
      footerSource: "Платный трафик — только после retention/CAC",
      notes:
        "Мы не покупаем трафик до того, как поняли retention. Сначала сообщество и SEO, потом масштаб.",
      html: `<div class="gtm">
        <div class="gtm__card is-first">
          <div class="gtm__stage">Шаг 1 · first</div>
          <div class="gtm__title">Казахстан</div>
          <p class="gtm__x">Telegram и Instagram, локальные инфлюенсеры, вузы и Astana Hub, работодатели.</p>
          <div class="gtm__check">Проверяем: 5–10 тыс. регистраций, 10% email, D7 20%.</div>
          <div class="gtm__chips">${tag("Telegram")}${tag("Instagram")}${tag("вузы")}${tag("Astana Hub")}</div>
        </div>
        <div class="gtm__arrow">${icon("arrow", { size: 20 })}</div>
        <div class="gtm__card">
          <div class="gtm__stage">Шаг 2</div>
          <div class="gtm__title">СНГ</div>
          <p class="gtm__x">Русскоязычные сообщества, партнёры, карьерные консультанты.</p>
          <div class="gtm__check">Проверяем: удержание на русскоязычных рынках.</div>
          <div class="gtm__chips">${tag("сообщества")}${tag("партнёры")}${tag("карьера")}</div>
        </div>
        <div class="gtm__arrow">${icon("arrow", { size: 20 })}</div>
        <div class="gtm__card">
          <div class="gtm__stage">Шаг 3 · English</div>
          <div class="gtm__title">Европа</div>
          <p class="gtm__x">Английский SEO, LinkedIn, outplacement, релокационные сообщества.</p>
          <div class="gtm__check">Проверяем: English-воронку и органический поиск.</div>
          <div class="gtm__chips">${tag("SEO")}${tag("LinkedIn")}${tag("outplacement")}</div>
        </div>
      </div>
      <div class="grid-2 mt-24" style="gap: 18px;">
        <div class="principle">
          <span class="principle__ic">${icon("chart", { size: 19 })}</span>
          <div><div class="principle__t">Платный трафик — после retention</div><div class="principle__x">Сначала сообщество, SEO и органический рост; затем масштаб.</div></div>
        </div>
        <div class="principle">
          <span class="principle__ic">${icon("users", { size: 19 })}</span>
          <div><div class="principle__t">B2B — после пилота</div><div class="principle__x">3–5 пилотов после первых данных о поведении и удержании.</div></div>
        </div>
      </div>
      <div class="first1000 mt-16">
        <span class="first1000__k">Первые 1000</span>
        <span class="first1000__s">сообщество</span>
        <span class="first1000__arr">${icon("arrow", { size: 14 })}</span>
        <span class="first1000__s">SEO</span>
        <span class="first1000__arr">${icon("arrow", { size: 14 })}</span>
        <span class="first1000__s">партнёры</span>
        <span class="first1000__n">без платного трафика</span>
      </div>
      <div class="takeaway"><div class="takeaway__k">Порядок</div><div class="takeaway__t">Сначала сообщество и SEO. <b>Платный трафик и B2B — только после данных</b> о retention и CAC.</div></div>`,
    },

    // ------------------------------------------------------------------ 12 Team
    {
      id: "team",
      section: "Team / legal",
      time: "1:00",
      kicker: "Команда / legal",
      title: "Founder + co-founder/CTO + AI-агенты",
      lede: "Не приукрашиваем: два человека и агенты. Риск закрываем наймом и документацией.",
      footerSource: "Патент RU2863772C1 · лицензия компании · GDPR для Европы",
      notes:
        "Мы не приукрашиваем команду: два человека и агенты. Это риск, который закрывается наймом и документацией.",
      html: `<div class="grid-2" style="grid-template-columns: 1.02fr .98fr; gap: 30px; align-items: start;">
        <div class="persons" style="grid-template-columns: 1fr; gap: 12px;">
          ${person({
            initials: "ЛС",
            name: "Луиза Смольская",
            role: "Founder / CEO",
            note: "Исследования, методология, оценка. Владелец патента RU2863772C1.",
          })}
          ${person({
            initials: "КН",
            name: "Кирилл Невзоров",
            role: "Co-founder / CTO / Product Owner",
            note: "Разработка и продукт: карта, интерфейс, инфраструктура.",
            tone: "sky",
          })}
          <div class="card" style="padding: 14px 18px;">
            <div class="card__eyebrow" style="margin-bottom: 6px;">Найм после T1</div>
            <div class="row" style="gap: 6px;">${tag("контент-лид")}${tag("инженер")}${tag("методолог")}${tag("юрист")}</div>
          </div>
        </div>
        <div class="card">
          <div class="card__eyebrow">Legal-рамка</div>
          ${bullets([
            "AI-агенты — операционная модель, не «команда».",
            "Патент — у Луизы, исключительная лицензия компании; 70/25/5 до инвестиций.",
            "Сейчас оператор теста — самозанятый РФ (НПД); для инвестиций — юрлицо Казахстана/ЕС.",
            "РФ — тест; для Европы — GDPR; нужен юрист.",
          ], { className: "mt-8" })}
        </div>
      </div>
      <div class="takeaway"><div class="takeaway__k">Честно</div><div class="takeaway__t">Два человека и агенты — риск, который закрывается <b>наймом и документацией</b>. Патент — у основателя, исключительная лицензия — у компании.</div></div>`,
    },

    // ------------------------------------------------------------------- 13 Ask
    {
      id: "ask",
      section: "Ask",
      time: "1:30",
      kicker: "Ask",
      title: "$120 тыс. на 24 месяца:<br/>$84 тыс. T1 + $36 тыс. T2",
      lede: "Lean-план: 4–6 профессий, пилот Казахстан, проверка спроса и удержания.",
      footerSource: "Use of funds · транши 7 + 3 млн ₽ · 24 месяца",
      notes:
        "120 тысяч — это не «на всё». Это на 24 месяца, 4–6 профессий и проверку спроса. Дальше — следующий раунд или B2B.",
      html: `<div class="grid-2" style="grid-template-columns: 1.06fr .94fr; gap: 32px; align-items: start;">
        <div class="card" style="padding: 18px 20px;">
          <div class="card__eyebrow" style="margin-bottom: 10px;">Use of funds · ≈10 млн ₽</div>
          <div class="use">
            <div class="use__row"><div class="use__l">Зарплаты основателей<small>100 тыс. ₽ на руки</small></div><div class="use__v">6,5–7,2 млн ₽</div></div>
            <div class="use__row"><div class="use__l">Сервисы и API<small>инфраструктура, модели, хостинг</small></div><div class="use__v">0,6–1,0 млн ₽</div></div>
            <div class="use__row"><div class="use__l">Подрядчики<small>дизайн, контент, разработка</small></div><div class="use__v">0,8–1,2 млн ₽</div></div>
            <div class="use__row"><div class="use__l">Контент и обучение, 4–6 профессий</div><div class="use__v">0,6–0,9 млн ₽</div></div>
            <div class="use__row"><div class="use__l">Legal и резерв</div><div class="use__v">0,7–1,0 млн ₽</div></div>
          </div>
        </div>
        <div>
          ${donut([
            { label: "Зарплаты основателей", value: 6.85, display: "6,5–7,2", color: "#3730a3" },
            { label: "Сервисы и API", value: 0.8, display: "0,6–1,0", color: "#4f46e5" },
            { label: "Подрядчики", value: 1.0, display: "0,8–1,2", color: "#6366f1" },
            { label: "Контент и обучение", value: 0.75, display: "0,6–0,9", color: "#818cf8" },
            { label: "Legal и резерв", value: 0.85, display: "0,7–1,0", color: "#a5b4fc" },
          ], { centerTop: "$120", centerSub: "тыс. · 24 мес" })}
          <div class="note-line mt-16" style="align-items: flex-start;">${icon("evidence", { size: 18 })}<span><b>$120 тыс. за ~40%:</b> 7 млн ₽ T1 + 3 млн ₽ T2. 10 млн ₽ — lean: 24 месяца с 4–6 профессиями.</span></div>
        </div>
      </div>
      <div class="tranches">
        <div class="tranche tranche--t1"><b>T1 · 12 месяцев</b><span>7 млн ₽ · $84 тыс. · пилот Казахстан</span></div>
        <div class="tranche tranche--t2"><b>T2 · 12 месяцев</b><span>3 млн ₽ · $36 тыс. · СНГ + Европа</span></div>
      </div>
      <div class="takeaway"><div class="takeaway__k">Фокус</div><div class="takeaway__t">24 месяца — это <b>retention и learning loop</b>, а не гонка за масштабом. Решение о следующем раунде — по воротам T1/T2.</div></div>`,
    },

    // ---------------------------------------------------------------- 14 Vision
    {
      id: "vision",
      section: "Vision / close",
      time: "0:30",
      theme: "dark",
      bare: true,
      notes:
        "Если верите, что рынок профессионального развития станет инфраструктурой — давайте проверим это вместе.",
      html: `<div class="cover close">
        <div class="cover__top">
          <div class="cover-logo">${logoMark({ white: true, width: 40, height: 38 })}${logoWordmark({ white: true, width: 132, height: 22 })}</div>
          <div class="cover__meta">Vision / close</div>
        </div>
        <div class="close__map">${inlineMap("map-europe-cis-dark-plain.svg")}</div>
        <div class="cover__shade" aria-hidden="true"></div>
        <div class="cover__body" style="max-width: 1000px; margin-top: 48px;">
          <div class="kicker" style="color: #8fb4ff;">Куда идём</div>
          <h2 style="margin-top: 14px; font-size: 51px; line-height: 1.06; letter-spacing: -.04em; font-weight: 600; color: #fff; max-width: 1000px;">
            Профессии меняются —<br/>способность учиться и доказывать рост остаётся.
          </h2>
          <div class="close__theses">
            ${card({ iconName: "map", eyebrow: "Слой", title: "Навигация и доказательства", text: "Между человеком, обучением и работой — не ещё один курс." })}
            ${card({ iconName: "globe", eyebrow: "География", title: "Казахстан → СНГ → Европа", text: "Запуск из Беларуси; РФ — тест. Европа — English." })}
            ${card({ iconName: "progress", eyebrow: "Цель", title: "Развитие как инфраструктура", text: "Управляемое, как финансы или проекты: карта, прогресс, evidence." })}
          </div>
          <div class="close__ask">
            <span class="chip chip--dark">Ask: $120 тыс. · 7 + 3 транша · 24 месяца</span>
            <span class="tag">hi.axiona@protonmail.com</span>
            <span class="tag">app.axiona.world</span>
          </div>
        </div>
        ${footerCover(14, "AXIONA / Competency Operating System · investor deck · 2026-11")}
      </div>`,
    },
  ],
};

// Небольшая проверка целостности контента на этапе сборки: цифры из copy deck.
export const REQUIRED_NUMBERS = [
  { id: "professions", token: "13 профессий", label: "13 профессий" },
  { id: "competencies-model", token: "132 компетенции", label: "132 компетенции в модели" },
  { id: "competencies-published", token: "131 компетенция опубликована", label: "131 опубликована" },
  { id: "links", token: "292 связи", label: "292 связи" },
  { id: "ask", token: "$120 тыс.", label: "$120 тыс. ask" },
];

export const REQUIRED_ICONS = [
  { id: "map", label: "карта" },
  { id: "gap", label: "разрыв" },
  { id: "lesson", label: "урок" },
  { id: "quiz", label: "квиз" },
  { id: "evidence", label: "evidence" },
  { id: "progress", label: "прогресс" },
];
