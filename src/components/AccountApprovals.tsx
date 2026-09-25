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
  contarSelecionados,
  decididoEm,
  estadoDaConta,
  estadoDoSistema,
  idsDaConta,
  rotuloDoEstado,
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
    const response = await fetch('https://sistema-videos.vercel.app/api/members', {
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
    const desbloqueando = estadoDaConta(account) === 'bloqueada';
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

  return (
    <section className="approval-page">
      <p className="eyebrow">ADMINISTRAÇÃO</p>
      <h1>Aprovação de contas</h1>
      <p>
        As pessoas criam conta dentro do sistema que querem usar. Aqui você decide quem entra em quê — e o Hub
        continua só seu: aprovar um sistema não dá acesso a este painel.
      </p>

      <button className="quick-create" disabled={busy} onClick={() => void refresh()}>Atualizar pedidos</button>
      <p role="status" className="approval-notice">{busy ? 'Salvando…' : notice}</p>
      {!busy && !notice && !accounts.length && <p>Nenhum pedido por enquanto.</p>}

      <div className="approval-grid">
        {accounts.map(account => {
          const estado = estadoDaConta(account);
          const acoes = acoesDoEstado(estado);
          const marcados = contarSelecionados(selections, account.key);

          return (
            <article key={account.key} className={`approval-account ${estado}`}>
              <header>
                <div>
                  <span className={`approval-status ${estado}`}>{rotuloDoEstado[estado]}</span>
                  <h2>{account.username}</h2>
                  <p>
                    {marcados
                      ? `${marcados} sistema${marcados > 1 ? 's' : ''} liberado${marcados > 1 ? 's' : ''}`
                      : 'Escolha o que esta pessoa poderá acessar'}
                  </p>

                  {/* O que a pessoa pediu, e quando — o dono decide melhor sabendo disso. */}
                  <dl className="approval-ficha">
                    <div>
                      <dt>Pediu em</dt>
                      <dd>{formatarData(account.createdAt)}</dd>
                    </div>
                    {decididoEm(account) && (
                      <div>
                        <dt>Última decisão</dt>
                        <dd>{formatarData(decididoEm(account)!)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Pedidos</dt>
                      <dd>{account.grants.filter(g => g.app !== 'hub').length}</dd>
                    </div>
                  </dl>
                </div>
              </header>

              <div className="approval-apps">
                {apps.map(app => {
                  const checked = Boolean(selections[account.key]?.[app.key]);
                  return (
                    <label key={app.key} className={checked ? 'selected' : ''}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={event => toggle(account.key, app.key, event.target.checked)}
                      />
                      <span>
                        <strong>{app.label}</strong>
                        <small>{app.detail}</small>
                        <em className={`approval-sistema ${estadoDoSistema(account, app.key)}`}>
                          {rotuloDoSistema[estadoDoSistema(account, app.key)]}
                        </em>
                      </span>
                      <i aria-hidden="true">{checked ? '✓' : ''}</i>
                    </label>
                  );
                })}
              </div>

              {/*
                Só o que faz sentido no estado.

                Antes havia "Bloquear conta" numa conta já bloqueada — um botão
                que pedia confirmação para não fazer nada — e a ação de
                desbloquear se chamava "Aprovar conta", o que ninguém liga a
                desbloquear.
              */}
              <div className="approval-actions">
                <button className="quick-create" disabled={busy} onClick={() => void save(account)}>
                  {acoes.principal}
                </button>
                {acoes.podeBloquear && (
                  <button className="command-trigger" disabled={busy} onClick={() => void block(account)}>
                    Bloquear conta
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="approval-footnote">
        Aprovar um sistema não cria conta no Hub. Os sistemas não selecionados permanecem bloqueados, os dados
        continuam separados, e a pessoa vê a sua decisão ao entrar no sistema que pediu.
      </p>
    </section>
  );
}
