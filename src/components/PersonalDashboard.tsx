"use client";

/**
 * A visão geral.
 *
 * Era uma página de texto — cartões com frases, listas, um bloco de notas —
 * e passou a ser uma página de números desenhados. A pergunta que ela
 * responde é uma só: "em que pé está cada coisa?". Texto responde isso
 * devagar; uma barra responde de relance.
 *
 * O que saiu foi para onde já tinha lugar. As anotações vivem no Relatório,
 * que já tinha as suas. As atividades continuam na aba da Jade, onde ela
 * cria e conclui. Aqui fica só o que dá para ver sem ler.
 *
 * As cores vêm de variáveis de tema — nenhum gráfico tem cor escrita à mão —
 * para que trocar o tema troque os gráficos junto.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bell, CalendarClock, RefreshCw } from "lucide-react";
import { WeekAhead } from "./WeekAhead";
import { type RouteSignals } from "@/lib/week-ahead";
import { CHAVE, resumoParaOHub } from "@/lib/relatorio";
import { avisarSePermitido, limparTitulo, marcarTitulo, pedirPermissao, podeOferecer, textoDoAviso } from "@/lib/aviso-titulo";
import {
  numerosDeCursos,
  ordenarCursos,
  porEtapa,
  type CursoNoPainel,
  type VideoNoPainel,
} from "@/lib/painel";
import { useI18n } from "./I18n";

type Task = { id: string; title: string; project_slug: string | null; completed: boolean };
type View = "overview" | "relatorio" | "site" | "videos" | "sat" | "university" | "cursos" | "jade";

type Painel = { cursos: CursoNoPainel[] | null; videos: VideoNoPainel[] | null };

const porcento = (fracao: number) => `${Math.round(fracao * 100)}%`;

export function PersonalDashboard({
  tasks,
  routeSignals,
  syncError,
  accessToken,
  onOpen,
  onRetry,
}: {
  tasks: Task[];
  routeSignals: RouteSignals | null;
  syncError: string;
  accessToken: string | null;
  onOpen: (view: View) => void;
  onRetry: () => void;
}) {
  const { t, locale } = useI18n();
  const [painel, setPainel] = useState<Painel | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let vivo = true;
    fetch("/api/painel", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error();
        const dados = (await resposta.json()) as Painel;
        if (vivo) {
          setPainel(dados);
          setFalhou(false);
        }
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [accessToken, recarregar]);

  const cursos = useMemo(() => (painel?.cursos ? ordenarCursos(painel.cursos) : null), [painel]);
  const videos = painel?.videos ?? null;
  const numeros = cursos ? numerosDeCursos(cursos) : null;
  const emProducao = videos ? videos.filter((video) => video.etapa !== "POSTADO").length : null;
  const publicados = videos ? videos.filter((video) => video.etapa === "POSTADO").length : null;
  const abertas = tasks.filter((task) => !task.completed).length;
  const feitas = tasks.length - abertas;

  return (
    <div className="overview-page painel page-enter">
      <header className="painel-topo">
        <div>
          <p className="eyebrow">{t("VISÃO GERAL")}</p>
          <h1>{t("Em que pé está cada coisa.")}</h1>
        </div>
        <div className="painel-topo-acoes">
          <span className="day-label">
            {new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date())}
          </span>
          <button className="icon-button" onClick={() => setRecarregar((n) => n + 1)} title={t("Atualizar os números")} aria-label={t("Atualizar os números")}>
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      {syncError && (
        <div className="sync-alert" role="alert">
          <span>{t(syncError)}</span>
          <button onClick={onRetry}><RefreshCw size={15} />{t(" Tentar novamente")}</button>
        </div>
      )}

      <DocumentosVencendo onOpen={onOpen} />

      {/* Os números que abrem a página. Um por cartão, sem frase em volta. */}
      <section className="painel-numeros" aria-label={t("Resumo")}>
        <Numero rotulo={t("Cursos em andamento")} valor={numeros?.emAndamento} onClick={() => onOpen("cursos")} />
        <Numero rotulo={t("Aulas concluídas")} valor={numeros?.aulasFeitas} onClick={() => onOpen("cursos")} />
        <Numero rotulo={t("Vídeos em produção")} valor={emProducao} onClick={() => onOpen("videos")} />
        <Numero rotulo={t("Vídeos publicados")} valor={publicados} onClick={() => onOpen("videos")} />
      </section>

      {falhou && (
        <p className="painel-aviso" role="status">
          {t("Não consegui buscar os números agora.")}{" "}
          <button onClick={() => setRecarregar((n) => n + 1)}>{t("Tentar de novo")}</button>
        </p>
      )}

      <div className="painel-grade">
        <GraficoCursos cursos={cursos} carregando={!painel && !falhou} onOpen={() => onOpen("cursos")} />
        <GraficoVideos videos={videos} carregando={!painel && !falhou} onOpen={() => onOpen("videos")} />
        <FunilDeProducao videos={videos} carregando={!painel && !falhou} />
        <GraficoAtividades feitas={feitas} abertas={abertas} onOpen={() => onOpen("jade")} />
      </div>

      <WeekAhead routes={routeSignals} tasks={tasks} onOpen={onOpen} />
    </div>
  );
}

// ── Peças ─────────────────────────────────────────────────────────────

/** Um número grande com o que ele mede embaixo. Sem número ainda, um traço. */
function Numero({ rotulo, valor, onClick }: { rotulo: string; valor: number | null | undefined; onClick: () => void }) {
  return (
    <button className="painel-numero" onClick={onClick}>
      <strong>{valor ?? "—"}</strong>
      <span>{rotulo}</span>
    </button>
  );
}

/**
 * Uma barra de progresso de verdade: trilho do mesmo tom, preenchimento com
 * ponta arredondada, e o valor ao lado — nunca dentro, onde não caberia.
 */
function Medidor({ fracao, rotulo }: { fracao: number; rotulo: string }) {
  const largura = Math.max(0, Math.min(1, fracao)) * 100;
  return (
    <span className="medidor" role="img" aria-label={rotulo}>
      <span className="medidor-trilho">
        <span className="medidor-cheio" style={{ width: `${largura}%` }} />
      </span>
    </span>
  );
}

function Cartao({
  titulo,
  subtitulo,
  acao,
  children,
  numeros,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: () => void;
  children: React.ReactNode;
  numeros?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <article className="painel-cartao">
      <header>
        <div>
          <h2>{titulo}</h2>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        {acao && (
          <button className="painel-abrir" onClick={acao} aria-label={`${t("Abrir")} ${titulo}`}>
            <ArrowUpRight size={15} />
          </button>
        )}
      </header>
      {children}
      {/* A tabela é o caminho de quem não enxerga a barra — e de quem quer o número exato. */}
      {numeros && (
        <details className="painel-tabela">
          <summary>{t("Ver os números")}</summary>
          {numeros}
        </details>
      )}
    </article>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="painel-vazio">{children}</p>;
}

// ── Cursos ────────────────────────────────────────────────────────────

function GraficoCursos({ cursos, carregando, onOpen }: { cursos: CursoNoPainel[] | null; carregando: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  const visiveis = cursos?.slice(0, 7) ?? [];
  const resto = cursos ? cursos.length - visiveis.length : 0;
  const n = cursos ? numerosDeCursos(cursos) : null;

  return (
    <Cartao
      titulo={t("Cursos")}
      subtitulo={n ? `${n.emAndamento} ${t("em andamento")} · ${n.concluidos} ${t("concluídos")} · ${n.naoIniciados} ${t("por começar")}` : undefined}
      acao={onOpen}
      numeros={cursos && cursos.length > 0 && (
        <table>
          <thead><tr><th>{t("Curso")}</th><th>{t("Aulas")}</th><th>%</th></tr></thead>
          <tbody>{cursos.map((c) => <tr key={c.id}><td>{c.titulo}</td><td>{c.feitas} / {c.total}</td><td>{porcento(c.feitas / c.total)}</td></tr>)}</tbody>
        </table>
      )}
    >
      {carregando ? <Vazio>{t("Buscando…")}</Vazio>
        : cursos === null ? <Vazio>{t("Não consegui ler os cursos agora.")}</Vazio>
        : cursos.length === 0 ? <Vazio>{t("Abra o sistema de cursos uma vez e o avanço de cada um aparece aqui.")}</Vazio>
        : (
          <ul className="painel-linhas">
            {visiveis.map((curso) => {
              const fracao = curso.feitas / curso.total;
              const rotulo = `${curso.titulo}: ${curso.feitas} ${t("de")} ${curso.total} ${t("aulas")} (${porcento(fracao)})`;
              return (
                <li key={curso.id} title={rotulo} className={curso.feitas === 0 ? "parado" : ""}>
                  <span className="painel-linha-nome">{curso.titulo}</span>
                  <Medidor fracao={fracao} rotulo={rotulo} />
                  <span className="painel-linha-valor">{porcento(fracao)}</span>
                </li>
              );
            })}
            {resto > 0 && <li className="painel-resto">{t("e mais")} {resto}</li>}
          </ul>
        )}
    </Cartao>
  );
}

// ── Vídeos ────────────────────────────────────────────────────────────

function GraficoVideos({ videos, carregando, onOpen }: { videos: VideoNoPainel[] | null; carregando: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  /* Os publicados já não pedem nada; o que interessa é o que ainda está
     andando. Eles voltam a aparecer só se não houver nenhum em produção. */
  const andando = videos?.filter((video) => video.etapa !== "POSTADO") ?? [];
  const lista = (andando.length ? andando : videos ?? []).slice(0, 7);

  return (
    <Cartao
      titulo={t("Vídeos")}
      subtitulo={videos ? `${andando.length} ${t("em produção")}` : undefined}
      acao={onOpen}
      numeros={videos && videos.length > 0 && (
        <table>
          <thead><tr><th>{t("Vídeo")}</th><th>{t("Etapa")}</th><th>%</th></tr></thead>
          <tbody>{videos.map((v) => <tr key={v.id}><td>{v.titulo}</td><td>{t(v.rotulo)}</td><td>{porcento(v.progresso)}</td></tr>)}</tbody>
        </table>
      )}
    >
      {carregando ? <Vazio>{t("Buscando…")}</Vazio>
        : videos === null ? <Vazio>{t("Não consegui ler os vídeos agora.")}</Vazio>
        : videos.length === 0 ? <Vazio>{t("Nenhum vídeo ainda. O primeiro aparece aqui assim que for criado.")}</Vazio>
        : (
          <ul className="painel-linhas">
            {lista.map((video) => {
              const rotulo = `${video.titulo}: ${t(video.rotulo)}, ${porcento(video.progresso)} ${t("do vídeo")}`;
              return (
                <li key={video.id} title={rotulo}>
                  <span className="painel-linha-nome">
                    {video.titulo}
                    <small>{t(video.rotulo)}</small>
                  </span>
                  <Medidor fracao={video.progresso} rotulo={rotulo} />
                  <span className="painel-linha-valor">{porcento(video.progresso)}</span>
                </li>
              );
            })}
          </ul>
        )}
    </Cartao>
  );
}

/**
 * Onde a produção empilha.
 *
 * Uma cor só para as oito colunas: a ordem das etapas já está na posição, e
 * oito tons do mesmo roxo não se distinguem entre si — o validador de paleta
 * reprovou a rampa, então ela não entrou. A contagem fica no topo de cada
 * coluna, e a etapa vazia aparece vazia, porque um funil com buraco esconde
 * justamente onde as coisas travam.
 */
function FunilDeProducao({ videos, carregando }: { videos: VideoNoPainel[] | null; carregando: boolean }) {
  const { t } = useI18n();
  const etapas = videos ? porEtapa(videos) : [];
  const maior = Math.max(1, ...etapas.map((e) => e.total));

  return (
    <Cartao
      titulo={t("Onde os vídeos estão")}
      subtitulo={t("Quantos vídeos em cada etapa da produção")}
      numeros={videos && videos.length > 0 && (
        <table>
          <thead><tr><th>{t("Etapa")}</th><th>{t("Vídeos")}</th></tr></thead>
          <tbody>{etapas.map((e) => <tr key={e.etapa}><td>{t(e.rotulo)}</td><td>{e.total}</td></tr>)}</tbody>
        </table>
      )}
    >
      {carregando ? <Vazio>{t("Buscando…")}</Vazio>
        : !videos || videos.length === 0 ? <Vazio>{t("O funil aparece quando houver vídeos.")}</Vazio>
        : (
          <div className="funil" role="img" aria-label={etapas.map((e) => `${t(e.rotulo)}: ${e.total}`).join(", ")}>
            {etapas.map((etapa) => (
              <div key={etapa.etapa} className="funil-coluna" title={`${t(etapa.rotulo)}: ${etapa.total}`}>
                {/* O número mora em cima da própria coluna, e não no topo do
                    gráfico: solto lá em cima, ele se separa da barra dele. */}
                <span className="funil-barra-area">
                  {etapa.total > 0 && <span className="funil-valor">{etapa.total}</span>}
                  {/* Etapa vazia não ganha tracinho: um risco de 2px lê como
                      "um pouco", e zero é zero. A linha de base já mostra que
                      a etapa existe. */}
                  {etapa.total > 0 && <span className="funil-barra" style={{ height: `${(etapa.total / maior) * 100}%` }} />}
                </span>
                <span className="funil-rotulo">{t(etapa.rotulo)}</span>
              </div>
            ))}
          </div>
        )}
    </Cartao>
  );
}

// ── Atividades ────────────────────────────────────────────────────────

function GraficoAtividades({ feitas, abertas, onOpen }: { feitas: number; abertas: number; onOpen: () => void }) {
  const { t } = useI18n();
  const total = feitas + abertas;
  const fracao = total ? feitas / total : 0;

  return (
    <Cartao titulo={t("Atividades")} subtitulo={t("Criadas e concluídas pela Jade")} acao={onOpen}>
      {total === 0 ? <Vazio>{t("Nenhuma atividade ainda. Peça uma para a Jade.")}</Vazio> : (
        <div className="painel-meta">
          <strong>{porcento(fracao)}</strong>
          <Medidor fracao={fracao} rotulo={`${feitas} ${t("de")} ${total} ${t("atividades concluídas")}`} />
          <p>{feitas} {t("concluídas")} · {abertas} {t("em aberto")}</p>
        </div>
      )}
    </Cartao>
  );
}

function DocumentosVencendo({ onOpen }: { onOpen: (view: View) => void }) {
  const { t } = useI18n();
  const [resumo, setResumo] = useState<ReturnType<typeof resumoParaOHub> | null>(null);

  const [oferecer, setOferecer] = useState(false);

  useEffect(() => {
    let r = null;
    try {
      r = resumoParaOHub(localStorage.getItem(CHAVE));
    } catch {
      r = null;
    }
    setResumo(r);

    /*
      O contador no título da aba.

      É o que alcança a pessoa sem servidor: enquanto o Hub estiver aberto em
      algum lugar, o número aparece na aba, na barra de tarefas e no alternador
      de janelas — mesmo com a aba no fundo. Notificação com o navegador
      fechado exigiria e-mail ou push, que este sistema não tem, e prometer
      isso seria mentir.
    */
    const pendentes = r ? r.vencidos + r.vencendo : 0;
    marcarTitulo(pendentes);

    const texto = r ? textoDoAviso(r.vencidos, r.vencendo) : null;
    if (texto) avisarSePermitido(texto);
    setOferecer(Boolean(texto) && podeOferecer());

    // Sair da Visão geral não pode deixar o título sujo para sempre.
    return () => limparTitulo();
  }, []);

  if (!resumo || (resumo.vencendo === 0 && resumo.vencidos === 0)) return null;
  const total = resumo.vencendo + resumo.vencidos;

  return (
    <div className={`doc-alerta-bloco ${resumo.vencidos > 0 ? "vencido" : ""}`}>
      <button className={`doc-alerta ${resumo.vencidos > 0 ? "vencido" : ""}`} onClick={() => onOpen("relatorio")}>
        <CalendarClock size={16} />
        <span>
          <strong>
            {total} {t(total > 1 ? "documentos pedindo atenção" : "documento pedindo atenção")}
          </strong>
          {resumo.proximo && (
            <small>
              {resumo.proximo.nome} —{" "}
              {resumo.proximo.dias < 0
                ? t("já venceu")
                : resumo.proximo.dias === 0
                  ? t("vence hoje")
                  : `${resumo.proximo.dias} ${t(resumo.proximo.dias > 1 ? "dias" : "dia")}`}
            </small>
          )}
        </span>
        <ArrowUpRight size={16} />
      </button>

      {/*
        A permissão só é pedida a partir deste clique.

        Um site que abre a caixa de permissão sozinho é o que faz todo mundo
        clicar em "bloquear" — e aí o canal morre para sempre.
      */}
      {oferecer && (
        <button
          className="doc-alerta-permitir"
          onClick={() => void pedirPermissao().then(() => setOferecer(false))}
        >
          <Bell size={13} /> {t("Avisar no navegador")}
        </button>
      )}
    </div>
  );
}
