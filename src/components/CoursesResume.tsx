"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { isStoredCertificate } from "@/lib/course-certificates";
import {
  ArrowRight,
  Award,
  BookOpen,
  Braces,
  CheckCircle2,
  Clock3,
  CloudCog,
  Code2,
  Database,
  Download,
  ExternalLink,
  Gauge,
  GraduationCap,
  Languages,
  Layers3,
  LockKeyhole,
  MapPin,
  Save,
  Sparkles,
  Terminal,
  Upload,
  WalletCards,
} from "lucide-react";
import { useI18n } from "./I18n";

export type CourseProgressStatus = "planned" | "in_progress" | "completed";

export type CourseProgress = {
  course_id: string;
  status: CourseProgressStatus;
  progress_percent: number;
  current_step: string | null;
  next_step: string | null;
  private_note: string | null;
  certificate_url: string | null;
  completed_at: string | null;
  updated_at?: string;
};

type CourseLevel = "Básico" | "Intermediário" | "Avançado";
type CourseTier = "free" | "paid";
type Tone = "violet" | "blue" | "cyan" | "mint" | "orange";

/**
 * Idiomas ou programação.
 *
 * O Hub tinha uma aba só de Idiomas e outra de Cursos, e as duas ensinavam
 * coisas — uma com o sistema de estudo, a outra com a lista. Juntar tudo aqui
 * deixa uma pergunta só ("o que estudar?") com um lugar só para responder.
 */
type CourseCategory = "idiomas" | "programacao";

type Course = {
  id: string;
  categoria: CourseCategory;
  tier: CourseTier;
  name: string;
  shortName: string;
  provider: string;
  area: string;
  level: CourseLevel;
  duration: string;
  language: string;
  prerequisite: string;
  certificate: string;
  summary: string;
  cvValue: string;
  skills: string[];
  url: string;
  certificateUrl: string;
  priority: number;
  icon: LucideIcon;
  tone: Tone;
  mark: string;
};

export type CourseProgressPatch = Partial<Pick<CourseProgress,
  "status" | "progress_percent" | "current_step" | "next_step" | "private_note" | "certificate_url" | "completed_at"
>>;

export const courseCatalog: Course[] = [
  {
    id: "duolingo",
    categoria: "idiomas",
    tier: "free",
    name: "Duolingo — Inglês e Espanhol",
    shortName: "Duolingo",
    provider: "Duolingo",
    area: "Inglês e Espanhol",
    level: "Básico",
    duration: "Diário · no seu ritmo",
    language: "Português",
    prerequisite: "Nenhum",
    certificate: "Não emite certificado reconhecido. O Duolingo English Test é outro produto, pago e separado.",
    summary: "Prática diária curta de vocabulário e frases. Serve para manter constância, não para provar nível.",
    cvValue: "Não vale como comprovação. Vale como hábito diário que sustenta os cursos que valem.",
    skills: ["Vocabulário", "Leitura", "Constância"],
    url: "https://www.duolingo.com/",
    certificateUrl: "",
    priority: 20,
    icon: Languages,
    tone: "mint",
    mark: "I1",
  },
  {
    id: "bbc-learning-english",
    categoria: "idiomas",
    tier: "free",
    name: "BBC Learning English",
    shortName: "BBC English",
    provider: "BBC",
    area: "Inglês",
    level: "Intermediário",
    duration: "Aulas curtas · no seu ritmo",
    language: "Inglês",
    prerequisite: "Inglês básico",
    certificate: "Não emite certificado.",
    summary: "Vídeos, notícias adaptadas e gramática explicada por uma fonte que também é jornalismo real.",
    cvValue: "Não vale como comprovação, mas é onde a escuta melhora de verdade: inglês falado por adulto, no ritmo normal.",
    skills: ["Escuta", "Gramática", "Vocabulário"],
    url: "https://www.bbc.co.uk/learningenglish",
    certificateUrl: "",
    priority: 21,
    icon: Languages,
    tone: "blue",
    mark: "I2",
  },
  {
    id: "britishcouncil-learnenglish",
    categoria: "idiomas",
    tier: "free",
    name: "LearnEnglish — British Council",
    shortName: "British Council",
    provider: "British Council",
    area: "Inglês",
    level: "Intermediário",
    duration: "Por nível · no seu ritmo",
    language: "Inglês",
    prerequisite: "Inglês básico",
    certificate: "O material gratuito não certifica. Os cursos pagos e os exames da instituição, sim.",
    summary: "Exercícios organizados por nível do quadro europeu, com gramática, escuta e escrita.",
    cvValue: "Prepara para o que vale no visto: o exame reconhecido. O estudo é gratuito; a prova é paga.",
    skills: ["Gramática", "Escrita", "Escuta"],
    url: "https://learnenglish.britishcouncil.org/",
    certificateUrl: "",
    priority: 22,
    icon: Languages,
    tone: "cyan",
    mark: "I3",
  },
  {
    id: "cambridge-english",
    categoria: "idiomas",
    tier: "paid",
    name: "Cambridge English — preparação e exame",
    shortName: "Cambridge",
    provider: "Cambridge University Press & Assessment",
    area: "Inglês certificado",
    level: "Avançado",
    duration: "Depende do nível de entrada",
    language: "Inglês",
    prerequisite: "Inglês intermediário",
    certificate: "Certificado reconhecido por universidades e consulados. O valor varia por país e por exame — confira no site.",
    summary: "Material de preparação e os exames que emitem o certificado aceito em candidatura e visto.",
    cvValue: "É o tipo de comprovação que a universidade e o consulado aceitam. Sem ela, nível de inglês é afirmação.",
    skills: ["Inglês certificado", "Escrita acadêmica", "Fala"],
    url: "https://www.cambridgeenglish.org/learning-english/",
    certificateUrl: "https://www.cambridgeenglish.org/",
    priority: 23,
    icon: Award,
    tone: "violet",
    mark: "I4",
  },
  {
    id: "cervantes-ave",
    categoria: "idiomas",
    tier: "paid",
    name: "AVE Global — Instituto Cervantes",
    shortName: "Cervantes AVE",
    provider: "Instituto Cervantes",
    area: "Espanhol",
    level: "Básico",
    duration: "Por nível · com tutoria",
    language: "Espanhol",
    prerequisite: "Nenhum",
    certificate: "Emite certificado de aproveitamento. O DELE, que é o diploma oficial, é um exame à parte.",
    summary: "Curso de espanhol do órgão oficial da língua, com tutor acompanhando.",
    cvValue: "A instituição é a referência oficial do espanhol — o que pesa numa candidatura à Espanha.",
    skills: ["Espanhol", "Gramática", "Conversação"],
    url: "https://ave.cervantes.es/",
    certificateUrl: "https://www.cervantes.es/",
    priority: 24,
    icon: Languages,
    tone: "orange",
    mark: "I5",
  },
  {
    id: "italki",
    categoria: "idiomas",
    tier: "paid",
    name: "italki — aulas com professor",
    shortName: "italki",
    provider: "italki",
    area: "Inglês e Espanhol",
    level: "Intermediário",
    duration: "Por aula · você escolhe",
    language: "Inglês ou Espanhol",
    prerequisite: "Conseguir montar frases simples",
    certificate: "Não emite certificado.",
    summary: "Aula particular por videochamada, cobrada por hora. O preço varia muito por professor.",
    cvValue: "Não certifica nada, mas é o único jeito de treinar fala com alguém corrigindo — que é o que trava na entrevista.",
    skills: ["Fala", "Escuta", "Entrevista"],
    url: "https://www.italki.com/",
    certificateUrl: "",
    priority: 25,
    icon: Languages,
    tone: "mint",
    mark: "I6",
  },
  {
    id: "cs50x-2026",
    categoria: "programacao",
    tier: "free",
    name: "CS50x 2026 — Introduction to Computer Science",
    shortName: "CS50x",
    provider: "Harvard CS50",
    area: "Fundamentos",
    level: "Básico",
    duration: "11 semanas · autoguiado",
    language: "Inglês",
    prerequisite: "Nenhum conhecimento prévio",
    certificate: "Certificado gratuito do CS50 ao concluir as atividades e o projeto final. O certificado verificado do edX é pago.",
    summary: "Aprenda a pensar como programador com C, Python, SQL, JavaScript, algoritmos, memória e estruturas de dados.",
    cvValue: "É a base mais forte da trilha: comprova fundamentos de ciência da computação e termina com um projeto próprio para o portfólio.",
    skills: ["C", "Python", "Algorithms", "Data Structures", "SQL"],
    url: "https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science",
    certificateUrl: "https://cs50.harvard.edu/x/certificate/",
    priority: 1,
    icon: Terminal,
    tone: "violet",
    mark: "01",
  },
  {
    id: "cs50-python",
    categoria: "programacao",
    tier: "free",
    name: "CS50’s Introduction to Programming with Python",
    shortName: "CS50P",
    provider: "Harvard CS50",
    area: "Python",
    level: "Básico",
    duration: "10 semanas · autoguiado",
    language: "Inglês",
    prerequisite: "Nenhum conhecimento prévio",
    certificate: "Certificado gratuito do CS50 ao cumprir os requisitos do curso. O certificado verificado do edX é pago.",
    summary: "Python do zero com funções, testes, bibliotecas, orientação a objetos, expressões regulares e leitura de arquivos.",
    cvValue: "Transforma Python em competência demonstrável por exercícios e projeto, útil para automação, back-end e entrevistas técnicas.",
    skills: ["Python", "Unit Testing", "OOP", "Regular Expressions"],
    url: "https://www.edx.org/learn/python/harvard-university-cs50-s-introduction-to-programming-with-python",
    certificateUrl: "https://cs50.harvard.edu/python/certificate/",
    priority: 2,
    icon: Braces,
    tone: "blue",
    mark: "02",
  },
  {
    id: "cs50-sql",
    categoria: "programacao",
    tier: "free",
    name: "CS50’s Introduction to Databases with SQL",
    shortName: "CS50 SQL",
    provider: "Harvard CS50",
    area: "Banco de dados",
    level: "Intermediário",
    duration: "7 semanas · autoguiado",
    language: "Inglês",
    prerequisite: "Pode ser feito antes ou depois do CS50x",
    certificate: "Certificado gratuito do CS50 ao cumprir os requisitos dos problemas e do projeto final. O certificado verificado do edX é pago.",
    summary: "Modele bancos relacionais, escreva consultas, crie índices e aprenda otimização, concorrência e escalabilidade.",
    cvValue: "Acrescenta uma prova específica de banco de dados e permite publicar um projeto com schema, consultas e decisões documentadas.",
    skills: ["SQL", "Database Design", "Indexes", "Data Modeling"],
    url: "https://www.edx.org/learn/sql/harvard-university-cs50-s-introduction-to-databases-with-sql",
    certificateUrl: "https://cs50.harvard.edu/sql/certificate/",
    priority: 3,
    icon: Database,
    tone: "cyan",
    mark: "03",
  },
  {
    id: "cs50-web",
    categoria: "programacao",
    tier: "free",
    name: "CS50’s Web Programming with Python and JavaScript",
    shortName: "CS50W",
    provider: "Harvard CS50",
    area: "Full stack web",
    level: "Avançado",
    duration: "9 módulos + capstone",
    language: "Inglês",
    prerequisite: "CS50x ou experiência equivalente",
    certificate: "Certificado gratuito do CS50 após concluir os projetos exigidos. O certificado verificado do edX é pago.",
    summary: "Construa aplicações completas com Django, JavaScript, SQL, APIs, testes, segurança, escalabilidade e interfaces responsivas.",
    cvValue: "É o fechamento natural da trilha gratuita porque exige aplicações reais e um capstone mais complexo para apresentar no GitHub.",
    skills: ["Django", "JavaScript", "APIs", "Testing", "Scalability"],
    url: "https://www.edx.org/learn/web-development/harvard-university-cs50-s-web-programming-with-python-and-javascript",
    certificateUrl: "https://cs50.harvard.edu/web/certificate/",
    priority: 4,
    icon: Layers3,
    tone: "mint",
    mark: "04",
  },
  {
    id: "meta-frontend",
    categoria: "programacao",
    tier: "paid",
    name: "Meta Front-End Developer Professional Certificate",
    shortName: "Meta Front-End",
    provider: "Meta · Coursera",
    area: "Front-end",
    level: "Básico",
    duration: "Estimativa: 7 meses · 6h/semana",
    language: "Inglês · traduções disponíveis",
    prerequisite: "Nenhum conhecimento prévio",
    certificate: "Credencial profissional compartilhável incluída na modalidade paga da Coursera; confirme o preço local antes de assinar.",
    summary: "HTML, CSS, JavaScript, React, Git, testes e projetos de front-end preparados para portfólio e entrevista.",
    cvValue: "Boa escolha paga se você quiser se posicionar especificamente para front-end e sair com projetos React revisáveis por recrutadores.",
    skills: ["JavaScript", "React", "Git", "Unit Testing", "Responsive Web"],
    url: "https://www.coursera.org/professional-certificates/meta-front-end-developer",
    certificateUrl: "https://www.coursera.org/professional-certificates/meta-front-end-developer",
    priority: 1,
    icon: Code2,
    tone: "blue",
    mark: "FE",
  },
  {
    id: "meta-backend",
    categoria: "programacao",
    tier: "paid",
    name: "Meta Back-End Developer Professional Certificate",
    shortName: "Meta Back-End",
    provider: "Meta · Coursera",
    area: "Back-end",
    level: "Intermediário",
    duration: "Estimativa: 8 meses · 6h/semana",
    language: "Inglês · traduções disponíveis",
    prerequisite: "Começa do básico, mas a trilha gratuita ajuda",
    certificate: "Credencial profissional compartilhável incluída na modalidade paga da Coursera; confirme o preço local antes de assinar.",
    summary: "Python, Django, APIs REST, SQL, Linux, Git, estruturas de dados e preparação para entrevista de programação.",
    cvValue: "É a opção paga mais direta para comprovar back-end em Python e ligar o certificado a APIs e sistemas reais do seu portfólio.",
    skills: ["Python", "Django", "REST APIs", "SQL", "Git"],
    url: "https://www.coursera.org/professional-certificates/meta-back-end-developer",
    certificateUrl: "https://www.coursera.org/professional-certificates/meta-back-end-developer",
    priority: 2,
    icon: Braces,
    tone: "violet",
    mark: "BE",
  },
  {
    id: "ibm-full-stack",
    categoria: "programacao",
    tier: "paid",
    name: "IBM Full Stack Software Developer Professional Certificate",
    shortName: "IBM Full Stack",
    provider: "IBM · Coursera",
    area: "Full stack + cloud",
    level: "Intermediário",
    duration: "Estimativa: 6 meses · 10h/semana",
    language: "Inglês · traduções disponíveis",
    prerequisite: "Nenhum conhecimento prévio formal",
    certificate: "Credencial profissional compartilhável incluída na modalidade paga da Coursera; confirme o preço local antes de assinar.",
    summary: "React, Node.js, Python, Django, containers, Kubernetes, microsserviços, cloud e vários projetos práticos.",
    cvValue: "Entrega uma visão ampla de produto web e infraestrutura, com capstone e projetos que podem fortalecer seu GitHub além do certificado.",
    skills: ["React", "Node.js", "Python", "Containers", "Cloud"],
    url: "https://www.coursera.org/professional-certificates/ibm-full-stack-cloud-developer",
    certificateUrl: "https://www.coursera.org/professional-certificates/ibm-full-stack-cloud-developer",
    priority: 3,
    icon: Layers3,
    tone: "cyan",
    mark: "FS",
  },
  {
    id: "microsoft-devops-engineering",
    categoria: "programacao",
    tier: "paid",
    name: "Microsoft DevOps Engineering Professional Certificate",
    shortName: "Microsoft DevOps",
    provider: "Microsoft · Coursera",
    area: "DevOps avançado",
    level: "Avançado",
    duration: "Estimativa: 4 semanas · 10h/semana",
    language: "Inglês",
    prerequisite: "2–3 anos recomendados em DevOps, cloud ou engenharia",
    certificate: "Credencial profissional compartilhável incluída na modalidade paga da Coursera; confirme o preço local antes de assinar.",
    summary: "CI/CD, GitHub Actions, Azure DevOps, Terraform, Kubernetes, segurança de supply chain e observabilidade.",
    cvValue: "Deixe para o fim: é uma credencial avançada para demonstrar automação de entrega e infraestrutura depois de dominar aplicações completas.",
    skills: ["CI/CD", "GitHub Actions", "Terraform", "Kubernetes", "DevSecOps"],
    url: "https://www.coursera.org/professional-certificates/devops-engineering",
    certificateUrl: "https://www.coursera.org/professional-certificates/devops-engineering",
    priority: 4,
    icon: CloudCog,
    tone: "orange",
    mark: "DO",
  },
];

const levels: Array<"Todos" | CourseLevel> = ["Todos", "Básico", "Intermediário", "Avançado"];
const currentCatalogIds = new Set(courseCatalog.map((course) => course.id));

/**
 * Quantos cursos cada aba tem, de verdade.
 *
 * O número era "4" escrito à mão nas duas abas. Com 14 cursos e um filtro de
 * categoria, número fixo vira mentira na primeira troca — e um contador errado
 * é pior que contador nenhum.
 */
function contar(tier: CourseTier, categoria: CourseCategory | "todas"): number {
  return courseCatalog.filter((curso) => curso.tier === tier && (categoria === "todas" || curso.categoria === categoria)).length;
}
const courseAssetPath = (path: string) => `${process.env.NEXT_PUBLIC_ARTX_BASE_PATH ?? ""}${path}`;

export function CoursesResume({
  progress,
  savingCourseId,
  localOnly,
  onUpdate,
  onAttach,
  onDownload,
  onAbrirIdiomas,
}: {
  progress: CourseProgress[];
  savingCourseId: string | null;
  localOnly: boolean;
  onUpdate: (courseId: string, patch: CourseProgressPatch) => Promise<boolean>;
  onAttach: (courseId: string, file: File) => Promise<boolean>;
  onDownload: (courseId: string, reference: string) => Promise<void>;
  onAbrirIdiomas?: () => void;
}) {
  const { t } = useI18n();
  const [tier, setTier] = useState<CourseTier>("free");
  const [categoria, setCategoria] = useState<CourseCategory | "todas">("todas");
  const [level, setLevel] = useState<"Todos" | CourseLevel>("Todos");
  const [expandedCourse, setExpandedCourse] = useState<string>("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const catalogProgress = useMemo(() => progress.filter((item) => currentCatalogIds.has(item.course_id)), [progress]);
  const progressByCourse = useMemo(() => new Map(catalogProgress.map((item) => [item.course_id, item])), [catalogProgress]);
  const visibleCourses = courseCatalog
    .filter((course) => course.tier === tier && (categoria === "todas" || course.categoria === categoria) && (level === "Todos" || course.level === level))
    .sort((a, b) => a.priority - b.priority);
  function getNote(courseId: string, saved?: CourseProgress) {
    return noteDrafts[courseId] ?? saved?.private_note ?? saved?.current_step ?? "";
  }

  async function saveNote(course: Course, saved?: CourseProgress) {
    const note = getNote(course.id, saved).trim();
    const stored = await onUpdate(course.id, { private_note: note });
    if (stored) {
      setNoteDrafts((current) => {
        const remaining = { ...current };
        delete remaining[course.id];
        return remaining;
      });
    }
  }

  return (
    <section className="courses-page page-enter">
      <header className="courses-hero-v2">
        <div className="courses-hero-copy">
          <p className="eyebrow"><Award size={13} />{t(" TRILHA DE PROGRAMAÇÃO")}</p>
          <h1>{t("Do primeiro algoritmo ao sistema em produção.")}</h1>
          <p>{t("Uma rota focada em programação, com cursos oficiais, projetos para portfólio e uma anotação simples para lembrar onde você parou.")}</p>
          <div className="hero-course-actions">
            <a href="#programming-roadmap">{t("Ver rota recomendada ")}<ArrowRight size={15} /></a>
            <span><LockKeyhole size={13} /> {localOnly ? t("Salvo neste dispositivo") : t("Anotações privadas na sua conta")}</span>
          </div>
        </div>
        <Image
          className="courses-hero-art"
          src={courseAssetPath("/course-art/programming-roadmap.png")}
          alt={t("Trilha visual de aprendizado em programação, de código e dados até nuvem")}
          width={1536}
          height={864}
          priority
          sizes="(max-width: 900px) 100vw, 58vw"
        />
      </header>

      <section className="programming-roadmap" id="programming-roadmap" aria-labelledby="roadmap-title">
        <div className="roadmap-heading">
          <span><Sparkles size={15} />{t(" ROTA RECOMENDADA")}</span>
          <h2 id="roadmap-title">{t("Quatro degraus. Um projeto público ao final de cada etapa.")}</h2>
          <p>{t("Complete a sequência gratuita primeiro. Depois escolha uma especialização paga em vez de tentar fazer todas ao mesmo tempo.")}</p>
        </div>
        <ol>
          <li><span>01</span><Terminal size={21} /><div><strong>{t("Fundamentos")}</strong><small>{t("CS50x · lógica, C e algoritmos")}</small></div></li>
          <li><span>02</span><Braces size={21} /><div><strong>{t("Linguagem")}</strong><small>{t("CS50P · Python e testes")}</small></div></li>
          <li><span>03</span><Database size={21} /><div><strong>{t("Dados")}</strong><small>{t("CS50 SQL · modelagem e escala")}</small></div></li>
          <li><span>04</span><Layers3 size={21} /><div><strong>{t("Produto web")}</strong><small>{t("CS50W · aplicações e capstone")}</small></div></li>
        </ol>
      </section>

      <div className="course-controls">
        <div className="course-tabs" role="tablist" aria-label="Tipo de curso">
          <button role="tab" aria-selected={tier === "free"} className={tier === "free" ? "active" : ""} onClick={() => setTier("free")}><GraduationCap size={16} />{t(" Gratuitos ")}<small>{contar("free", categoria)}</small></button>
          <button role="tab" aria-selected={tier === "paid"} className={tier === "paid" ? "active" : ""} onClick={() => setTier("paid")}><WalletCards size={16} />{t(" Pagos ")}<small>{contar("paid", categoria)}</small></button>
        </div>
        <div className="course-level-filters" aria-label={t("Filtrar por área")}>
          {([["todas", "Tudo"], ["idiomas", "Idiomas"], ["programacao", "Programação"]] as const).map(([chave, rotulo]) => (
            <button key={chave} className={categoria === chave ? "active" : ""} aria-pressed={categoria === chave} onClick={() => setCategoria(chave)}>
              {t(rotulo)}
            </button>
          ))}
        </div>

        {categoria === "idiomas" && onAbrirIdiomas && (
          /*
            O sistema de Idiomas saiu da barra lateral, mas continua existindo e
            guardando o progresso dele. Sem este caminho de volta ele viraria um
            app no ar que ninguém alcança.
          */
          <button type="button" className="curso-idiomas-link" onClick={onAbrirIdiomas}>
            <Languages size={15} />
            <span>
              <strong>{t("Seu sistema de estudo")}</strong>
              <small>{t("Plano diário, exercícios e progresso de inglês e espanhol")}</small>
            </span>
            <ArrowRight size={15} />
          </button>
        )}

        <div className="course-level-filters" aria-label={t("Filtrar por nível")}>
          {levels.map((item) => <button type="button" className={level === item ? "active" : ""} key={item} onClick={() => setLevel(item)}>{t(item)}</button>)}
        </div>
      </div>

      <div className="course-tab-note">
        <span>{tier === "free" ? t("Acesso gratuito. Alguns não emitem certificado — cada cartão diz o que emite.") : t("Pagos. O valor muda por país e por exame; confirme no site antes de assinar.")}</span>
        <span><CheckCircle2 size={13} />{t(" Links e requisitos conferidos em 04/09/2026")}</span>
      </div>

      <div className="course-grid-v2">
        {visibleCourses.map((course) => {
          const saved = progressByCourse.get(course.id);
          const note = getNote(course.id, saved);
          const expanded = expandedCourse === course.id;
          const saving = savingCourseId !== null;
          const status = saved?.status ?? "planned";
          const CourseIcon = course.icon;
          return (
            <article className={`course-card-v2 ${status}`} data-tone={course.tone} key={course.id}>
              <div className="course-visual">
                <div className="course-visual-grid" aria-hidden="true" />
                <span className="course-mark">{t(course.mark)}</span>
                <CourseIcon size={38} strokeWidth={1.45} />
                <div className="course-visual-code" aria-hidden="true"><i /><i /><i /><i /></div>
                <div className="course-level"><Gauge size={12} /> {t(course.level)}</div>
              </div>

              <div className="course-card-body">
                <div className="course-card-top">
                  <span className="course-area">{t(course.area)}</span>
                </div>
                <p className="course-provider">{t(course.provider)}</p>
                <h2>{t(course.name)}</h2>
                <p className="course-summary">{t(course.summary)}</p>
                <div className="course-facts">
                  <span><Clock3 size={14} /> {t(course.duration)}</span>
                  <span><BookOpen size={14} /> {t(course.prerequisite)}</span>
                  <span><Languages size={14} /> {t(course.language)}</span>
                </div>

                <div className="course-actions course-entry-action">
                  <a href={course.url} target="_blank" rel="noopener noreferrer" aria-label={`Ir para o curso ${course.shortName}`}>{t("Ir para o curso ")}<ExternalLink size={14} /></a>
                </div>

                <label className="course-status-select" htmlFor={`status-${course.id}`}>{t("Status do curso ")}<select id={`status-${course.id}`} value={status} disabled={saving} onChange={(event) => void onUpdate(course.id, { status: event.target.value as CourseProgressStatus })}>
                    <option value="planned">{t("Não iniciado")}</option>
                    <option value="in_progress">{t("Em andamento")}</option>
                    <option value="completed">{t("Finalizado")}</option>
                  </select>
                </label>

                {status === "completed" && <CourseCertificate courseId={course.id} reference={saved?.certificate_url ?? null} disabled={saving} localOnly={localOnly} onAttach={onAttach} onDownload={onDownload} />}

                <div className="study-log">
                  <div className="study-log-title"><div><MapPin size={17} /><span><strong>{t("Minha anotação")}</strong><small>{localOnly ? t("Salva neste dispositivo") : t("Privada · salva na sua conta")}</small></span></div></div>
                  <label htmlFor={`note-${course.id}`}>{t("Onde eu parei")}<textarea id={`note-${course.id}`} maxLength={3000} rows={3} placeholder={t("Ex.: parei na aula 3, minuto 28. Na próxima, continuar o exercício…")} value={note} disabled={saving} onChange={(event) => setNoteDrafts((current) => ({ ...current, [course.id]: event.target.value }))} /></label>
                  <div className="study-log-footer"><span aria-live="polite">{noteDrafts[course.id] !== undefined ? t("Alterações não salvas") : saved?.private_note !== undefined && saved.private_note !== null ? t("Anotação salva") : ""}</span><button type="button" disabled={saving} onClick={() => void saveNote(course, saved)}><Save size={14} /> {saving ? t("Salvando…") : t("Salvar anotação")}</button></div>
                </div>

                {expanded ? (
                  <div className="course-details-v2">
                    <div className="course-explanation"><strong>{t("Por que entra no seu plano")}</strong><p>{t(course.cvValue)}</p></div>
                    <div className="course-skills">{course.skills.map((skill) => <span key={skill}>{t(skill)}</span>)}</div>
                    <div className="course-certificate"><Award size={16} /><span><strong>{t("Como emitir o certificado")}</strong>{t(course.certificate)}<a href={course.certificateUrl} target="_blank" rel="noreferrer">{t("Ver requisitos oficiais ")}<ExternalLink size={12} /></a></span></div>

                  </div>
                ) : null}

                <button className="course-expand" type="button" aria-expanded={expanded} onClick={() => setExpandedCourse(expanded ? "" : course.id)}>
                  {expanded ? t("Fechar detalhes") : t("Sobre o curso e certificado")} <ArrowRight size={14} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {visibleCourses.length === 0 ? <div className="course-empty"><Code2 size={22} /><strong>{t("Nenhum curso neste nível.")}</strong><button type="button" onClick={() => setLevel("Todos")}>{t("Mostrar todos")}</button></div> : null}

      <aside className="cv-rules">
        <div><Award size={19} /><strong>{t("Transforme curso em prova")}</strong></div>
        <ol>
          <li>{t("Conclua o projeto final e publique o código no GitHub.")}</li>
          <li>{t("Adicione a credencial ao CV somente quando conseguir comprová-la.")}</li>
          <li>{t("Descreva o projeto e as tecnologias; o certificado reforça a entrega.")}</li>
        </ol>
      </aside>
    </section>
  );
}

function CourseCertificate({ courseId, reference, disabled, localOnly, onAttach, onDownload }: {
  courseId: string;
  reference: string | null;
  disabled: boolean;
  localOnly: boolean;
  onAttach: (courseId: string, file: File) => Promise<boolean>;
  onDownload: (courseId: string, reference: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  async function attach() {
    if (!file || disabled || uploading) return;
    setUploading(true);
    try {
      if (await onAttach(courseId, file)) {
        setFile(null);
        setInputKey((key) => key + 1);
      }
    } finally { setUploading(false); }
  }
  const stored = reference && isStoredCertificate(reference);
  return <div className="course-certificate-upload">
    <div className="certificate-upload-title"><Award size={18} /><strong>{t("Certificado de conclusão")}</strong></div>
    <p>{localOnly ? "Arquivo salvo neste dispositivo." : t("Arquivo privado, salvo na sua conta.")}{t(" PDF, JPG ou PNG · até 10 MB.")}</p>
    {reference && (stored
      ? <button className="certificate-download" type="button" disabled={disabled} onClick={() => void onDownload(courseId, reference)}><Download size={14} />{t(" Baixar certificado anexado")}</button>
      : reference.startsWith("https://") ? <a className="certificate-download" href={reference} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />{t(" Ver certificado")}</a> : null)}
    <label htmlFor={`certificate-${courseId}`}>{reference ? "Substituir certificado" : "Anexar certificado"}
      <input key={inputKey} id={`certificate-${courseId}`} type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" disabled={disabled || uploading} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
    </label>
    {file && <button className="certificate-send" type="button" disabled={disabled || uploading} onClick={() => void attach()}><Upload size={14} /> {uploading ? "Enviando…" : t("Salvar certificado")}</button>}
  </div>;
}
