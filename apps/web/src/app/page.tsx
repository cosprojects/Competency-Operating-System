import Link from "next/link";
import type { Metadata } from "next";
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger";
import { IconCheckCircle } from "@/components/icons";

export const metadata: Metadata = {
  title: "AXIONA — карта компетенций, которая объясняет профессию",
  description:
    "AXIONA помогает разобраться в профессии: структура компетенций, знания, навыки и учебные материалы на одном канвасе.",
};

const FEATURES = [
  "Взаимосвязанная структура профессии",
  "Знания и навыки по каждой компетенции",
  "Учебные материалы",
  "Сохранения и статусы изучения",
  "Обратная связь о качестве карты",
];

const START_STEPS = [
  {
    title: "Выберите профессию",
    text: "Посмотрите разделы и поймите, из чего состоит направление.",
  },
  {
    title: "Откройте компетенцию",
    text: "Проверьте, какие знания и навыки в неё входят и что с ними делать.",
  },
  {
    title: "Найдите материал",
    text: "Перейдите к курсу или статье и сохраните то, к чему хотите вернуться.",
  },
];

const ROADMAP = [
  {
    stage: "01 · Сейчас",
    title: "Карта профессий",
    text: "Уже открыта: четыре направления дизайна, компетенции, знания, навыки и материалы к ним, плюс схемы, где видно, что на чём стоит.",
    current: true,
  },
  {
    stage: "02 · Дальше",
    title: "Больше направлений и проверенная база",
    text: "Добавим новые профессии и будем следить за качеством: формулировки компетенций, связи между ними и учебные источники.",
  },
  {
    stage: "03 · Дальше",
    title: "Личное пространство",
    text: "Появится сохранение компетенций и материалов, статусы изучения и цель — чтобы возвращаться к своему плану, а не искать заново.",
  },
  {
    stage: "04 · Дальше",
    title: "Профиль компетенций",
    text: "Соберём картину твоих навыков из самооценки, материалов и короткой практической задачи — с пометкой, что подтверждено, а что пока нет.",
  },
  {
    stage: "05 · Дальше",
    title: "Маршрут развития",
    text: "Покажем, что подтянуть под выбранную цель и с какого шага начать, а результат шагов будет виден в профиле.",
  },
  {
    stage: "06 · Позже",
    title: "Команды и организации",
    text: "Общий язык компетенций для команд: цели развития, пробелы и прогресс — без скрытой оценки людей.",
  },
];

export default function HomePage() {
  return (
    <div className="home-screen">
      <div className="workspace">
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="eyebrow">Beta 1</p>
            <h1>Карта компетенций, которая объясняет профессию</h1>
            <p className="home-lead">
              AXIONA помогает разобраться в своей профессии и понять, куда развиваться дальше. Мы
              собираем профессиональные знания и навыки в понятную структуру, чтобы каждый мог
              увидеть, из чего складывается его профессия, оценить интересующие направления и найти
              материалы для обучения.
            </p>
          </div>

          <div className="home-aside">
            <div className="hero-panel">
              <h2>Что внутри</h2>
              <ul className="checklist">
                {FEATURES.map((feature) => (
                  <li key={feature}>
                    <span className="check" aria-hidden="true">
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <Link className="button block" href="/professions">
              Выбрать профессию
            </Link>
          </div>
        </section>

        <section className="feedback-invite">
          <p className="invite-title">Помогите нам сделать систему полезнее</p>
          <p>
            Мы хотим, чтобы эти карты действительно помогали людям ориентироваться в профессии,
            находить новые направления для развития и понимать, какие знания могут быть полезны в
            работе. Попробуйте изучить карту своей профессии. Насколько полно она отражает реальные
            требования к специалисту? Всё ли понятно? Каких компетенций, знаний или навыков не
            хватает? Поделитесь своим мнением. Ваш опыт поможет нам сделать систему точнее,
            полезнее и ближе к реальным потребностям людей.
          </p>
          <FeedbackTrigger className="button" options={{ context: "general" }}>
            Поделитесь своим мнением
          </FeedbackTrigger>
        </section>

        <section className="home-section">
          <p className="eyebrow">Профессии</p>
          <h2>С чего начать</h2>
          <div className="start-grid">
            {START_STEPS.map((step, index) => (
              <article className="start-card" key={step.title}>
                <span className="start-num">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
          <p className="home-paragraph">
            У каждой профессии есть своя структура: знания, навыки и компетенции, которые помогают
            специалисту решать профессиональные задачи. Но часто бывает непросто понять, что именно
            нужно изучать, какие навыки развивать и с чего лучше начать. AXIONA помогает увидеть
            профессию целиком и разобраться в её составляющих. Выберите интересующую вас профессию,
            изучите её компетенции, посмотрите связанные с ними знания и навыки, найдите полезные
            материалы. Необязательно знать всё заранее или двигаться по готовому плану. Начните с
            того, что интересно или актуально для вас сейчас. Постепенно вы сможете лучше понять свои
            возможности и направления дальнейшего развития.
          </p>
        </section>

        <section className="home-section">
          <h2 className="lg">Дорожная карта развития</h2>
          <p className="section-subtitle">Последовательность этапов развития платформы компетенций.</p>
          <div className="roadmap-card">
            {ROADMAP.map((item) => (
              <article className={`roadmap-stage${item.current ? " is-current" : ""}`} key={item.title}>
                <span className="roadmap-icon" aria-hidden="true">
                  <IconCheckCircle />
                </span>
                <div className="roadmap-text">
                  <p className="roadmap-title">
                    <span>{item.stage}</span>
                    <span>{item.title}</span>
                  </p>
                  <p className="roadmap-desc">{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
