import { instrucoesDeAcao } from "../../../lib/jade-acoes.ts";

const SYSTEM_PROMPT = "Você é a Jade, a inteligência do ARTX Hub. Ajuda o proprietário a melhorar e organizar o próprio Hub: sugerir ajustes de produto, priorizar o que construir a seguir, explicar como usar os sistemas (Vídeos, Cursos, Universidades, Relatório) e apontar problemas de UX. Você não tem acesso a arquivos do computador dele. Responda em português, de forma direta e prática.";

/**
 * As instruções de ação só vão quando o painel pede.
 *
 * A aba da Jade é conversa; o painel do canto é onde ela age. Mandar o formato
 * dos comandos nas duas faria a aba produzir blocos que ninguém executa — e a
 * pessoa leria um JSON solto no meio da resposta.
 */
const PROMPT_COM_ACOES = `${SYSTEM_PROMPT}

${instrucoesDeAcao}`;

const MAX_BODY_BYTES = 8_192;
const MAX_MESSAGES = 20;

type ChatMessage = { role: "user" | "assistant"; content: string };

async function readBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty_body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("too_large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (message.role === "user" || message.role === "assistant")
    && typeof message.content === "string"
    && message.content.length > 0
    && message.content.length <= 4_000;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin not allowed." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "JSON required." }, { status: 415 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "not_configured", message: "O assistente ainda não foi configurado. Adicione ANTHROPIC_API_KEY nas variáveis de ambiente do projeto." }, { status: 503 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Hub não configurado." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch {
    return Response.json({ error: "Solicitação inválida." }, { status: 400 });
  }
  const { accessToken, messages, comAcoes } = (body ?? {}) as { accessToken?: unknown; messages?: unknown; comAcoes?: unknown };
  if (typeof accessToken !== "string" || accessToken.length > 8192) {
    return Response.json({ error: "Entre na sua conta para usar o assistente." }, { status: 401 });
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES || !messages.every(isChatMessage)) {
    return Response.json({ error: "Mensagem inválida." }, { status: 400 });
  }

  let userResponse: Response;
  try {
    userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return Response.json({ error: "Autenticação indisponível no momento." }, { status: 503 });
  }
  if (!userResponse.ok) {
    return Response.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
  }

  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: comAcoes === true ? PROMPT_COM_ACOES : SYSTEM_PROMPT,
        messages: messages as ChatMessage[],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return Response.json({ error: "O assistente está indisponível no momento." }, { status: 503 });
  }
  if (!anthropicResponse.ok) {
    return Response.json({ error: "O assistente não conseguiu responder agora." }, { status: 502 });
  }

  const data = await anthropicResponse.json() as { content?: Array<{ type: string; text?: string }> };
  const reply = data.content?.find((block) => block.type === "text")?.text ?? "";
  return Response.json({ reply }, { headers: { "Cache-Control": "no-store" } });
}
