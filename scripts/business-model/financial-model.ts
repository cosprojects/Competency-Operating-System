/**
 * COS-BP-008 — финансовая модель AXIONA на 24 месяца.
 *
 * Воспроизводимый расчёт: один входной набор допущений, три сценария,
 * помесячный ряд, свёрнутый в 8 календарных кварталов (2027-Q1 … 2028-Q4).
 *
 * Запуск:
 *   node --experimental-strip-types scripts/business-model/financial-model.ts
 *   node --experimental-strip-types scripts/business-model/financial-model.ts --json
 *
 * Артефакты:
 *   docs/08-business-plan/reports/bp-008-model.md
 *   docs/08-business-plan/reports/bp-008-model.csv
 *
 * Модель — план, а не прогноз: все конверсии, цены и расходы — допущения (ДП)
 * и проверяются на Beta. Никаких внешних зависимостей, кроме Node.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type PriceStep = { fromMonth: number; price: number };

type ScenarioSpec = {
  id: string;
  title: string;
  /** Трафик: посетители/мес. */
  visitors: { start: number; growth: number; cap: number };
  /** Доля посетителей, создавших аккаунт. */
  registrationRate: number;
  /** Платный слой: месяц включения (1-based), конверсия новой регистрации и
   *  разовая конверсия накопленной бесплатной базы в месяц запуска. */
  paid: { startMonth: number; conversion: number; backlogConversion: number };
  /** Цена подписки, ₽/мес: ступени (ранняя цена → стандартная). */
  prices: PriceStep[];
  /** Месячный отток платящих. */
  churn: number;
  /** Доля годовых планов и скидка к месячной цене (учитывается в ARPU). */
  annualShare: number;
  annualDiscount: number;
  /** Постоянные и полупеременные расходы, ₽/мес. */
  costs: {
    /** Инфраструктура (РФ-хостинг, БД, бэкапы, мониторинг). */
    infraBase: number;
    /** Переменная инфраструктура, ₽ на 1 000 посетителей. */
    infraPer1kVisitors: number;
    /** Домены, email, инструменты, подписки. */
    tools: number;
    /** Контент: углублённые материалы, редактура, AI-слой. */
    content: number;
    /** Маркетинг: посевы, партнёрства, эксперименты. */
    marketing: number;
    /** Юрист, бухгалтер, РКН, договоры. */
    legal: number;
    /** Выплаты основателю (в денежных расходах, не «альтернативная стоимость»). */
    founderDraw: number;
    /** Доля непредвиденных расходов от операционных. */
    contingencyRate: number;
  };
  /** Разовые расходы, ₽: юридический контур, контент-пакет, инфраструктура. */
  oneTime: { legalSetup: number; contentPack: number; infraSetup: number };
  /** Комиссия платёжного провайдера, доля выручки. */
  paymentFeeRate: number;
};

const HORIZON_MONTHS = 24;
const START_YEAR = 2027;
const START_MONTH = 1;
const QUARTERS = 8;

const SCENARIOS: ScenarioSpec[] = [
  {
    id: "conservative",
    title: "Консервативный",
    visitors: { start: 300, growth: 1.09, cap: 2_500 },
    registrationRate: 0.08,
    paid: { startMonth: 13, conversion: 0.015, backlogConversion: 0.01 },
    prices: [{ fromMonth: 1, price: 490 }],
    churn: 0.1,
    annualShare: 0.2,
    annualDiscount: 0.28,
    costs: {
      infraBase: 10_000,
      infraPer1kVisitors: 350,
      tools: 4_000,
      content: 8_000,
      marketing: 5_000,
      legal: 8_000,
      founderDraw: 40_000,
      contingencyRate: 0.05,
    },
    oneTime: { legalSetup: 60_000, contentPack: 60_000, infraSetup: 30_000 },
    paymentFeeRate: 0.035,
  },
  {
    id: "base",
    title: "Базовый",
    visitors: { start: 500, growth: 1.18, cap: 25_000 },
    registrationRate: 0.1,
    paid: { startMonth: 10, conversion: 0.04, backlogConversion: 0.02 },
    prices: [
      { fromMonth: 1, price: 590 },
      { fromMonth: 19, price: 990 },
    ],
    churn: 0.07,
    annualShare: 0.3,
    annualDiscount: 0.28,
    costs: {
      infraBase: 12_000,
      infraPer1kVisitors: 350,
      tools: 5_000,
      content: 20_000,
      marketing: 18_000,
      legal: 12_000,
      founderDraw: 80_000,
      contingencyRate: 0.08,
    },
    oneTime: { legalSetup: 80_000, contentPack: 120_000, infraSetup: 50_000 },
    paymentFeeRate: 0.035,
  },
  {
    id: "optimistic",
    title: "Оптимистичный (ускоренный)",
    visitors: { start: 700, growth: 1.22, cap: 45_000 },
    registrationRate: 0.12,
    paid: { startMonth: 8, conversion: 0.06, backlogConversion: 0.03 },
    prices: [
      { fromMonth: 1, price: 590 },
      { fromMonth: 16, price: 990 },
    ],
    churn: 0.05,
    annualShare: 0.3,
    annualDiscount: 0.28,
    costs: {
      infraBase: 16_000,
      infraPer1kVisitors: 400,
      tools: 8_000,
      content: 50_000,
      marketing: 80_000,
      legal: 20_000,
      founderDraw: 120_000,
      contingencyRate: 0.08,
    },
    oneTime: { legalSetup: 100_000, contentPack: 250_000, infraSetup: 80_000 },
    paymentFeeRate: 0.035,
  },
];

type MonthRow = {
  month: number;
  label: string;
  visitors: number;
  registrations: number;
  newPaid: number;
  activePaid: number;
  arpuNet: number;
  revenue: number;
  costs: number;
  net: number;
  cumulative: number;
};

type ScenarioResult = {
  spec: ScenarioSpec;
  months: MonthRow[];
  totalVisitors: number;
  totalRegistrations: number;
  totalNewPaid: number;
  activePaidEnd: number;
  totalRevenue: number;
  totalCosts: number;
  net24: number;
  peakDeficit: number;
  peakDeficitMonth: number;
  ask24: number;
  bridge12: number;
  /** Запрос, если основатель не берёт выплаты из инвестиций (живёт на сбережения/подработку). */
  ask24NoFounder: number;
  /** Пик дефицита до включения платного слоя, ₽. */
  burnBeforePaid: number;
  breakevenMonth: number | null;
  ltv: number;
  blendedCac: number | null;
  quarters: QuarterRow[];
};

type QuarterRow = {
  label: string;
  visitors: number;
  registrations: number;
  newPaid: number;
  activePaidEnd: number;
  revenue: number;
  costs: number;
  net: number;
  cumulative: number;
};

const rub = (value: number): string => {
  const rounded = Math.round(value);
  return rounded.toLocaleString("ru-RU").replace(/\u00a0/g, "\u202f");
};

const mln = (value: number): string => {
  const millions = value / 1_000_000;
  return millions.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
};

const priceAt = (spec: ScenarioSpec, month: number): number => {
  let current = spec.prices[0]!.price;
  for (const step of spec.prices) {
    if (month >= step.fromMonth) current = step.price;
  }
  return current;
};

const monthLabel = (month: number): string => {
  const date = new Date(Date.UTC(START_YEAR, START_MONTH - 1 + (month - 1), 1));
  const year = date.getUTCFullYear();
  const monthNumber = date.getUTCMonth() + 1;
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
};

const quarterLabel = (quarter: number): string => {
  const month = quarter * 3 - 2;
  const date = new Date(Date.UTC(START_YEAR, START_MONTH - 1 + (month - 1), 1));
  const year = date.getUTCFullYear();
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${year}-Q${q}`;
};

const quarterly = (months: MonthRow[]): QuarterRow[] => {
  const rows: QuarterRow[] = [];
  for (let q = 0; q < QUARTERS; q += 1) {
    const slice = months.slice(q * 3, q * 3 + 3);
    const last = slice[slice.length - 1]!;
    rows.push({
      label: quarterLabel(q + 1),
      visitors: slice.reduce((sum, row) => sum + row.visitors, 0),
      registrations: slice.reduce((sum, row) => sum + row.registrations, 0),
      newPaid: slice.reduce((sum, row) => sum + row.newPaid, 0),
      activePaidEnd: last.activePaid,
      revenue: slice.reduce((sum, row) => sum + row.revenue, 0),
      costs: slice.reduce((sum, row) => sum + row.costs, 0),
      net: slice.reduce((sum, row) => sum + row.net, 0),
      cumulative: last.cumulative,
    });
  }
  return rows;
};

const simulate = (spec: ScenarioSpec): ScenarioResult => {
  const months: MonthRow[] = [];
  let cumulative = 0;
  const activeByPrice: number[] = [];
  let peakDeficit = 0;
  let peakDeficitMonth = 0;
  let totalVisitors = 0;
  let totalRegistrations = 0;
  let totalNewPaid = 0;
  let totalRevenue = 0;
  let totalCosts = 0;
  let breakevenMonth: number | null = null;

  for (let month = 1; month <= HORIZON_MONTHS; month += 1) {
    const visitors = Math.min(spec.visitors.cap, spec.visitors.start * spec.visitors.growth ** (month - 1));
    const registrations = visitors * spec.registrationRate;

    // Платный слой включается не раньше spec.paid.startMonth; конверсия применяется
    // к регистрациям предыдущего месяца — человек платит после первого использования.
    const registeredSoFar = months.reduce((sum, row) => sum + row.registrations, 0);
    const backlog =
      month === spec.paid.startMonth
        ? registeredSoFar * spec.paid.backlogConversion
        : 0;
    const newPaid =
      (month >= spec.paid.startMonth + 1 ? (months[month - 2]?.registrations ?? 0) * spec.paid.conversion : 0) +
      backlog;

    // Цена фиксируется за когортой: ранние подписчики сохраняют раннюю цену,
    // новая цена действует только на новые подписки (как обещано в оферте).
    const annualFactor = 1 - spec.annualShare * spec.annualDiscount;
    const netFactor = annualFactor * (1 - spec.paymentFeeRate);
    if (activeByPrice.length < spec.prices.length) {
      while (activeByPrice.length < spec.prices.length) activeByPrice.push(0);
    }
    let priceIndex = 0;
    for (let index = 0; index < spec.prices.length; index += 1) {
      if (month >= spec.prices[index]!.fromMonth) priceIndex = index;
    }
    for (let index = 0; index < activeByPrice.length; index += 1) {
      activeByPrice[index] = activeByPrice[index]! * (1 - spec.churn);
    }
    activeByPrice[priceIndex] = activeByPrice[priceIndex]! + newPaid;
    const activePaid = activeByPrice.reduce((sum, value) => sum + value, 0);
    const revenue = activeByPrice.reduce(
      (sum, value, index) => sum + value * spec.prices[index]!.price * netFactor,
      0,
    );
    const arpuNet = activePaid > 0 ? revenue / activePaid : 0;

    const infra = spec.costs.infraBase + (visitors / 1_000) * spec.costs.infraPer1kVisitors;
    const operating =
      infra +
      spec.costs.tools +
      spec.costs.content +
      spec.costs.marketing +
      spec.costs.legal +
      spec.costs.founderDraw;
    const contingency = operating * spec.costs.contingencyRate;

    // Разовые расходы размазаны по месяцам: юрконтур и инфраструктура — в начале,
    // контент-пакет к платному слою — за 6 месяцев до включения платежа.
    const legalShare = month >= 1 && month <= 2 ? spec.oneTime.legalSetup / 2 : 0;
    const infraShare = month >= 1 && month <= 2 ? spec.oneTime.infraSetup / 2 : 0;
    const contentFrom = Math.max(1, spec.paid.startMonth - 6);
    const contentShare =
      month >= contentFrom && month < spec.paid.startMonth ? spec.oneTime.contentPack / 6 : 0;

    const costs = operating + contingency + legalShare + infraShare + contentShare;
    const net = revenue - costs;
    cumulative += net;

    if (breakevenMonth === null && revenue >= costs) breakevenMonth = month;

    if (cumulative < peakDeficit) {
      peakDeficit = cumulative;
      peakDeficitMonth = month;
    }

    months.push({
      month,
      label: monthLabel(month),
      visitors: Math.round(visitors),
      registrations: Math.round(registrations),
      newPaid: Math.round(newPaid * 100) / 100,
      activePaid: Math.round(activePaid * 100) / 100,
      arpuNet,
      revenue: Math.round(revenue),
      costs: Math.round(costs),
      net: Math.round(net),
      cumulative: Math.round(cumulative),
    });

    totalVisitors += visitors;
    totalRegistrations += registrations;
    totalNewPaid += newPaid;
    totalRevenue += revenue;
    totalCosts += costs;
  }

  const ask24 = Math.ceil((-peakDeficit * 1.15) / 100_000) * 100_000;
  const bridge12 = Math.ceil(
    (Math.max(0, -months.slice(0, 12).reduce((min, row) => Math.min(min, row.cumulative), 0)) * 1.15) /
      100_000,
  ) * 100_000;

  const noFounderMonths = months.map((row) => {
    const founderPart = spec.costs.founderDraw * (1 + spec.costs.contingencyRate);
    return { cumulative: row.cumulative + founderPart * row.month };
  });
  const peakNoFounder = noFounderMonths.reduce((min, row) => Math.min(min, row.cumulative), 0);
  const burnBeforePaid = months
    .slice(0, spec.paid.startMonth)
    .reduce((min, row) => Math.min(min, row.cumulative), 0);

  const lastMonth = months[months.length - 1]!;
  const endArpu = lastMonth.activePaid > 0 ? lastMonth.revenue / lastMonth.activePaid : 0;
  const ltv = endArpu / spec.churn;
  const marketingSpend = spec.costs.marketing * HORIZON_MONTHS;
  const blendedCac = totalNewPaid > 0 ? marketingSpend / totalNewPaid : null;

  return {
    spec,
    months,
    totalVisitors: Math.round(totalVisitors),
    totalRegistrations: Math.round(totalRegistrations),
    totalNewPaid: Math.round(totalNewPaid * 100) / 100,
    activePaidEnd: Math.round(activeByPrice.reduce((sum, value) => sum + value, 0) * 100) / 100,
    totalRevenue: Math.round(totalRevenue),
    totalCosts: Math.round(totalCosts),
    net24: Math.round(totalRevenue - totalCosts),
    peakDeficit: Math.round(peakDeficit),
    peakDeficitMonth,
    ask24,
    bridge12,
    ask24NoFounder: Math.ceil((-peakNoFounder * 1.15) / 100_000) * 100_000,
    burnBeforePaid: Math.round(burnBeforePaid),
    breakevenMonth,
    ltv: Math.round(ltv),
    blendedCac: blendedCac === null ? null : Math.round(blendedCac),
    quarters: quarterly(months),
  };
};

const results = SCENARIOS.map(simulate);

const cloneWith = (spec: ScenarioSpec, patch: (copy: ScenarioSpec) => void): ScenarioSpec => {
  const copy: ScenarioSpec = {
    ...spec,
    visitors: { ...spec.visitors },
    paid: { ...spec.paid },
    prices: spec.prices.map((step) => ({ ...step })),
    costs: { ...spec.costs },
    oneTime: { ...spec.oneTime },
  };
  patch(copy);
  return copy;
};

const sensitivity = (): { label: string; value: string; ask: number; peak: number }[] => {
  const baseSpec = SCENARIOS[1]!;
  const rows: { label: string; value: string; ask: number; peak: number }[] = [];
  for (const draw of [0, 40_000, 80_000, 120_000]) {
    const result = simulate(cloneWith(baseSpec, (copy) => { copy.costs.founderDraw = draw; }));
    rows.push({ label: "Выплаты основателю, ₽/мес", value: rub(draw), ask: result.ask24, peak: result.peakDeficit });
  }
  for (const start of [8, 10, 13]) {
    const result = simulate(cloneWith(baseSpec, (copy) => { copy.paid.startMonth = start; }));
    rows.push({ label: "Месяц включения подписки", value: `M${start}`, ask: result.ask24, peak: result.peakDeficit });
  }
  for (const conversion of [0.02, 0.03, 0.04, 0.05]) {
    const result = simulate(cloneWith(baseSpec, (copy) => { copy.paid.conversion = conversion; }));
    rows.push({ label: "Конверсия регистрации в подписку", value: `${Math.round(conversion * 100)}%`, ask: result.ask24, peak: result.peakDeficit });
  }
  for (const churn of [0.05, 0.07, 0.1]) {
    const result = simulate(cloneWith(baseSpec, (copy) => { copy.churn = churn; }));
    rows.push({ label: "Месячный отток платящих", value: `${Math.round(churn * 100)}%`, ask: result.ask24, peak: result.peakDeficit });
  }
  return rows;
};

const renderMarkdown = (): string => {
  const lines: string[] = [];
  lines.push("# COS-BP-008 — расчёт финансовой модели (сгенерировано)");
  lines.push("");
  lines.push("> Файл сгенерирован `scripts/business-model/financial-model.ts`. Не редактировать вручную.");
  lines.push("> Горизонт: 24 месяца, 2027-01 … 2028-12. Все допущения — ДП, проверяются на Beta.");
  lines.push("");
  lines.push("## Сводка по сценариям");
  lines.push("");
  lines.push("| Показатель | Консервативный | Базовый | Оптимистичный |");
  lines.push("|---|---:|---:|---:|");
  lines.push(
    `| Посетители за 24 мес | ${rub(results[0]!.totalVisitors)} | ${rub(results[1]!.totalVisitors)} | ${rub(results[2]!.totalVisitors)} |`,
  );
  lines.push(
    `| Регистрации за 24 мес | ${rub(results[0]!.totalRegistrations)} | ${rub(results[1]!.totalRegistrations)} | ${rub(results[2]!.totalRegistrations)} |`,
  );
  lines.push(
    `| Новые платящие за 24 мес | ${rub(results[0]!.totalNewPaid)} | ${rub(results[1]!.totalNewPaid)} | ${rub(results[2]!.totalNewPaid)} |`,
  );
  lines.push(
    `| Платящие на конец | ${rub(results[0]!.activePaidEnd)} | ${rub(results[1]!.activePaidEnd)} | ${rub(results[2]!.activePaidEnd)} |`,
  );
  lines.push(
    `| Выручка за 24 мес, ₽ | ${rub(results[0]!.totalRevenue)} | ${rub(results[1]!.totalRevenue)} | ${rub(results[2]!.totalRevenue)} |`,
  );
  lines.push(
    `| Расходы за 24 мес, ₽ | ${rub(results[0]!.totalCosts)} | ${rub(results[1]!.totalCosts)} | ${rub(results[2]!.totalCosts)} |`,
  );
  lines.push(
    `| Итог по деньгам, ₽ | ${rub(results[0]!.net24)} | ${rub(results[1]!.net24)} | ${rub(results[2]!.net24)} |`,
  );
  lines.push(
    `| Пик кассового дефицита, ₽ | ${rub(results[0]!.peakDeficit)} | ${rub(results[1]!.peakDeficit)} | ${rub(results[2]!.peakDeficit)} |`,
  );
  lines.push(
    `| Месяц пика | ${results[0]!.peakDeficitMonth} | ${results[1]!.peakDeficitMonth} | ${results[2]!.peakDeficitMonth} |`,
  );
  lines.push(
    `| Запрос на 24 мес (=пик × 1,15), ₽ | ${rub(results[0]!.ask24)} | ${rub(results[1]!.ask24)} | ${rub(results[2]!.ask24)} |`,
  );
  lines.push(
    `| Мост на 12 мес, ₽ | ${rub(results[0]!.bridge12)} | ${rub(results[1]!.bridge12)} | ${rub(results[2]!.bridge12)} |`,
  );
  lines.push(
    `| Запрос, если основатель без выплат, ₽ | ${rub(results[0]!.ask24NoFounder)} | ${rub(results[1]!.ask24NoFounder)} | ${rub(results[2]!.ask24NoFounder)} |`,
  );
  lines.push(
    `| Сожжено до включения платежа, ₽ | ${rub(results[0]!.burnBeforePaid)} | ${rub(results[1]!.burnBeforePaid)} | ${rub(results[2]!.burnBeforePaid)} |`,
  );
  lines.push(
    `| Кассовая безубыточность (месяц) | ${results[0]!.breakevenMonth ?? "—"} | ${results[1]!.breakevenMonth ?? "—"} | ${results[2]!.breakevenMonth ?? "—"} |`,
  );
  lines.push(
    `| LTV (ARPU конца горизонта / отток), ₽ | ${rub(results[0]!.ltv)} | ${rub(results[1]!.ltv)} | ${rub(results[2]!.ltv)} |`,
  );
  lines.push(
    `| CAC (маркетинг / новый платящий), ₽ | ${results[0]!.blendedCac ?? "—"} | ${results[1]!.blendedCac ?? "—"} | ${results[2]!.blendedCac ?? "—"} |`,
  );
  lines.push("");

  for (const result of results) {
    lines.push(`## Сценарий: ${result.spec.title}`);
    lines.push("");
    lines.push(
      "| Квартал | Посетители | Регистрации | Новые платящие | Платящие на конец | Выручка, ₽ | Расходы, ₽ | Поток, ₽ | Накопленно, ₽ |",
    );
    lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const row of result.quarters) {
      lines.push(
        `| ${row.label} | ${rub(row.visitors)} | ${rub(row.registrations)} | ${rub(row.newPaid)} | ${rub(row.activePaidEnd)} | ${rub(row.revenue)} | ${rub(row.costs)} | ${rub(row.net)} | ${rub(row.cumulative)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Чувствительность (базовый сценарий)");
  lines.push("");
  lines.push("| Параметр | Значение | Запрос 24 мес, ₽ | Пик дефицита, ₽ |");
  lines.push("|---|---:|---:|---:|");
  for (const row of sensitivity()) {
    lines.push(`| ${row.label} | ${row.value} | ${rub(row.ask)} | ${rub(row.peak)} |`);
  }
  lines.push("");
  lines.push("Все параметры меняются по одному, остальные остаются базовыми. Таблица показывает, что запрос двигают не цена и не выручка, а выплаты основателю и месяц включения платежа.");
  lines.push("");
  lines.push("## Помесячный ряд, базовый сценарий");
  lines.push("");
  lines.push("| Месяц | Посетители | Регистрации | Новые платящие | Платящие | Выручка, ₽ | Расходы, ₽ | Поток, ₽ | Накопленно, ₽ |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of results[1]!.months) {
    lines.push(
      `| ${row.label} | ${rub(row.visitors)} | ${rub(row.registrations)} | ${rub(row.newPaid)} | ${rub(row.activePaid)} | ${rub(row.revenue)} | ${rub(row.costs)} | ${rub(row.net)} | ${rub(row.cumulative)} |`,
    );
  }
  lines.push("");
  lines.push(`Итог 24 месяцев: выручка ${mln(results[1]!.totalRevenue)} млн ₽, расходы ${mln(results[1]!.totalCosts)} млн ₽.`);
  lines.push("");

  return lines.join("\n");
};

const renderCsv = (): string => {
  const header = [
    "scenario",
    "month",
    "period",
    "visitors",
    "registrations",
    "new_paid",
    "active_paid",
    "arpu_net",
    "revenue",
    "costs",
    "net",
    "cumulative",
  ];
  const rows: string[] = [header.join(",")];
  for (const result of results) {
    for (const row of result.months) {
      rows.push(
        [
          result.spec.id,
          row.month,
          row.label,
          row.visitors,
          row.registrations,
          row.newPaid,
          row.activePaid,
          Math.round(row.arpuNet),
          row.revenue,
          row.costs,
          row.net,
          row.cumulative,
        ].join(","),
      );
    }
  }
  return rows.join("\n");
};

const main = async (): Promise<void> => {
  const write = !process.argv.includes("--no-write");
  const json = process.argv.includes("--json");
  const markdown = renderMarkdown();

  if (write) {
    const reportDir = path.join("docs", "08-business-plan", "reports");
    await mkdir(reportDir, { recursive: true });
    await writeFile(path.join(reportDir, "bp-008-model.md"), `${markdown}\n`, "utf8");
    await writeFile(path.join(reportDir, "bp-008-model.csv"), `${renderCsv()}\n`, "utf8");
  }

  if (json) {
    console.log(
      JSON.stringify(
        results.map((result) => ({
          id: result.spec.id,
          title: result.spec.title,
          totalVisitors: result.totalVisitors,
          totalRegistrations: result.totalRegistrations,
          totalNewPaid: result.totalNewPaid,
          activePaidEnd: result.activePaidEnd,
          totalRevenue: result.totalRevenue,
          totalCosts: result.totalCosts,
          net24: result.net24,
          peakDeficit: result.peakDeficit,
          peakDeficitMonth: result.peakDeficitMonth,
          ask24: result.ask24,
          bridge12: result.bridge12,
          ask24NoFounder: result.ask24NoFounder,
          burnBeforePaid: result.burnBeforePaid,
          breakevenMonth: result.breakevenMonth,
          ltv: result.ltv,
          blendedCac: result.blendedCac,
        })),
        null,
        2,
      ),
    );
    return;
  }

  console.log(markdown);
  console.log(
    `\nАртефакты: docs/08-business-plan/reports/bp-008-model.md, bp-008-model.csv`,
  );
};

await main();
