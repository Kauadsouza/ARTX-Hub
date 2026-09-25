import "server-only";
import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "./prisma.ts";

/**
 * Contas, senhas e sessões das pessoas.
 *
 * Isto morava dentro do sistema de vídeos, e todos os outros sistemas batiam lá
 * para deixar alguém entrar. Além de amarrar sistemas que não têm nada a ver um
 * com o outro, fazia o sistema de vídeos virar ponto único de falha: um deploy
 * dele e ninguém entrava em lugar nenhum.
 *
 * O Hub é o lugar certo porque já é o único ponto que centraliza — é aqui que o
 * dono aprova quem entra em quê. Cada sistema fala só com o Hub; nenhum fala
 * com outro.
 */

const scrypt = promisify(derive);

/** Todos os sistemas, incluindo o próprio Hub. */
export const SISTEMAS = ["hub", "videos", "study", "university", "cursos"] as const;

/** Os que uma pessoa pode pedir. O Hub não entra: ele é só do dono. */
export const SISTEMAS_DE_PESSOA = ["videos", "study", "university", "cursos"] as const;

export type Sistema = (typeof SISTEMAS)[number];

export function sistema(valor: unknown): Sistema {
  if (!SISTEMAS.includes(valor as Sistema)) throw new Error("Aplicativo inválido.");
  return valor as Sistema;
}

export function digest(valor: string) {
  return createHash("sha256").update(valor).digest("hex");
}

export async function hashPassword(senha: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(senha, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function matchesPassword(senha: string, guardada: string) {
  const [salt, hash] = guardada.split(":");
  const atual = (await scrypt(senha, salt, 64)) as Buffer;
  const esperado = Buffer.from(hash, "hex");
  // Comparação de tempo constante: comparar com === vaza o tamanho do acerto.
  return atual.length === esperado.length && timingSafeEqual(atual, esperado);
}

/** Tentativas por janela de 15 minutos, para senha não ser adivinhada na força. */
export async function throttle(chave: string, max = 12) {
  const balde = `${chave}:${Math.floor(Date.now() / 900000)}`;
  const linha = await prisma.accessThrottle.upsert({
    where: { key: balde },
    create: { key: balde, expiresAt: new Date(Date.now() + 900000) },
    update: { attempts: { increment: 1 } },
  });
  if (linha.attempts > max) throw new Error("Muitas tentativas. Aguarde 15 minutos.");
}

export async function issueMemberSession(principal: string, app: Sistema) {
  const token = randomBytes(32).toString("hex");
  await prisma.memberSession.create({
    data: { digest: digest(token), principal, app, expiresAt: new Date(Date.now() + 86400000) },
  });
  return token;
}

/**
 * Quem é o dono deste token, para este sistema.
 *
 * A permissão é conferida a cada pedido, não só no login: o acesso pode ter
 * sido revogado enquanto a pessoa estava com a tela aberta.
 */
export async function memberIdentity(token: string | undefined, app: Sistema) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Error("Entre na sua conta.");
  const sessao = await prisma.memberSession.findUnique({ where: { digest: digest(token) } });
  if (!sessao || sessao.app !== app || sessao.expiresAt.getTime() <= Date.now()) {
    throw new Error("Sessão expirada. Entre novamente.");
  }
  if (sessao.principal !== "owner") {
    const grant = await prisma.memberGrant.findUnique({
      where: { memberId_app: { memberId: sessao.principal, app } },
    });
    if (grant?.status !== "approved") throw new Error("Acesso pendente ou revogado.");
  }
  return sessao.principal;
}

/**
 * Só o dono administra.
 *
 * A identidade vem da sessão Supabase do Hub, conferida contra o e-mail
 * configurado — não contra algo que o navegador mandou dizendo quem é.
 */
export async function requireHubOwner(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.HUB_ALLOWED_EMAIL?.trim().toLowerCase();
  if (!url || !key || !email || !token || token.length > 8192) {
    throw new Error("Acesso administrativo indisponível.");
  }
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Sessão administrativa inválida.");
  const user = await res.json();
  if (!user.id || user.email?.toLowerCase() !== email) {
    throw new Error("Apenas o proprietário pode administrar contas.");
  }
  return user.id as string;
}
