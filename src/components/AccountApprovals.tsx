'use client';
import { useCallback, useEffect, useState } from 'react';
type RequestRow = { memberId: string; app: string; status: string; member: { username: string; createdAt: string } };
const labels: Record<string, string> = { videos: 'Vídeos', study: 'Inglês', university: 'Universidades', pending: 'Pendente', approved: 'Aprovado', rejected: 'Recusado', revoked: 'Revogado' };
export function AccountApprovals({ token }: { token: string | null }) {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useCallback(async (action: string, data: Record<string, string> = {}) => {
    if (!token) throw new Error('Entre na conta proprietária do Hub.');
    const response = await fetch('https://sistema-videos.vercel.app/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...data }), signal: AbortSignal.timeout(20000) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Falha ao consultar pedidos.'); return result;
  }, [token]);
  const refresh = useCallback(async () => { setBusy(true); try { setRows(await request('admin-list')); setNotice(''); } catch (e) { setNotice(e instanceof Error ? e.message : 'Falha de conexão.'); } finally { setBusy(false); } }, [request]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function decide(row: RequestRow, status: string) {
    if (!window.confirm(`${labels[status]} acesso de ${row.member.username} a ${labels[row.app]}?`)) return;
    setBusy(true); try { await request('admin-decide', { memberId: row.memberId, app: row.app, status }); await refresh(); setNotice('Decisão salva. Nenhum dado seu foi compartilhado.'); } catch(e) { setNotice(e instanceof Error ? e.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  return <section style={{ padding: 'clamp(20px,4vw,48px)', maxWidth: 1100 }}><h1 style={{ fontSize: 30 }}>Aprovação de contas</h1><p style={{ marginBlock: 16 }}>Você libera cada sistema separadamente. Contas novas começam vazias.</p><button className="quick-create" disabled={busy} onClick={() => void refresh()}>Atualizar pedidos</button><p role="status" style={{ marginBlock: 16 }}>{busy ? 'Consultando…' : notice}</p>{!busy && !notice && !rows.length && <p>Nenhum pedido por enquanto.</p>}<div style={{ display: 'grid', gap: 14 }}>{rows.map(row => <article key={`${row.memberId}:${row.app}`} style={{ border:'1px solid var(--border)', borderRadius: 16, padding:20, display:'flex', flexWrap:'wrap', gap:16, alignItems:'center' }}><div style={{ flex:1 }}><h2>{row.member.username}</h2><p>{labels[row.app]} · {labels[row.status]}</p></div>{row.status !== 'approved' && <button className="quick-create" disabled={busy} onClick={() => void decide(row, 'approved')}>Aprovar</button>}{row.status === 'pending' && <button className="command-trigger" disabled={busy} onClick={() => void decide(row, 'rejected')}>Recusar</button>}{row.status === 'approved' && <button className="command-trigger" disabled={busy} onClick={() => void decide(row, 'revoked')}>Revogar</button>}</article>)}</div><p style={{ marginTop:24 }}>Revogar bloqueia novas leituras e gravações no servidor. Dados já exportados pelo próprio usuário não podem ser recolhidos.</p></section>;
}
