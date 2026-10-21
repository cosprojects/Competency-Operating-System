/**
 * Как открытая профессия каталога ищется во внешних классификациях.
 * Новая карточка в каталоге сама поиск не включает: пока здесь нет строки, парсер
 * пропускает профессию и пишет об этом в отчёт, а не угадывает запрос.
 */
export interface ProfessionSourceQuery {
  professionId: string;
  /** Точный URI ESCO. Поиск по тексту используется только если URI не задан. */
  escoOccupationUri?: string;
  escoSearchText?: string;
  /** Брать занятие ESCO, только если заголовок содержит одну из этих строк. */
  escoTitleIncludes?: string[];
  /** Код O*NET-SOC. Без кода источник для этой профессии не вызывается. */
  onetCode?: string;
}

export const PROFESSION_SOURCE_QUERIES: readonly ProfessionSourceQuery[] = [
  {
    professionId: "uxui",
    escoOccupationUri: "http://data.europa.eu/esco/occupation/96e20037-0a25-4bf6-a25e-808d1605d890",
    onetCode: "15-1255.00",
  },
  {
    professionId: "product",
    escoSearchText: "product designer",
    escoTitleIncludes: ["product designer"],
  },
  {
    professionId: "graphic",
    escoOccupationUri: "http://data.europa.eu/esco/occupation/69bcbb0a-8d80-4ecd-b0a4-9adea2a40de2",
    onetCode: "27-1024.00",
  },
  {
    professionId: "brand",
    escoOccupationUri: "http://data.europa.eu/esco/occupation/cb93fd23-1f51-4495-867a-936c1967066b",
    onetCode: "27-1011.00",
  },
  {
    professionId: "motion",
    escoOccupationUri: "http://data.europa.eu/esco/occupation/52df9d56-efd4-48d0-ad93-59231943fc4c",
    onetCode: "27-1014.00",
  },
  {
    professionId: "game",
    escoOccupationUri: "http://data.europa.eu/esco/occupation/d68ff35f-e34d-4e32-88ab-d6c06a6c25b9",
    onetCode: "15-1255.01",
  },
];

export function queryForProfession(professionId: string): ProfessionSourceQuery | undefined {
  return PROFESSION_SOURCE_QUERIES.find((item) => item.professionId === professionId);
}
