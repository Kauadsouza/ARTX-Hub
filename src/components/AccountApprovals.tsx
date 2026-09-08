'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

type AppKey = 'videos' | 'study' | 'university';
type RequestRow = { memberId: string; app: 'hub' | AppKey; status: string; updatedAt?: string; member: { username: string; createdAt: string } };
type AccountGroup = { key: string; username: string; createdAt: string; grants: RequestRow[] };

const apps: Array<{ key: AppKey; label: string; detail: string }> = [
  { key: 'videos', label: 'Vídeos', detail: 'Ideias, roteiros e produção' },
  { key: 'study', label: 'Inglês', detail: 'Aulas, exercícios e progresso' },
  { key: 'university', label: 'Universidades', detail: 'Pesquisa e planejamento acadêmico' },
];

export function AccountApprovals({ token }: { token: string | null }) {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [selections, setSelections] = useState<Record<string, Partial<Record<AppKey, boolean>>>>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const accounts = useMemo(() => Object.values(rows.reduce<Record<string, AccountGroup>>((result, row) => {
    const key = row.member.username.trim().toLowerCase();
    result[key] ??= { key, username: row.member.username, createdAt: row.member.createdAt, grants: [] };
    result[key].grants.push(row);
    return result;
  }, {})).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [rows]);

  const request = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    if (!token) throw new Error('Entre na conta proprietária do Hub.');
    const response = await fetch('https://sistema-videos.vercel.app/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...data }), signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Falha ao consultar pedidos.');
    return result;
  }, [token]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const nextRows = await request('admin-list') as RequestRow[];
      setRows(nextRows);
      setSelections(current => {
        const next = { ...current };
        for (const row of nextRows) {
          const key = row.member.username.trim().toLowerCase();
          if (row.app !== 'hub') next[key] = { ...next[key], [row.app]: current[key]?.[row.app] ?? row.status === 'approved' };
        }
        return next;
      });
      setNotice('');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha de conexão.'); }
    finally { setBusy(false); }
  }, [request]);
  useEffect(() => { void refresh(); }, [refresh]);

  function toggle(accountKey: string, app: AppKey, checked: boolean) {
    setSelections(current => ({ ...current, [accountKey]: { ...current[accountKey], [app]: checked } }));
  }

  async function save(account: AccountGroup) {
    const selected = apps.filter(app => selections[account.key]?.[app.key]).map(app => app.label);
    const summary = selected.length ? selected.join(', ') : 'somente o Hub';
    if (!window.confirm(`Liberar ${summary} para ${account.username}?`)) return;
    setBusy(true);
    try {
      const memberIds = [...new Set(account.grants.map(grant => grant.memberId))];
      await Promise.all(memberIds.map(memberId => request('admin-configure', { memberId, apps: apps.filter(app => selections[account.key]?.[app.key]).map(app => app.key) })));
      await refresh();
      setNotice(`Acessos de ${account.username} atualizados: ${summary}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }

  async function block(account: AccountGroup) {
    if (!window.confirm(`Bloquear completamente a conta de ${account.username}?`)) return;
    setBusy(true);
    try {
      await Promise.all([...new Set(account.grants.map(grant => grant.memberId))].map(memberId => request('admin-decide-all', { memberId, status: 'revoked' })));
      await refresh();
      setNotice(`Conta de ${account.username} bloqueada.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível bloquear.'); }
    finally { setBusy(false); }
  }

  return <section className="approval-page"><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Aprovação de contas</h1><p>Cada pessoa aparece uma única vez. Escolha os sistemas permitidos e confirme em um só botão.</p><button className="quick-create" disabled={busy} onClick={() => void refresh()}>Atualizar pedidos</button><p role="status" className="approval-notice">{busy ? 'Salvando…' : notice}</p>{!busy && !notice && !accounts.length && <p>Nenhum pedido por enquanto.</p>}<div className="approval-grid">{accounts.map(account => {
    const hubStatus = account.grants.find(grant => grant.app === 'hub')?.status;
    const enabledCount = apps.filter(app => selections[account.key]?.[app.key]).length;
    return <article key={account.key} className="approval-account"><header><div><span className={`approval-status ${hubStatus === 'approved' ? 'approved' : hubStatus === 'pending' ? 'pending' : ''}`}>{hubStatus === 'approved' ? 'Conta ativa' : hubStatus === 'pending' ? 'Aguardando você' : 'Conta bloqueada'}</span><h2>{account.username}</h2><p>{enabledCount ? `${enabledCount} sistema${enabledCount > 1 ? 's' : ''} selecionado${enabledCount > 1 ? 's' : ''}` : 'Escolha o que esta pessoa poderá acessar'}</p></div></header><div className="approval-apps">{apps.map(app => {
      const grant = account.grants.find(item => item.app === app.key);
      const checked = Boolean(selections[account.key]?.[app.key]);
      return <label key={app.key} className={checked ? 'selected' : ''}><input type="checkbox" checked={checked} disabled={busy || !grant} onChange={event => toggle(account.key, app.key, event.target.checked)} /><span><strong>{app.label}</strong><small>{app.detail}</small></span><i aria-hidden="true">{checked ? '✓' : ''}</i></label>;
    })}</div><div className="approval-actions"><button className="quick-create" disabled={busy} onClick={() => void save(account)}>{hubStatus === 'approved' ? 'Salvar acessos' : 'Aprovar conta'}</button><button className="command-trigger" disabled={busy} onClick={() => void block(account)}>Bloquear conta</button></div></article>;
  })}</div><p className="approval-footnote">A conta sempre entra pelo Hub. Os sistemas não selecionados permanecem bloqueados e os dados continuam separados.</p></section>;
}
