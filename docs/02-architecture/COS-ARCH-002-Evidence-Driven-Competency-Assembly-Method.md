# COS-ARCH-002 — Evidence-Driven Competency Assembly Method
# COS-ARCH-002 — Метод сборки компетенций на основе доказательств

**Status / Статус:** Proposed for review / Предлагается к рассмотрению  
**Version / Версия:** 0.1.0  
**Date / Дата:** 2026-10-21  
**Scope / Область действия:** Architecture and logic only; no implementation decisions.

## 1. Purpose / Назначение

### EN
This document proposes a method for building and maintaining a structured COS profession database. Each profession is represented by knowledge and skill requirements backed by traceable evidence from open sources. The method covers source discovery, claim extraction, evidence validation, competency normalization, mapping to the existing COS model, freshness checks, and controlled updates. It distinguishes source statements from AI inference.

This is a proposal, not a validated method or authorization to implement. Acceptance depends on independent evaluation against predefined criteria.

### RU
Документ предлагает метод формирования и сопровождения структурированной базы профессий COS. Каждая профессия представляется требованиями к знаниям и навыкам, подтвержденными проверяемыми свидетельствами из открытых источников. Метод охватывает поиск источников, извлечение утверждений, проверку доказательств, нормализацию компетенций, сопоставление с существующей моделью COS, контроль актуальности и управляемое обновление. Он различает утверждения источника и выводы ИИ.

Это предложение, а не подтвержденный метод и не разрешение на реализацию. Принятие зависит от независимой оценки по заранее установленным критериям.

## 2. Proposed method / Предлагаемый метод

### EN
Use a **hybrid, evidence-first claim extraction method**:
1. Discover and capture relevant sources.
2. Extract atomic claims with an LLM while retaining exact source passages.
3. Validate claims using deterministic structural and evidence checks.
4. Normalize and compare candidate competencies without treating semantic similarity as proof.
5. Assemble profession requirements only from supported claims.
6. Preserve uncertainty, contradiction, direct refutation, and missing evidence as distinct states.
7. Revisit claims when sources change or become stale.
8. Evaluate the method on an independently labeled set before adoption.

The LLM interprets language and context. Deterministic checks enforce provenance, required fields, output structure, and valid state transitions. Neither semantic similarity nor an LLM confidence score is sufficient evidence for accepting a competency.

### RU
Использовать **гибридный метод извлечения утверждений с приоритетом доказательств**:
1. Находить и сохранять релевантные источники.
2. Извлекать атомарные утверждения с помощью LLM, сохраняя точные исходные фрагменты.
3. Проверять утверждения формальными структурными проверками и проверками доказательств.
4. Нормализовать и сопоставлять кандидатов в компетенции, не считая семантическое сходство доказательством.
5. Формировать требования к профессии только на основании подтвержденных утверждений.
6. Различать неопределенность, противоречие, прямое опровержение и отсутствие доказательств.
7. Повторно проверять утверждения при изменении или устаревании источников.
8. Оценивать метод на независимой размеченной выборке до принятия.

LLM интерпретирует язык и контекст. Формальные проверки обеспечивают происхождение данных, обязательные поля, структуру результата и допустимость переходов между состояниями. Семантического сходства или оценки уверенности LLM недостаточно для принятия компетенции.

## 3. Context and constraints / Контекст и ограничения

### EN
This proposal follows `COS-RES-011` and existing COS rules:
- `assembly-chain-v1` failed the recall and exact-verdict criteria: precision 1.00, recall 0.25, and 5 mismatches among 13 cases.
- Do not attempt to repair a closed phrase list by adding phrases after each failure.
- Evidence may span multiple sentences; inspect context without inventing relationships.
- Unknown page type must not erase direct positive or negative evidence.
- “Not supplied,” “not read,” “not found,” and “contradicted” are distinct states.
- `COS-RES-010` remains the active collection. Existing journals and the current graph remain unchanged until separately reviewed.
- `COS-RES-012` is `Retired`; do not reuse its identifier.
- `src/methodology/v1/methodologist/decide.ts` matches candidate statements to existing nodes. It is distinct from failed `assembly-chain-v1` and is not changed by this proposal.
- `COS-RES-009` rules remain in force: confident match, ambiguous match, and `needs_node` are not interchangeable.

### RU
Предложение следует `COS-RES-011` и действующим правилам COS:
- `assembly-chain-v1` не прошел критерии полноты и точного совпадения вердиктов: precision 1,00, recall 0,25 и 5 несовпадений на 13 случаях.
- Нельзя исправлять закрытый список фраз добавлением новых формулировок после каждой ошибки.
- Доказательства могут находиться в нескольких предложениях; контекст нужно проверять, не выдумывая связи.
- Неизвестный тип страницы не должен обнулять прямые положительные или отрицательные свидетельства.
- «Не предоставлено», «не прочитано», «не найдено» и «противоречит» — разные состояния.
- `COS-RES-010` остается действующим сбором. Журналы и текущий граф не меняются без отдельного рассмотренного решения.
- `COS-RES-012` имеет статус `Retired`; его идентификатор нельзя использовать повторно.
- `src/methodology/v1/methodologist/decide.ts` сопоставляет кандидатные утверждения с существующими узлами. Это не `assembly-chain-v1`; данное предложение не изменяет этот механизм.
- Правила `COS-RES-009` сохраняются: уверенное совпадение, неоднозначное совпадение и `needs_node` — разные исходы.

## 4. Logical data concepts / Логические понятия данных

These are logical concepts, not a decision about database tables or new services.  
Это логические понятия, а не решение о таблицах базы данных или новых сервисах.

### Source / Источник
**EN:** A retrievable document or page. Preserve publisher, title, type, URL/identifier, dates where available, retrieval time, language, content fingerprint, and the captured version. Each claim must point to an exact passage and location.  
**RU:** Доступный документ или страница. Сохраняются издатель, название, тип, URL/идентификатор, даты при наличии, время получения, язык, контрольный отпечаток и сохраненная версия. Каждое утверждение ссылается на точный фрагмент и его расположение.

### Claim / Утверждение
**EN:** An atomic statement about one requirement or qualification, linked to its source passage. It may express knowledge, an observable skill/action, a condition, an exclusion, or a contradiction. Do not merge requirements merely because they appear together.  
**RU:** Атомарное утверждение об одном требовании или уточнении, связанное с исходным фрагментом. Оно может описывать знание, наблюдаемый навык/действие, условие, исключение или противоречие. Нельзя объединять требования только потому, что они расположены рядом.

### Candidate competency / Кандидат в компетенции
**EN:** A normalized candidate for a profession’s knowledge or skill requirements. A title, keyword, tool name, topic, or semantic-neighbor result is not a competency by itself.  
**RU:** Нормализованный кандидат в требования к знаниям или навыкам профессии. Название, ключевое слово, инструмент, тема или результат семантического поиска сами по себе не являются компетенцией.

### Evidence relation / Связь с доказательством
**EN:** A traceable relation between claim and passage: support, qualification, contradiction, or direct refutation. Translations and mirrors of the same record are not independent sources.  
**RU:** Проверяемая связь утверждения с фрагментом: подтверждение, уточнение, противоречие или прямое опровержение. Переводы и зеркала одной записи не являются независимыми источниками.

## 5. Processing logic / Логика обработки

### A. Source discovery and capture / Поиск и фиксация источников

**EN**
- Search by profession identifiers, alternative titles, classification codes, and source-specific strategies.
- Prefer maintained official sources for normative claims; use vacancies as evidence of market demand, not universal standards.
- Do not discard a source solely because its page type is unknown. Retain direct evidence.
- Deduplicate mirrors and translations using provenance and content similarity.
- Save the retrieved version and retrieval time.

**RU**
- Искать по идентификаторам профессии, альтернативным названиям, кодам классификаторов и стратегиям для разных источников.
- Для нормативных требований предпочитать поддерживаемые официальные источники; вакансии использовать как свидетельства рыночного спроса, а не универсальные стандарты.
- Не отбрасывать источник только из-за неизвестного типа страницы. Сохранять прямые свидетельства.
- Устранять дубликаты, зеркала и переводы с учетом происхождения и сходства содержимого.
- Сохранять полученную версию и время получения.

### B. Context-aware claim extraction / Извлечение утверждений с учетом контекста

**EN**
- Provide the LLM with a passage and enough surrounding context to resolve references, negation, qualifications, and cross-sentence relationships.
- Return structured claims with exact quotations; an unsupported paraphrase cannot be the only evidence.
- Classify the statement as a requirement, recommendation, example, optional skill, exclusion, or uncertain implication.
- If a cross-sentence relation is unclear, return `incomplete` or `needs_review`, not an invented complete relation.
- The extractor may propose claims but cannot accept them based only on its confidence.

**RU**
- Передавать LLM фрагмент и достаточный контекст для разрешения ссылок, отрицаний, уточнений и связей между предложениями.
- Возвращать структурированные утверждения с точными цитатами; неподтвержденный пересказ не может быть единственным доказательством.
- Классифицировать высказывание как требование, рекомендацию, пример, необязательный навык, исключение или неопределенный вывод.
- Если связь между предложениями неясна, возвращать `incomplete` или `needs_review`, а не достраивать ее.
- Извлекатель предлагает утверждения, но не принимает их только на основании своей уверенности.

### C. Structural and evidence validation / Структурная проверка и проверка доказательств

**EN**
Check that the source and passage are retrievable, the quotation exists in the captured version, claim type and evidence role are valid, negation and qualifications are preserved, and the output follows the required schema. Missing passage, retrieval failure, no evidence, contradiction, and refutation must remain distinct. A failed check blocks automatic acceptance but does not prove the competency is absent.

**RU**
Проверять доступность источника и фрагмента, наличие цитаты в сохраненной версии, корректность типа утверждения и роли доказательства, сохранность отрицаний и уточнений, соответствие результата заданной структуре. Отсутствующий фрагмент, ошибка получения, отсутствие доказательств, противоречие и опровержение должны различаться. Провал проверки запрещает автоматическое принятие, но не доказывает отсутствие компетенции.

### D. Normalization and candidate comparison / Нормализация и сопоставление

**EN**
- Normalize wording while retaining the original wording and language.
- Compare action/knowledge, object, scope, and conditions—not topic proximity or word overlap alone.
- Treat multilingual equivalents as candidate matches, not independent corroboration.
- Keep requirements separate if their scope or meaning materially differs.
- Apply `COS-RES-009` when matching candidates to the existing graph. Ambiguous remains ambiguous; no match does not prove a new node is needed.
- Discovery and extraction must not mutate the graph.

**RU**
- Нормализовать формулировки, сохраняя исходный текст и язык.
- Сопоставлять действие/знание, объект, область применения и условия, а не только близость темы или совпадение слов.
- Считать многоязычные эквиваленты кандидатами на совпадение, а не независимыми подтверждениями.
- Не объединять требования, если их область или смысл существенно различаются.
- При сопоставлении с графом применять `COS-RES-009`. Неоднозначность остается неоднозначностью; отсутствие совпадения не доказывает необходимость нового узла.
- Поиск и извлечение не должны менять граф.

### E. Profession assembly / Сборка профессии

**EN**
- Assemble the profile only from claims that pass evidence checks and the acceptance policy.
- Keep every requirement linked to its claim, passage, source version, and validation decision.
- Distinguish knowledge and skills where evidence supports the distinction.
- Frequency of mentions helps prioritize review but does not prove necessity.
- Do not silently resolve conflicting sources by majority vote or source count.
- Keep unresolved candidates outside the accepted profile.

**RU**
- Формировать профиль только из утверждений, прошедших проверку доказательств и правила принятия.
- Сохранять связь каждого требования с утверждением, фрагментом, версией источника и решением проверки.
- Разделять знания и навыки, когда это подтверждается источниками.
- Частота упоминаний помогает расставлять приоритеты, но не доказывает необходимость.
- Не разрешать конфликты между источниками молча, голосованием большинства или подсчетом источников.
- Не включать неразрешенные кандидаты в подтвержденный профиль.

### F. Freshness and controlled updates / Актуальность и управляемое обновление

**EN**
- Revisit sources on a schedule appropriate to their type and expected change rate.
- Detect changes from metadata, content fingerprints, and comparison with the last captured version.
- Reprocess affected claims and verify whether context or meaning changed.
- Mark claims for review if a source disappears, becomes inaccessible, is superseded, or changes materially.
- Preserve the previous accepted state and a change record; never silently overwrite requirements.
- Source unavailability alone does not prove a former claim false.

**RU**
- Повторно проверять источники с периодичностью, соответствующей их типу и скорости изменений.
- Обнаруживать изменения по метаданным, контрольным отпечаткам и сравнению с последней версией.
- Повторно обрабатывать затронутые утверждения и проверять изменение контекста или смысла.
- Отправлять утверждения на пересмотр, если источник исчез, стал недоступен, заменен или существенно изменился.
- Сохранять прежнее принятое состояние и запись об изменении; не перезаписывать требования незаметно.
- Недоступность источника сама по себе не доказывает ложность прежнего утверждения.

## 6. Evidence states / Состояния доказательств

These are proposed logical states; final schema and names require detailed design.  
Это предлагаемые логические состояния; окончательные названия и схема требуют детального проектирования.

| State / Состояние | Meaning / Значение |
|---|---|
| `supported` | Direct support in a retrievable passage. / Прямое подтверждение в доступном фрагменте. |
| `qualified` | Support with explicit scope, conditions, or modality. / Подтверждение с явными ограничениями, условиями или модальностью. |
| `contradicted` | Relevant sources make incompatible claims. / Релевантные источники содержат несовместимые утверждения. |
| `refuted` | Direct evidence explicitly rejects the claim in scope. / Прямое свидетельство явно опровергает утверждение в заданной области. |
| `incomplete` | A required part of the claim or evidence chain is missing. / Отсутствует необходимая часть утверждения или цепочки доказательств. |
| `no_evidence` | No support found in the material actually reviewed; absence is not proven. / В изученных материалах подтверждение не найдено; отсутствие не доказано. |
| `unread` | Identified source/passage was not successfully inspected. / Источник или фрагмент найден, но не изучен. |
| `unavailable` | Source could not be retrieved at review time. / Источник не удалось получить на момент проверки. |
| `needs_review` | Automated processing cannot safely resolve the case. / Автоматическая обработка не может надежно разрешить случай. |

`no_evidence`, `unread`, and `unavailable` must never be collapsed into one state.  
`no_evidence`, `unread` и `unavailable` нельзя объединять.

## 7. Source policy / Политика источников

### EN
Use source authority, scope, recency, traceability, and relevance to assess evidence. A practical default order is: official occupational classifications and maintained competency frameworks; applicable official professional/regulatory standards; recognized industry frameworks; educational and qualification specifications; job postings and employer materials as market evidence; other public materials labeled by type and reliability. This is a default, not an unconditional ranking: authority depends on the question.

### RU
Оценивать источники по авторитетности, области применимости, актуальности, прослеживаемости и релевантности. Практический порядок по умолчанию: официальные классификаторы профессий и поддерживаемые модели компетенций; применимые официальные профессиональные/нормативные стандарты; признанные отраслевые рамки; образовательные программы и спецификации квалификаций; вакансии и материалы работодателей как свидетельства рынка; другие открытые материалы с маркировкой типа и надежности. Это ориентир, а не безусловный рейтинг: авторитетность зависит от вопроса.

## 8. Validation and acceptance / Валидация и приемка

### EN
Use a pre-registered, independently labeled evaluation set. Gold labels must not be derived from the extractor output or prompt rules. Include direct positive evidence, paraphrases, multilingual formulations, cross-sentence evidence, negation, exclusions, contradictions, direct refutations, unknown source types, unread/unavailable sources, duplicate translations, and ambiguous graph mappings.

Carry forward the `COS-RES-011` thresholds:
- precision ≥ 0.90;
- recall ≥ 0.70;
- exact verdict agreement for every case in the defined control set.

These are acceptance thresholds, not demonstrated results. A small set can debug the protocol but cannot establish broad quality. Report overall and per-category metrics, false positives, false negatives, and unresolved cases. If the method fails, record the failure and revise it in a reviewed iteration; do not tune a closed phrase list against the same test set.

### RU
Использовать заранее зафиксированную независимую выборку с эталонной разметкой. Эталонные ответы нельзя выводить из результатов извлекателя или правил промпта. Включить прямые положительные свидетельства, перефразирования, многоязычные формулировки, доказательства в нескольких предложениях, отрицания, исключения, противоречия, прямые опровержения, неизвестные типы источников, непрочитанные/недоступные источники, переведенные дубликаты и неоднозначные сопоставления с графом.

Сохранить пороги `COS-RES-011`:
- precision ≥ 0,90;
- recall ≥ 0,70;
- точное совпадение вердиктов для каждого случая контрольной выборки.

Это пороги приемки, а не доказанные результаты. Небольшая выборка подходит для отладки протокола, но не подтверждает общее качество. Публиковать общие метрики и метрики по категориям, ложноположительные, ложноотрицательные и неразрешенные случаи. При провале зафиксировать результат и пересмотреть метод в новой рассмотренной итерации; не подстраивать закрытый список фраз под ту же выборку.

## 9. LLM boundaries / Границы использования LLM

### EN
The LLM may interpret context, propose atomic claims, classify claim types, identify possible qualifications/negation/conflicts, suggest normalization, and explain uncertainty. It must not invent passages or citations; convert similarity, proximity, overlap, or frequency into proof; silently resolve conflicts; treat its confidence score as validation; mutate the graph; convert ambiguity into an accepted requirement; or infer a skill solely from a profession title or tool mention.

### RU
LLM может интерпретировать контекст, предлагать атомарные утверждения, классифицировать их тип, выявлять уточнения/отрицания/конфликты, предлагать нормализацию и объяснять неопределенность. Она не должна выдумывать фрагменты или ссылки; превращать сходство, близость темы, совпадение слов или частоту в доказательство; молча разрешать конфликты; считать уверенность проверкой; менять граф; превращать неоднозначность в принятое требование; выводить навык только из названия профессии или упоминания инструмента.

## 10. Relationships to COS documents / Связи с документами COS

### EN
**Depends on:** `COS-RES-009-Methodologist-Agent-Rules.md`, active `COS-RES-010`, failure journal `COS-RES-011`, and the current Foundation Book, Mental Model, DDD Summary, and accepted architecture decisions.

**Potential downstream artifacts:** detailed logical specification for source processing and claim extraction; independent validation protocol and gold dataset; freshness/update policy; implementation-specific documents only after architectural acceptance.

This document does not replace `COS-RES-010`, reopen `COS-RES-012`, alter the current graph, or authorize changes to `decide.ts`. Dependent documents may require synchronization after acceptance.

### RU
**Зависит от:** `COS-RES-009-Methodologist-Agent-Rules.md`, действующего `COS-RES-010`, журнала неудач `COS-RES-011`, текущих Foundation Book, Mental Model, DDD Summary и принятых архитектурных решений.

**Возможные последующие артефакты:** детальная логическая спецификация обработки источников и извлечения утверждений; протокол независимой валидации и эталонная выборка; политика актуальности/обновления; документы реализации — только после принятия архитектуры.

Документ не заменяет `COS-RES-010`, не открывает повторно `COS-RES-012`, не изменяет текущий граф и не разрешает менять `decide.ts`. После принятия может потребоваться синхронизация зависимых документов.

## 11. Decision status / Статус решения

### EN
**Proposed, not yet accepted.** Review this as one architectural artifact. Do not begin implementation before the method is accepted and the independent validation protocol is defined.

### RU
**Предлагается, но еще не принято.** Рассмотреть документ как единый архитектурный артефакт. Не начинать реализацию до принятия метода и определения протокола независимой валидации.

## 12. Change log / История изменений

- `0.1.0` — `2026-10-21`: Initial bilingual proposal informed by the failures recorded in `COS-RES-011`.
- `0.1.0` — `2026-10-21`: Первоначальное двуязычное предложение с учетом неудач, зафиксированных в `COS-RES-011`.
