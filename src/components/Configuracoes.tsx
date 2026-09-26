"use client";

/**
 * O perfil.
 *
 * Era "Configurações": um formulário de nome, e-mail e senha, uma cor de
 * destaque e um botão de exportar. Virou o lugar de quem você é no Hub —
 * foto, nome, conta — e de como ele se parece para você.
 *
 * O tema substitui a cor de destaque, e não por gosto: a cor trocava só o
 * roxo dos botões, e o tema troca o Hub inteiro. As duas coisas juntas nem
 * funcionariam — a cor era aplicada como estilo direto no <html> e passaria
 * por cima de qualquer tema.
 *
 * Exportar saiu a pedido. Cada bloco continua salvando sozinho: um formulário
 * único faria uma falha de e-mail derrubar a troca de senha junto.
 */

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AtSign, Camera, Check, KeyRound, Languages, Palette, User } from "lucide-react";

import { enviarAvatar, removerAvatar } from "@/lib/avatar";
import {
  aplicarTema,
  guardarTema,
  lerTemaGuardado,
  temas,
  validarEmail,
  validarNome,
  validarSenha,
  type Tema,
} from "@/lib/preferencias";
import { useI18n } from "./I18n";

type Salvar = {
  nome: (valor: string) => Promise<void>;
  email: (valor: string) => Promise<void>;
  senha: (valor: string) => Promise<void>;
};

export function Configuracoes({
  email,
  nome,
  salvar,
  supabase,
  avatar,
  onAvatar,
  onTema,
}: {
  email: string;
  nome: string;
  salvar: Salvar;
  supabase: SupabaseClient | null;
  avatar: string | null;
  onAvatar: (dataUrl: string | null) => void;
  /** Leva a escolha para a conta, para ela valer em qualquer aparelho. */
  onTema: (id: string) => void;
}) {
  const { t, language, setLanguage } = useI18n();
  const [tema, setTema] = useState<Tema>(() => lerTemaGuardado());

  function escolherTema(novo: Tema) {
    setTema(novo);
    aplicarTema(novo);
    guardarTema(novo);
    onTema(novo.id);
  }

  return (
    <section className="perfil">
      <FotoDePerfil nome={nome} email={email} supabase={supabase} avatar={avatar} onAvatar={onAvatar} />

      {/* ── Tema ─────────────────────────────────────────────────────── */}
      <Bloco icone={<Palette size={17} />} titulo="Tema" detalhe="Muda o Hub inteiro e fica salvo na sua conta, em qualquer aparelho.">
        <div className="perfil-temas" role="radiogroup" aria-label={t("Tema")}>
          {temas.map((item) => {
            const escolhido = tema.id === item.id;
            const [fundo, superficie, acento] = item.amostra;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={escolhido}
                className={`perfil-tema ${escolhido ? "escolhido" : ""}`}
                onClick={() => escolherTema(item)}
              >
                {/* Uma miniatura do próprio Hub naquele tema, e não uma bolinha
                    de cor: dá para ver como fica antes de escolher. */}
                <span className="perfil-tema-miniatura" style={{ background: fundo }} aria-hidden>
                  <span className="perfil-tema-lateral" style={{ background: superficie }} />
                  <span className="perfil-tema-cartao" style={{ background: superficie }}>
                    <span style={{ background: acento }} />
                  </span>
                </span>
                <span className="perfil-tema-texto">
                  <strong>{t(item.nome)}</strong>
                  <small>{t(item.descricao)}</small>
                </span>
                {escolhido && <Check className="perfil-tema-marca" size={15} />}
              </button>
            );
          })}
        </div>
      </Bloco>

      <div className="perfil-grade">
        {/* ── Conta ───────────────────────────────────────────────────── */}
        <Bloco icone={<User size={17} />} titulo="Nome de exibição" detalhe="Como você aparece no Hub.">
          <CampoUnico rotulo="Nome" valorInicial={nome} tipo="text" validar={validarNome} aoSalvar={salvar.nome} textoBotao="Salvar nome" />
        </Bloco>

        <Bloco icone={<AtSign size={17} />} titulo="E-mail da conta" detalhe="É por ele que você entra e recupera o acesso.">
          <CampoUnico
            rotulo="E-mail"
            valorInicial={email}
            tipo="email"
            validar={validarEmail}
            aoSalvar={salvar.email}
            textoBotao="Trocar e-mail"
            aviso="A troca só vale depois que você confirmar pelo link que chega no endereço novo."
          />
        </Bloco>

        <Bloco icone={<KeyRound size={17} />} titulo="Senha" detalhe="Mínimo de oito caracteres.">
          <CampoSenha aoSalvar={salvar.senha} />
        </Bloco>

        <Bloco icone={<Languages size={17} />} titulo="Idioma" detalhe="Fica salvo na sua conta, em qualquer aparelho.">
          <div className="btn-grupo">
            <button type="button" className={`config-opcao ${language === "pt" ? "ativa" : ""}`} onClick={() => setLanguage("pt")} aria-pressed={language === "pt"}>
              Português
            </button>
            <button type="button" className={`config-opcao ${language === "en" ? "ativa" : ""}`} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>
              English
            </button>
          </div>
        </Bloco>
      </div>
    </section>
  );
}

/**
 * A foto, o nome e o e-mail no topo — o que o perfil é, antes do que se
 * configura nele.
 */
function FotoDePerfil({
  nome,
  email,
  supabase,
  avatar,
  onAvatar,
}: {
  nome: string;
  email: string;
  supabase: SupabaseClient | null;
  avatar: string | null;
  onAvatar: (dataUrl: string | null) => void;
}) {
  const { t } = useI18n();
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState("");
  const inicial = (nome || email || "?").trim().slice(0, 1).toUpperCase();

  async function trocar(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    setOcupado(true);
    setRecado("");
    try {
      onAvatar(await enviarAvatar(supabase, arquivo));
      setRecado(t("Foto atualizada."));
    } catch (erro) {
      setRecado(erro instanceof Error ? t(erro.message) : t("Não consegui trocar a foto."));
    } finally {
      setOcupado(false);
    }
  }

  async function tirar() {
    if (!window.confirm(t("Tirar a foto de perfil?"))) return;
    setOcupado(true);
    setRecado("");
    try {
      await removerAvatar(supabase);
      onAvatar(null);
      setRecado(t("Foto removida."));
    } catch (erro) {
      setRecado(erro instanceof Error ? t(erro.message) : t("Não consegui tirar a foto."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <header className="perfil-topo">
      <button
        type="button"
        className="perfil-foto"
        onClick={() => entrada.current?.click()}
        disabled={ocupado}
        aria-label={avatar ? t("Trocar a foto de perfil") : t("Colocar uma foto de perfil")}
      >
        {avatar ? (
          <img src={avatar} alt="" />
        ) : (
          <span className="perfil-inicial" aria-hidden>{inicial}</span>
        )}
        <span className="perfil-foto-camera" aria-hidden><Camera size={15} /></span>
      </button>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={(evento) => void trocar(evento)} />

      <div className="perfil-quem">
        <p className="eyebrow">{t("PERFIL")}</p>
        <h1>{nome || t("Seu perfil")}</h1>
        <p>{email}</p>
        <div className="perfil-foto-acoes">
          <button type="button" onClick={() => entrada.current?.click()} disabled={ocupado}>
            {ocupado ? t("Enviando…") : avatar ? t("Trocar foto") : t("Colocar foto")}
          </button>
          {avatar && (
            <button type="button" className="perfil-tirar" onClick={() => void tirar()} disabled={ocupado}>
              {t("Tirar")}
            </button>
          )}
        </div>
        {recado && <p role="status" className="perfil-recado">{recado}</p>}
      </div>
    </header>
  );
}

function Bloco({
  icone,
  titulo,
  detalhe,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  detalhe: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <article className="config-bloco">
      <header>
        <span className="config-icone">{icone}</span>
        <div>
          <strong>{t(titulo)}</strong>
          <small>{t(detalhe)}</small>
        </div>
      </header>
      {children}
    </article>
  );
}

/**
 * Um campo, uma validação, um botão.
 *
 * O botão só acorda quando o valor muda: salvar o que já está salvo gasta uma
 * ida ao servidor e devolve um "pronto" que não quer dizer nada.
 */
function CampoUnico({
  rotulo,
  valorInicial,
  tipo,
  validar,
  aoSalvar,
  textoBotao,
  aviso,
}: {
  rotulo: string;
  valorInicial: string;
  tipo: "text" | "email";
  validar: (valor: string) => string | null;
  aoSalvar: (valor: string) => Promise<void>;
  textoBotao: string;
  aviso?: string;
}) {
  const { t } = useI18n();
  const [valor, setValor] = useState(valorInicial);
  const [estado, setEstado] = useState("");
  const [salvando, setSalvando] = useState(false);

  // O valor de fora manda quando a sessão termina de carregar.
  useEffect(() => { setValor(valorInicial); }, [valorInicial]);

  const mudou = valor.trim() !== valorInicial.trim();

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const erro = validar(valor);
    if (erro) { setEstado(t(erro)); return; }
    setSalvando(true);
    setEstado("");
    try {
      await aoSalvar(valor.trim());
      setEstado(t(aviso ?? "Salvo."));
    } catch (erro) {
      setEstado(erro instanceof Error ? t(erro.message) : t("Não consegui salvar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <label>
        {t(rotulo)}
        <input type={tipo} value={valor} onChange={(evento) => setValor(evento.target.value)} disabled={salvando} />
      </label>
      <button type="submit" className="quick-create" disabled={salvando || !mudou}>
        {salvando ? t("Salvando…") : t(textoBotao)}
      </button>
      <p role="status" className="config-estado">{estado}</p>
    </form>
  );
}

function CampoSenha({ aoSalvar }: { aoSalvar: (valor: string) => Promise<void> }) {
  const { t } = useI18n();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [estado, setEstado] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const erro = validarSenha(senha, confirmacao);
    if (erro) { setEstado(t(erro)); return; }
    setSalvando(true);
    setEstado("");
    try {
      await aoSalvar(senha);
      // A senha nova não fica no campo depois de salva.
      setSenha("");
      setConfirmacao("");
      setEstado(t("Senha alterada."));
    } catch (erro) {
      setEstado(erro instanceof Error ? t(erro.message) : t("Não consegui alterar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <label>
        {t("Nova senha")}
        <input
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          disabled={salvando}
        />
      </label>
      <label>
        {t("Confirmar")}
        <input
          type="password"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(evento) => setConfirmacao(evento.target.value)}
          disabled={salvando}
        />
      </label>
      <button type="submit" className="quick-create" disabled={salvando || !senha || !confirmacao}>
        {salvando ? t("Alterando…") : t("Salvar nova senha")}
      </button>
      <p role="status" className="config-estado">{estado}</p>
    </form>
  );
}
