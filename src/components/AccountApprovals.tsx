'use client';

/**
 * Aprovação de contas.
 *
 * A tela mentia. O estado das caixas vinha de um merge que preferia o valor
 * local ao do servidor (`current ?? servidor`), e como o local nunca é
 * `undefined` depois da primeira carga, o servidor deixava de ser ouvido para
 * sempre. Bloquear uma conta revogava tudo no banco e a tela continuava
 * mostrando "1 sistema selecionado".
 *
 * Agora recarregar traz a verdade. A regra e o agrupamento vivem em
 * `lib/aprovacoes.ts`, onde dá para testá-los sem montar a tela.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  acoesDoEstado,
  agrupar,
  agruparPorEstado,
  sistemasPedidos,
  contarSelecionados,
  decididoEm,
  estadoDaConta,
  exclusaoDaConta,
  podeAplicar,
  estadoDoSistema,
  idsDaConta,
  rotuloDoSistema,
  selecoesDoServidor,
  type AppKey,
  type Concessao,
  type Conta,
  type Selecoes,
} from '@/lib/aprovacoes';

const apps: Array<{ key: AppKey; label: string; detail: string }> = [
  { key: 'videos', label: 'Vídeos', detail: 'Ideias, roteiros e produção' },
  { key: 'study', label: 'Inglês', detail: 'Aulas, exercícios e progresso' },
  { key: 'university', label: 'Universidades', detail: 'Pesquisa e planejamento acadêmico' },
  { key: 'cursos', label: 'Cursos', detail: 'Catálogo, trilha e progresso' },
];

const nomeDoSistema = (key: AppKey) => apps.find((app) => app.key === key)?.label ?? key;

/** Os três grupos, na ordem em que pedem atenção. */
const GRUPOS: Array<{ estado: 'aguardando' | 'ativa' | 'bloqueada'; titulo: string }> = [
  { estado: 'aguardando', titulo: 'Aguardando você' },
  { estado: 'ativa', titulo: 'Com acesso' },
  { estado: 'bloqueada', titulo: 'Bloqueadas' },
];

/** Data curta, ou traço quando o valor não dá para ler. */
function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AccountApprovals({ token }: { token: string | null }) {
  const [rows, setRows] = useState<Concessao[]>([]);
  const [selections, setSelections] = useState<Selecoes>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const accounts = useMemo(() => agrupar(rows), [rows]);

  const request = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    if (!token) throw new Error('Entre na conta proprietária do Hub.');
    // Mesma origem: o serviço de contas é do Hub.
    const response = await fetch('/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...data }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Falha ao consultar pedidos.');
    return result;
  }, [token]);

  /**
   * Recarrega e assume a verdade do servidor.
   *
   * Não há caso em que isto rode enquanto a pessoa edita: acontece ao abrir a
   * tela, no botão de atualizar e depois de cada ação dela. Nos três, o que o
   * banco diz é o que vale.
   */
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const nextRows = await request('admin-list') as Concessao[];
      setRows(nextRows);
      setSelections(selecoesDoServidor(nextRows));
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha de conexão.');
    } finally {
      setBusy(false);
    }
  }, [request]);

  useEffect(() => { void refresh(); }, [refresh]);

  function toggle(accountKey: string, app: AppKey, checked: boolean) {
    setSelections(current => ({ ...current, [accountKey]: { ...current[accountKey], [app]: checked } }));
  }

  async function save(account: Conta) {
    const escolhidos = apps.filter(app => selections[account.key]?.[app.key]);
    const resumo = escolhidos.length ? escolhidos.map(app => app.label).join(', ') : 'nenhum sistema';
    const estado = estadoDaConta(account);

    // O botão diz "Aprovar" ou "Desbloquear". Mandar seleção vazia dali faria o
    // contrário, então ele recusa em vez de pedir confirmação para o oposto.
    const permitido = podeAplicar(estado, escolhidos.length);
    if (!permitido.ok) {
      setNotice(permitido.motivo);
      return;
    }

    const desbloqueando = estado === 'bloqueada';
    // Salvar sem nada marcado revoga tudo. A confirmação precisa dizer isso: é
    // a mesma ação com um efeito oposto ao que o botão sugere.
    const pergunta = !escolhidos.length
      ? `Nenhum sistema marcado. Isso vai retirar todos os acessos de ${account.username}. Continuar?`
      : desbloqueando
        ? `Desbloquear a conta de ${account.username} e liberar ${resumo}?`
        : `Liberar ${resumo} para ${account.username}?`;
    if (!window.confirm(pergunta)) return;

    setBusy(true);
    try {
      await Promise.all(idsDaConta(account).map(memberId =>
        request('admin-configure', { memberId, apps: escolhidos.map(app => app.key) })));
      await refresh();
      setNotice(desbloqueando
        ? `Conta de ${account.username} desbloqueada: ${resumo}.`
        : `Acessos de ${account.username} atualizados: ${resumo}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function block(account: Conta) {
    if (!window.confirm(`Bloquear completamente a conta de ${account.username}?`)) return;
    setBusy(true);
    try {
      await Promise.all(idsDaConta(account).map(memberId =>
        request('admin-decide-all', { memberId, status: 'revoked' })));
      await refresh();
      setNotice(`Conta de ${account.username} bloqueada.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível bloquear.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Apagar de vez.
   *
   * Bloquear deixa a conta lá, sem acesso, e dá para voltar atrás. Isto não
   * volta: leva a conta, os acessos e tudo o que a pessoa guardou. Por isso a
   * confirmação depende do que se perde — uma conta que nunca foi aprovada
   * não guardou nada, e pedir cerimônia para remover um pedido de teste só
   * faz o dono parar de limpar a lista.
   */
  async function apagar(account: Conta) {
    const regra = exclusaoDaConta(account);

    if (regra.confirmacao === 'digitar-nome') {
      const digitado = window.prompt(regra.aviso);
      if (digitado === null) return;
      if (digitado.trim().toLowerCase() !== account.username.trim().toLowerCase()) {
        setNotice('O nome não confere. Nada foi apagado.');
        return;
      }
    } else if (!window.confirm(regra.aviso)) {
      return;
    }

    setBusy(true);
    try {
      await Promise.all(idsDaConta(account).map(memberId => request('admin-delete', { memberId })));
      await refresh();
      setNotice(`Conta de ${account.username} apagada.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível apagar.');
    } finally {
      setBusy(false);
    }
  }

  const grupos = agruparPorEstado(accounts);

  /* A conta aberta mostra as caixas dos sistemas. As outras ficam numa linha
     só: com várias contas, uma parede de cartões iguais escondia o pedido
     novo no meio das contas já resolvidas. */
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <section className="aprovacao">
      <header className="aprovacao-topo">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1>Aprovação de contas</h1>
          <p>Quem pede acesso a um sistema aparece aqui. Aprovar um sistema não dá acesso a este painel.</p>
        </div>
        <button className="aprovacao-atualizar" disabled={busy} onClick={() => void refresh()}>
          {busy ? "Salvando…" : "Atualizar"}
        </button>
      </header>

      {notice && <p role="status" className="aprovacao-recado">{notice}</p>}
      {!busy && !notice && !accounts.length && <p className="aprovacao-vazio">Nenhum pedido por enquanto.</p>}

      {GRUPOS.map(({ estado, titulo }) => {
        const contas = grupos[estado];
        if (!contas.length) return null;
        return (
          <section key={estado} className={`aprovacao-grupo ${estado}`}>
            <h2>{titulo} <span>{contas.length}</span></h2>
            <ul>
              {contas.map((account) => {
                const acoes = acoesDoEstado(estado);
                const aberto = aberta === account.key;
                const pedidos = sistemasPedidos(account);
                const liberados = apps.filter((app) => estadoDoSistema(account, app.key) === "liberado");
                const resumo =
                  estado === "aguardando"
                    ? `pediu ${pedidos.map(nomeDoSistema).join(", ")}`
                    : liberados.length
                      ? liberados.map((app) => app.label).join(" · ")
                      : "sem nenhum sistema";
                const marcados = contarSelecionados(selections, account.key);

                return (
                  <li key={account.key} className={`aprovacao-conta ${aberto ? "aberta" : ""}`}>
                    <div className="aprovacao-linha">
                      <button
                        className="aprovacao-quem"
                        onClick={() => setAberta(aberto ? null : account.key)}
                        aria-expanded={aberto}
                      >
                        <span className="aprovacao-inicial" aria-hidden>
                          {account.username.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="aprovacao-nome">
                          <strong>{account.username}</strong>
                          <small>
                            {resumo} · {formatarData(account.createdAt)}
                          </small>
                        </span>
                      </button>

                      <div className="aprovacao-acoes">
                        {/* Pedido novo tem o botão à mão: aprovar é a decisão mais comum. */}
                        {estado === "aguardando" && !aberto && (
                          <button className="aprovacao-principal" disabled={busy} onClick={() => void save(account)}>
                            Aprovar
                          </button>
                        )}
                        <button
                          className="aprovacao-mais"
                          onClick={() => setAberta(aberto ? null : account.key)}
                          aria-label={aberto ? `Fechar ${account.username}` : `Detalhes de ${account.username}`}
                        >
                          {aberto ? "−" : "···"}
                        </button>
                      </div>
                    </div>

                    {aberto && (
                      <div className="aprovacao-detalhe">
                        <div className="aprovacao-sistemas">
                          {apps.map((app) => {
                            const marcado = Boolean(selections[account.key]?.[app.key]);
                            const situacao = estadoDoSistema(account, app.key);
                            return (
                              <label key={app.key} className={`aprovacao-sistema ${marcado ? "marcado" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  disabled={busy}
                                  onChange={(evento) => toggle(account.key, app.key, evento.target.checked)}
                                />
                                <span>
                                  <strong>{app.label}</strong>
                                  <small className={situacao}>{rotuloDoSistema[situacao]}</small>
                                </span>
                              </label>
                            );
                          })}
                        </div>

                        <p className="aprovacao-ficha">
                          Pediu em {formatarData(account.createdAt)}
                          {decididoEm(account) && <> · última decisão em {formatarData(decididoEm(account)!)}</>}
                          {" · "}
                          {marcados} marcado{marcados === 1 ? "" : "s"}
                        </p>

                        <div className="aprovacao-botoes">
                          <button className="aprovacao-principal" disabled={busy} onClick={() => void save(account)}>
                            {acoes.principal}
                          </button>
                          {acoes.podeBloquear && (
                            <button className="aprovacao-secundario" disabled={busy} onClick={() => void block(account)}>
                              Bloquear
                            </button>
                          )}
                          {/* Separado e sem preenchimento: bloquear tem volta, apagar não. */}
                          <button className="aprovacao-apagar" disabled={busy} onClick={() => void apagar(account)}>
                            Apagar conta
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
