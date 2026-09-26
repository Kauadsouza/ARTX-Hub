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
import { useI18n } from './I18n';

const apps: Array<{ key: AppKey; label: string }> = [
  { key: 'videos', label: 'Vídeos' },
  { key: 'study', label: 'Inglês' },
  { key: 'university', label: 'Universidades' },
  { key: 'cursos', label: 'Cursos' },
];

const nomeDoSistema = (key: AppKey) => apps.find((app) => app.key === key)?.label ?? key;

/** Os três grupos, na ordem em que pedem atenção. */
const GRUPOS: Array<{ estado: 'aguardando' | 'ativa' | 'bloqueada'; titulo: string }> = [
  { estado: 'aguardando', titulo: 'Aguardando você' },
  { estado: 'ativa', titulo: 'Com acesso' },
  { estado: 'bloqueada', titulo: 'Bloqueadas' },
];

/** Data curta, ou traço quando o valor não dá para ler. */
function formatarData(iso: string, locale = 'pt-BR'): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AccountApprovals({ token }: { token: string | null }) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<Concessao[]>([]);
  const [selections, setSelections] = useState<Selecoes>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const accounts = useMemo(() => agrupar(rows), [rows]);

  const request = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    if (!token) throw new Error(t('Entre na conta proprietária do Hub.'));
    // Mesma origem: o serviço de contas é do Hub.
    const response = await fetch('/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...data }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t('Falha ao consultar pedidos.'));
    return result;
  }, [token, t]);

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
      setNotice(error instanceof Error ? error.message : t('Falha de conexão.'));
    } finally {
      setBusy(false);
    }
  }, [request, t]);

  useEffect(() => { void refresh(); }, [refresh]);

  function toggle(accountKey: string, app: AppKey, checked: boolean) {
    setSelections(current => ({ ...current, [accountKey]: { ...current[accountKey], [app]: checked } }));
  }

  async function save(account: Conta) {
    const escolhidos = apps.filter(app => selections[account.key]?.[app.key]);
    const resumo = escolhidos.length ? escolhidos.map(app => t(app.label)).join(', ') : t('nenhum sistema');
    const estado = estadoDaConta(account);

    // O botão diz "Aprovar" ou "Desbloquear". Mandar seleção vazia dali faria o
    // contrário, então ele recusa em vez de pedir confirmação para o oposto.
    const permitido = podeAplicar(estado, escolhidos.length, t);
    if (!permitido.ok) {
      setNotice(permitido.motivo);
      return;
    }

    const desbloqueando = estado === 'bloqueada';
    // Salvar sem nada marcado revoga tudo. A confirmação precisa dizer isso: é
    // a mesma ação com um efeito oposto ao que o botão sugere.
    const pergunta = !escolhidos.length
      ? t('Nenhum sistema marcado. Isso vai retirar todos os acessos de {0}. Continuar?', [account.username])
      : desbloqueando
        ? t('Desbloquear a conta de {0} e liberar {1}?', [account.username, resumo])
        : t('Liberar {0} para {1}?', [resumo, account.username]);
    if (!window.confirm(pergunta)) return;

    setBusy(true);
    try {
      await Promise.all(idsDaConta(account).map(memberId =>
        request('admin-configure', { memberId, apps: escolhidos.map(app => app.key) })));
      await refresh();
      setNotice(desbloqueando
        ? t('Conta de {0} desbloqueada: {1}.', [account.username, resumo])
        : t('Acessos de {0} atualizados: {1}.', [account.username, resumo]));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
  }

  async function block(account: Conta) {
    if (!window.confirm(t('Bloquear completamente a conta de {0}?', [account.username]))) return;
    setBusy(true);
    try {
      await Promise.all(idsDaConta(account).map(memberId =>
        request('admin-decide-all', { memberId, status: 'revoked' })));
      await refresh();
      setNotice(t('Conta de {0} bloqueada.', [account.username]));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('Não foi possível bloquear.'));
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
    const regra = exclusaoDaConta(account, t);

    if (regra.confirmacao === 'digitar-nome') {
      const digitado = window.prompt(regra.aviso);
      if (digitado === null) return;
      if (digitado.trim().toLowerCase() !== account.username.trim().toLowerCase()) {
        setNotice(t('O nome não confere. Nada foi apagado.'));
        return;
      }
    } else if (!window.confirm(regra.aviso)) {
      return;
    }

    setBusy(true);
    try {
      await Promise.all(idsDaConta(account).map(memberId => request('admin-delete', { memberId })));
      await refresh();
      setNotice(t('Conta de {0} apagada.', [account.username]));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('Não foi possível apagar.'));
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
          <p className="eyebrow">{t("ADMINISTRAÇÃO")}</p>
          <h1>{t("Aprovação de contas")}</h1>
          <p>{t("Quem pede acesso a um sistema aparece aqui. Aprovar um sistema não dá acesso a este painel.")}</p>
        </div>
        <button className="aprovacao-atualizar" disabled={busy} onClick={() => void refresh()}>
          {busy ? t("Salvando…") : t("Atualizar")}
        </button>
      </header>

      {notice && <p role="status" className="aprovacao-recado">{notice}</p>}
      {!busy && !notice && !accounts.length && <p className="aprovacao-vazio">{t("Nenhum pedido por enquanto.")}</p>}

      {GRUPOS.map(({ estado, titulo }) => {
        const contas = grupos[estado];
        if (!contas.length) return null;
        return (
          <section key={estado} className={`aprovacao-grupo ${estado}`}>
            <h2>{t(titulo)} <span>{contas.length}</span></h2>
            <ul>
              {contas.map((account) => {
                const acoes = acoesDoEstado(estado);
                const aberto = aberta === account.key;
                const pedidos = sistemasPedidos(account);
                const liberados = apps.filter((app) => estadoDoSistema(account, app.key) === "liberado");
                const resumo =
                  estado === "aguardando"
                    ? `${t("pediu")} ${pedidos.map((key) => t(nomeDoSistema(key))).join(", ")}`
                    : liberados.length
                      ? liberados.map((app) => t(app.label)).join(" · ")
                      : t("sem nenhum sistema");
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
                            {resumo} · {formatarData(account.createdAt, locale)}
                          </small>
                        </span>
                      </button>

                      <div className="aprovacao-acoes">
                        {/* Pedido novo tem o botão à mão: aprovar é a decisão mais comum. */}
                        {estado === "aguardando" && !aberto && (
                          <button className="aprovacao-principal" disabled={busy} onClick={() => void save(account)}>
                            {t("Aprovar")}
                          </button>
                        )}
                        <button
                          className="aprovacao-mais"
                          onClick={() => setAberta(aberto ? null : account.key)}
                          aria-label={aberto ? t('Fechar {0}', [account.username]) : t('Detalhes de {0}', [account.username])}
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
                                  <strong>{t(app.label)}</strong>
                                  <small className={situacao}>{t(rotuloDoSistema[situacao])}</small>
                                </span>
                              </label>
                            );
                          })}
                        </div>

                        <p className="aprovacao-ficha">
                          {t("Pediu em")} {formatarData(account.createdAt, locale)}
                          {decididoEm(account) && <> · {t("última decisão em")} {formatarData(decididoEm(account)!, locale)}</>}
                          {" · "}
                          {t(marcados === 1 ? "{0} marcado" : "{0} marcados", [marcados])}
                        </p>

                        <div className="aprovacao-botoes">
                          <button className="aprovacao-principal" disabled={busy} onClick={() => void save(account)}>
                            {t(acoes.principal)}
                          </button>
                          {acoes.podeBloquear && (
                            <button className="aprovacao-secundario" disabled={busy} onClick={() => void block(account)}>
                              {t("Bloquear")}
                            </button>
                          )}
                          {/* Separado e sem preenchimento: bloquear tem volta, apagar não. */}
                          <button className="aprovacao-apagar" disabled={busy} onClick={() => void apagar(account)}>
                            {t("Apagar conta")}
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
