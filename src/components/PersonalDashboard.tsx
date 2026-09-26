"use client";

/**
 * A visão geral.
 *
 * Primeiro virou gráfico, e ficou parada: números certos, sem nenhum sinal
 * de que alguma coisa estava acontecendo. Agora ela mostra o movimento além
 * do estado — o ritmo de estudo dia a dia, a sequência de dias seguidos, o
 * que mudou por último e quem está esperando você — e se mexe: os números
 * contam até o valor, as barras crescem ao aparecer, e tudo se atualiza
 * sozinho a cada minuto e quando você volta para a aba.
 *
 * Os últimos números ficam guardados neste navegador. A página abre já
 * preenchida com eles e troca pelos novos quando chegam, em vez de mostrar
 * "buscando…" toda vez.
 *
 * As cores vêm de variáveis de tema; nenhum gráfico tem cor escrita à mão.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bell, BookOpen, CalendarClock, Flame, RefreshCw, UserPlus, Video } from "lucide-react";
import { WeekAhead } from "./WeekAhead";
import { type RouteSignals } from "@/lib/week-ahead";
import { CHAVE, resumoParaOHub } from "@/lib/relatorio";
import { avisarSePermitido, limparTitulo, marcarTitulo, pedirPermissao, podeOferecer, textoDoAviso } from "@/lib/aviso-titulo";
import {
  acontecimentos,
  aulasNosUltimos,
  diaLocal,
  haQuanto,
  numerosDeCursos,
  ordenarCursos,
  porEtapa,
  ultimosDias,
  type Acontecimento,
  type CursoNoPainel,
  type Estudo,
  type Pedido,
  type VideoNoPainel,
} from "@/lib/painel";
import { useI18n } from "./I18n";

type Task = { id: string; title: string; project_slug: string | null; completed: boolean };
type View = "overview" | "relatorio" | "site" | "videos" | "sat" | "university" | "cursos" | "jade" | "approvals";

type Painel = {
  cursos: CursoNoPainel[] | null;
  estudo: Estudo | null;
  videos: (VideoNoPainel & { atualizadoEm?: string })[] | null;
  pedidos: Pedido[] | null;
  lidoEm: string;
};

const CHAVE_PAINEL = "artx-painel";
const A_CADA = 60_000;
const porcento = (fracao: number) => `${Math.round(fracao * 100)}%`;

function painelGuardado(): Painel | null {
  try {
    const bruto = localStorage.getItem(CHAVE_PAINEL);
    return bruto ? (JSON.parse(bruto) as Painel) : null;
  } catch {
    return null;
  }
}

/** "Bom dia" até meio-dia, "boa tarde" até as seis, "boa noite" depois. */
function saudacao(hora: number): string {
  if (hora < 5) return "Boa noite";
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export function PersonalDashboard({
  tasks,
  routeSignals,
  syncError,
  accessToken,
  nome,
  onOpen,
  onRetry,
}: {
  tasks: Task[];
  routeSignals: RouteSignals | null;
  syncError: string;
  accessToken: string | null;
  nome: string;
  onOpen: (view: View) => void;
  onRetry: () => void;
}) {
  const { t, locale } = useI18n();
  const [painel, setPainel] = useState<Painel | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [agora, setAgora] = useState(() => new Date());

  // Os números guardados aparecem na hora; os novos chegam por cima.
  useEffect(() => {
    queueMicrotask(() => setPainel((atual) => atual ?? painelGuardado()));
  }, []);

  const buscar = useCallback(() => {
    if (!accessToken) return;
    setBuscando(true);
    fetch("/api/painel", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error();
        const dados = (await resposta.json()) as Painel;
        setPainel(dados);
        setFalhou(false);
        try { localStorage.setItem(CHAVE_PAINEL, JSON.stringify(dados)); } catch { /* sem espaço: vale só nesta sessão */ }
      })
      .catch(() => setFalhou(true))
      .finally(() => setBuscando(false));
  }, [accessToken]);

  /* Vivo: busca ao abrir, a cada minuto, e quando a aba volta a ficar à
     vista — que é quando os números mais provavelmente mudaram. */
  useEffect(() => {
    if (!accessToken) return;
    queueMicrotask(buscar);
    const intervalo = window.setInterval(() => { if (document.visibilityState === "visible") buscar(); }, A_CADA);
    const aoVoltar = () => { if (document.visibilityState === "visible") buscar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [accessToken, buscar]);

  // O relógio da saudação e do "atualizado há".
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(new Date()), 15_000);
    return () => window.clearInterval(relogio);
  }, []);

  const cursos = useMemo(() => (painel?.cursos ? ordenarCursos(painel.cursos) : null), [painel]);
  const videos = painel?.videos ?? null;
  const estudo = painel?.estudo ?? null;
  const pedidos = painel?.pedidos ?? null;
  const numeros = cursos ? numerosDeCursos(cursos) : null;
  const emProducao = videos ? videos.filter((video) => video.etapa !== "POSTADO").length : null;
  const semana = estudo ? aulasNosUltimos(estudo.porDia, 7, agora) : null;
  const linha = useMemo(() => acontecimentos({ estudo, videos, pedidos }), [estudo, videos, pedidos]);
  const carregando = !painel && !falhou;
  const primeiroNome = (nome || "Kauã").split(" ")[0];

  return (
    <div className="overview-page painel painel-vivo page-enter">
      <header className="painel-topo">
        <div>
          <p className="eyebrow">{t("VISÃO GERAL")}</p>
          <h1>{t(saudacao(agora.getHours()))}, {primeiroNome}.</h1>
          <p className="painel-subtitulo">{t("Em que pé está cada coisa.")}</p>
        </div>
        <div className="painel-topo-acoes">
          <span className="day-label">
            {new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(agora)}
          </span>
          <button
            className={`painel-ao-vivo ${buscando ? "buscando" : ""} ${falhou ? "falhou" : ""}`}
            onClick={buscar}
            title={t("Atualizar agora")}
          >
            <i aria-hidden />
            {falhou ? t("Sem conexão") : painel ? `${t("atualizado")} ${haQuanto(painel.lidoEm, agora, t, locale)}` : t("Buscando…")}
            <RefreshCw size={13} aria-hidden />
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

      <section className="painel-numeros" aria-label={t("Resumo")}>
        <Numero icone={<BookOpen size={16} />} rotulo={t("Cursos em andamento")} valor={numeros?.emAndamento} onClick={() => onOpen("cursos")} ordem={0} />
        <Numero icone={<Flame size={16} />} rotulo={t("Aulas nos últimos 7 dias")} valor={semana} onClick={() => onOpen("cursos")} ordem={1} />
        <Numero icone={<Video size={16} />} rotulo={t("Vídeos em produção")} valor={emProducao} onClick={() => onOpen("videos")} ordem={2} />
        <Numero
          icone={<UserPlus size={16} />}
          rotulo={t("Pedidos esperando você")}
          valor={pedidos?.length}
          onClick={() => onOpen("approvals")}
          ordem={3}
          chamativo={Boolean(pedidos?.length)}
        />
      </section>

      <div className="painel-grade">
        <GraficoCursos cursos={cursos} carregando={carregando} onOpen={() => onOpen("cursos")} />
        <RitmoDeEstudo estudo={estudo} carregando={carregando} agora={agora} onOpen={() => onOpen("cursos")} />
        <GraficoVideos videos={videos} carregando={carregando} onOpen={() => onOpen("videos")} />
        <FunilDeProducao videos={videos} carregando={carregando} />
        <LinhaDoTempo itens={linha} carregando={carregando} agora={agora} onOpen={onOpen} />
        <GraficoAtividades tasks={tasks} onOpen={() => onOpen("jade")} />
      </div>

      <WeekAhead routes={routeSignals} tasks={tasks} onOpen={onOpen} />
    </div>
  );
}

// ── Peças ─────────────────────────────────────────────────────────────

/**
 * O número que conta até o valor.
 *
 * Conta a partir do valor anterior, e não do zero: quando a atualização traz
 * um número novo, ele sobe ou desce até lá — dá para ver que algo mudou.
 * Quem pediu menos movimento ao sistema vê o número direto.
 */
function useContagem(alvo: number | null | undefined, duracao = 700): number | null {
  const [valor, setValor] = useState<number | null>(alvo ?? null);
  const anterior = useRef<number | null>(alvo ?? null);

  useEffect(() => {
    if (alvo == null) return;
    const de = anterior.current ?? 0;
    anterior.current = alvo;
    const semMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (semMovimento || de === alvo) {
      queueMicrotask(() => setValor(alvo));
      return;
    }
    let quadro = 0;
    const inicio = performance.now();
    const passo = (instante: number) => {
      const p = Math.min(1, (instante - inicio) / duracao);
      const suave = 1 - Math.pow(1 - p, 3);
      setValor(Math.round(de + (alvo - de) * suave));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, duracao]);

  return alvo == null ? null : valor;
}

function Numero({ icone, rotulo, valor, onClick, ordem, chamativo = false }: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number | null | undefined;
  onClick: () => void;
  ordem: number;
  chamativo?: boolean;
}) {
  const mostrado = useContagem(valor);
  return (
    <button className={`painel-numero ${chamativo ? "chamativo" : ""}`} onClick={onClick} style={{ animationDelay: `${ordem * 60}ms` }}>
      <span className="painel-numero-icone" aria-hidden>{icone}</span>
      <strong>{mostrado ?? "—"}</strong>
      <span>{rotulo}</span>
    </button>
  );
}

/** Uma barra que cresce ao aparecer, do trilho vazio até o valor. */
function Medidor({ fracao, rotulo, atraso = 0 }: { fracao: number; rotulo: string; atraso?: number }) {
  const largura = Math.max(0, Math.min(1, fracao)) * 100;
  return (
    <span className="medidor" role="img" aria-label={rotulo}>
      <span className="medidor-trilho">
        <span className="medidor-cheio" style={{ width: `${largura}%`, animationDelay: `${atraso}ms` }} />
      </span>
    </span>
  );
}

function Cartao({ titulo, subtitulo, acao, children, numeros, ordem = 0, largo = false }: {
  titulo: string;
  subtitulo?: string;
  acao?: () => void;
  children: React.ReactNode;
  numeros?: React.ReactNode;
  ordem?: number;
  largo?: boolean;
}) {
  const { t } = useI18n();
  return (
    <article className={`painel-cartao ${largo ? "largo" : ""}`} style={{ animationDelay: `${120 + ordem * 70}ms` }}>
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

function Vazio({ children, acao }: { children: React.ReactNode; acao?: { rotulo: string; onClick: () => void } }) {
  return (
    <div className="painel-vazio">
      <p>{children}</p>
      {acao && <button onClick={acao.onClick}>{acao.rotulo}</button>}
    </div>
  );
}

// ── Cursos ────────────────────────────────────────────────────────────

function GraficoCursos({ cursos, carregando, onOpen }: { cursos: CursoNoPainel[] | null; carregando: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  const visiveis = cursos?.slice(0, 7) ?? [];
  const resto = cursos ? cursos.length - visiveis.length : 0;
  const n = cursos ? numerosDeCursos(cursos) : null;

  return (
    <Cartao
      ordem={0}
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
        : cursos.length === 0 ? (
          <Vazio acao={{ rotulo: t("Abrir os cursos"), onClick: onOpen }}>
            {t("Abra o sistema de cursos uma vez pelo Hub e o avanço de cada um aparece aqui.")}
          </Vazio>
        ) : (
          <ul className="painel-linhas">
            {visiveis.map((curso, i) => {
              const fracao = curso.feitas / curso.total;
              const rotulo = `${curso.titulo}: ${curso.feitas} ${t("de")} ${curso.total} ${t("aulas")} (${porcento(fracao)})`;
              return (
                <li key={curso.id} title={rotulo} className={curso.feitas === 0 ? "parado" : ""}>
                  <span className="painel-linha-nome">
                    {curso.titulo}
                    <small>{curso.feitas} {t("de")} {curso.total} {t("aulas")}</small>
                  </span>
                  <Medidor fracao={fracao} rotulo={rotulo} atraso={200 + i * 60} />
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

/**
 * O ritmo de estudo: quantas aulas em cada um dos últimos catorze dias.
 *
 * O dia vazio aparece vazio — um gráfico que pula as pausas esconde
 * justamente o que ele existe para mostrar. Hoje fica marcado, e a
 * sequência de dias seguidos vem em destaque, porque é ela que dá vontade
 * de não quebrar.
 */
function RitmoDeEstudo({ estudo, carregando, agora, onOpen }: { estudo: Estudo | null; carregando: boolean; agora: Date; onOpen: () => void }) {
  const { t, locale } = useI18n();
  const dias = estudo ? ultimosDias(estudo.porDia, 14, agora) : [];
  const maior = Math.max(1, ...dias.map((d) => d.aulas));
  const total = dias.reduce((soma, d) => soma + d.aulas, 0);
  const hoje = diaLocal(agora);

  return (
    <Cartao
      ordem={1}
      titulo={t("Ritmo de estudo")}
      subtitulo={estudo ? `${total} ${t(total === 1 ? "aula nas últimas duas semanas" : "aulas nas últimas duas semanas")}` : undefined}
      acao={onOpen}
      numeros={estudo && total > 0 && (
        <table>
          <thead><tr><th>{t("Dia")}</th><th>{t("Aulas")}</th></tr></thead>
          <tbody>{dias.filter((d) => d.aulas > 0).map((d) => <tr key={d.dia}><td>{new Date(`${d.dia}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}</td><td>{d.aulas}</td></tr>)}</tbody>
        </table>
      )}
    >
      {carregando ? <Vazio>{t("Buscando…")}</Vazio>
        : !estudo ? (
          <Vazio acao={{ rotulo: t("Abrir os cursos"), onClick: onOpen }}>
            {t("O ritmo aparece quando o sistema de cursos for aberto pelo Hub.")}
          </Vazio>
        ) : (
          <div className="ritmo">
            <div className={`ritmo-sequencia ${estudo.sequencia > 0 ? "acesa" : ""}`}>
              <Flame size={18} aria-hidden />
              <strong>{estudo.sequencia}</strong>
              <span>{t(estudo.sequencia === 1 ? "dia seguido" : "dias seguidos")}</span>
            </div>
            <div className="ritmo-colunas" role="img" aria-label={dias.map((d) => `${d.dia}: ${d.aulas}`).join(", ")}>
              {dias.map((d, i) => (
                <div key={d.dia} className={`ritmo-dia ${d.dia === hoje ? "hoje" : ""}`} title={`${new Date(`${d.dia}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}: ${d.aulas} ${t(d.aulas === 1 ? "aula" : "aulas")}`}>
                  <span className="ritmo-barra-area">
                    {d.aulas > 0 && <span className="ritmo-barra" style={{ height: `${(d.aulas / maior) * 100}%`, animationDelay: `${250 + i * 30}ms` }} />}
                  </span>
                  <span className="ritmo-rotulo">{new Date(`${d.dia}T12:00:00`).toLocaleDateString(locale, { weekday: "narrow" })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
    </Cartao>
  );
}

// ── Vídeos ────────────────────────────────────────────────────────────

function GraficoVideos({ videos, carregando, onOpen }: { videos: (VideoNoPainel & { atualizadoEm?: string })[] | null; carregando: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  /* Os publicados já não pedem nada; o que interessa é o que ainda está
     andando. Eles voltam a aparecer só se não houver nenhum em produção. */
  const andando = videos?.filter((video) => video.etapa !== "POSTADO") ?? [];
  const lista = (andando.length ? andando : videos ?? []).slice(0, 7);

  return (
    <Cartao
      ordem={2}
      titulo={t("Vídeos")}
      subtitulo={videos ? `${andando.length} ${t("em produção")}` : undefined}
      acao={onOpen}
      numeros={videos && videos.length > 0 && (
        <table>
          <thead><tr><th>{t("Vídeo")}</th><th>{t("Etapa")}</th><th>%</th></tr></thead>
          <tbody>{videos.map((v) => <tr key={v.id}><td>{t(v.titulo)}</td><td>{t(v.rotulo)}</td><td>{porcento(v.progresso)}</td></tr>)}</tbody>
        </table>
      )}
    >
      {carregando ? <Vazio>{t("Buscando…")}</Vazio>
        : videos === null ? <Vazio>{t("Não consegui ler os vídeos agora.")}</Vazio>
        : videos.length === 0 ? <Vazio acao={{ rotulo: t("Abrir o estúdio"), onClick: onOpen }}>{t("Nenhum vídeo ainda. O primeiro aparece aqui assim que for criado.")}</Vazio>
        : (
          <ul className="painel-linhas">
            {lista.map((video, i) => {
              const rotulo = `${t(video.titulo)}: ${t(video.rotulo)}, ${porcento(video.progresso)} ${t("do vídeo")}`;
              return (
                <li key={video.id} title={rotulo}>
                  <span className="painel-linha-nome">
                    {t(video.titulo)}
                    <small>{t(video.rotulo)}</small>
                  </span>
                  <Medidor fracao={video.progresso} rotulo={rotulo} atraso={200 + i * 60} />
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
 * reprovou a rampa, então ela não entrou.
 */
function FunilDeProducao({ videos, carregando }: { videos: VideoNoPainel[] | null; carregando: boolean }) {
  const { t } = useI18n();
  const etapas = videos ? porEtapa(videos) : [];
  const maior = Math.max(1, ...etapas.map((e) => e.total));

  return (
    <Cartao
      ordem={3}
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
            {etapas.map((etapa, i) => (
              <div key={etapa.etapa} className="funil-coluna" title={`${t(etapa.rotulo)}: ${etapa.total}`}>
                {/* O número mora em cima da própria coluna; etapa vazia não ganha
                    tracinho, porque um risco de 2px lê como "um pouco". */}
                <span className="funil-barra-area">
                  {etapa.total > 0 && <span className="funil-valor">{etapa.total}</span>}
                  {etapa.total > 0 && <span className="funil-barra" style={{ height: `${(etapa.total / maior) * 100}%`, animationDelay: `${250 + i * 45}ms` }} />}
                </span>
                <span className="funil-rotulo">{t(etapa.rotulo)}</span>
              </div>
            ))}
          </div>
        )}
    </Cartao>
  );
}

// ── O que está acontecendo ────────────────────────────────────────────

const ICONE_DO_ACONTECIMENTO: Record<Acontecimento["tipo"], React.ReactNode> = {
  aula: <BookOpen size={14} />,
  video: <Video size={14} />,
  pedido: <UserPlus size={14} />,
};

const DESTINO_DO_ACONTECIMENTO: Record<Acontecimento["tipo"], View> = { aula: "cursos", video: "videos", pedido: "approvals" };

function LinhaDoTempo({ itens, carregando, agora, onOpen }: { itens: Acontecimento[]; carregando: boolean; agora: Date; onOpen: (view: View) => void }) {
  const { t, locale } = useI18n();
  return (
    <Cartao ordem={4} titulo={t("Acontecendo")} subtitulo={t("O que mudou por último, em todos os sistemas")}>
      {carregando ? <Vazio>{t("Buscando…")}</Vazio>
        : itens.length === 0 ? <Vazio>{t("Quando uma aula for concluída, um vídeo andar ou alguém pedir acesso, aparece aqui.")}</Vazio>
        : (
          <ol className="linha-do-tempo">
            {itens.map((item, i) => (
              <li key={`${item.tipo}-${item.quando}-${i}`} style={{ animationDelay: `${200 + i * 50}ms` }}>
                <button onClick={() => onOpen(DESTINO_DO_ACONTECIMENTO[item.tipo])}>
                  <span className={`linha-do-tempo-icone ${item.tipo}`} aria-hidden>{ICONE_DO_ACONTECIMENTO[item.tipo]}</span>
                  <span className="linha-do-tempo-texto">
                    <strong>{item.tipo === "aula" && item.numero ? t("Aula {0} — {1}", [item.numero, item.aula]) : t(item.titulo)}</strong>
                    <small>
                      {item.tipo === "pedido"
                        ? `${t("pediu")} ${(item.sistemas ?? []).map((s) => t(s)).join(", ")}`
                        : item.tipo === "video"
                          ? `${t(item.etapa ?? "")} · ${porcento(item.progresso ?? 0)}`
                          : item.detalhe}
                    </small>
                  </span>
                  <time dateTime={item.quando}>{haQuanto(item.quando, agora, t, locale)}</time>
                </button>
              </li>
            ))}
          </ol>
        )}
    </Cartao>
  );
}

// ── Atividades ────────────────────────────────────────────────────────

function GraficoAtividades({ tasks, onOpen }: { tasks: Task[]; onOpen: () => void }) {
  const { t } = useI18n();
  const abertas = tasks.filter((task) => !task.completed);
  const feitas = tasks.length - abertas.length;
  const fracao = tasks.length ? feitas / tasks.length : 0;
  const mostrado = useContagem(tasks.length ? Math.round(fracao * 100) : null);

  return (
    <Cartao ordem={5} titulo={t("Atividades")} subtitulo={t("Criadas e concluídas pela Jade")} acao={onOpen}>
      {tasks.length === 0 ? <Vazio acao={{ rotulo: t("Falar com a Jade"), onClick: onOpen }}>{t("Nenhuma atividade ainda. Peça uma para a Jade.")}</Vazio> : (
        <div className="painel-meta">
          <strong>{mostrado ?? 0}%</strong>
          <Medidor fracao={fracao} rotulo={`${feitas} ${t("de")} ${tasks.length} ${t("atividades concluídas")}`} atraso={250} />
          <p>{feitas} {t("concluídas")} · {abertas.length} {t("em aberto")}</p>
          {abertas.length > 0 && (
            <ul className="painel-proximas">
              {abertas.slice(0, 3).map((task) => <li key={task.id}>{task.title}</li>)}
            </ul>
          )}
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
