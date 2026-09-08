'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

type RequestRow = { memberId: string; app: string; status: string; member: { username: string; createdAt: string } };
const labels: Record<string, string> = { hub: 'Hub', videos: 'Vídeos', study: 'Inglês', university: 'Universidades', pending: 'Pendente', approved: 'Aprovado', rejected: 'Recusado', revoked: 'Revogado' };

export function AccountApprovals({ token }: { token: string | null }) {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const accounts = useMemo(() => Object.values(rows.reduce<Record<string, { memberId: string; username: string; createdAt: string; grants: RequestRow[] }>>((result, row) => {
    result[row.memberId] ??= { memberId: row.memberId, username: row.member.username, createdAt: row.member.createdAt, grants: [] };
    result[row.memberId].grants.push(row);
    return result;
  }, {})).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [rows]);

  const request = useCallback(async (action: string, data: Record<string, string> = {}) => {
    if (!token) throw new Error('Entre na conta proprietária do Hub.');
    const response = await fetch('https://sistema-videos.vercel.app/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...data }), signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Falha ao consultar pedidos.');
    return result;
  }, [token]);

  const refresh = useCallback(async () => { setBusy(true); try { setRows(await request('admin-list')); setNotice(''); } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha de conexão.'); } finally { setBusy(false); } }, [request]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function decide(memberId: string, username: string, status: string) {
    if (!window.confirm(`${labels[status]} a conta de ${username} em todos os sistemas?`)) return;
    setBusy(true);
    try { await request('admin-decide-all', { memberId, status }); await refresh(); setNotice('Decisão salva. Cada conta continua com dados totalmente separados.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }

  return <section className="approval-page"><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Aprovação de contas</h1><p>Uma aprovação libera o Hub, Vídeos, Inglês e Universidades. Contas novas começam vazias e nunca enxergam seus dados.</p><button className="quick-create" disabled={busy} onClick={() => void refresh()}>Atualizar pedidos</button><p role="status" className="approval-notice">{busy ? 'Consultando…' : notice}</p>{!busy && !notice && !accounts.length && <p>Nenhum pedido por enquanto.</p>}<div className="approval-grid">{accounts.map(account => {
    const statuses = new Set(account.grants.map(grant => grant.status));
    const approved = statuses.size === 1 && statuses.has('approved');
    const pending = statuses.has('pending');
    return <article key={account.memberId}><div><span className={`approval-status ${approved ? 'approved' : pending ? 'pending' : ''}`}>{approved ? 'Aprovado' : pending ? 'Pendente' : labels[account.grants[0]?.status] ?? 'Bloqueado'}</span><h2>{account.username}</h2><p>{account.grants.map(grant => labels[grant.app] ?? grant.app).join(' · ')}</p></div><div className="approval-actions">{!approved && <button className="quick-create" disabled={busy} onClick={() => void decide(account.memberId, account.username, 'approved')}>Aprovar tudo</button>}{pending && <button className="command-trigger" disabled={busy} onClick={() => void decide(account.memberId, account.username, 'rejected')}>Recusar</button>}{approved && <button className="command-trigger" disabled={busy} onClick={() => void decide(account.memberId, account.username, 'revoked')}>Revogar acesso</button>}</div></article>;
  })}</div><p className="approval-footnote">Revogar encerra as sessões no servidor e impede novas leituras e gravações.</p></section>;
}
