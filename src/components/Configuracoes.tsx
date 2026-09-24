"use client";

/**
 * Configurações.
 *
 * A aba anterior se chamava Segurança e era um formulário de senha, só. Isto
 * reúne o que é seu: a conta, a aparência e os dados.
 *
 * Cada bloco salva sozinho e diz o que aconteceu. Um formulário único com um
 * botão "salvar tudo" faria uma falha de e-mail derrubar a troca de senha
 * junto, e ninguém saberia qual das duas passou.
 */

import { useEffect, useState } from "react";
import { AtSign, Check, Download, KeyRound, Languages, Palette, User } from "lucide-react";

import {
  acentos,
  aplicarAcento,
  guardarAcento,
  lerAcentoGuardado,
  validarEmail,
  validarNome,
  validarSenha,
  type Acento,
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
  onBackup,
}: {
  email: string;
  nome: string;
  salvar: Salvar;
  onBackup: () => void;
}) {
  const { language, setLanguage } = useI18n();

  const [acento, setAcento] = useState<Acento>(() => lerAcentoGuardado());
  useEffect(() => { aplicarAcento(acento); }, [acento]);

  function escolherCor(novo: Acento) {
    setAcento(novo);
    guardarAcento(novo);
  }

  return (
    <section className="config-page">
      <p className="eyebrow">CONTA E PREFERÊNCIAS</p>
      <h1>Configurações</h1>
      <p className="config-intro">
        Tudo o que é seu num lugar só. Cada bloco salva por conta própria — se um falhar, os outros não caem junto.
      </p>

      <div className="config-grid">
        {/* ── Conta ─────────────────────────────────────────────────── */}
        <Bloco icone={<User size={17} />} titulo="Nome de exibição" detalhe="Como você aparece no Hub.">
          <CampoUnico
            rotulo="Nome"
            valorInicial={nome}
            tipo="text"
            validar={validarNome}
            aoSalvar={salvar.nome}
            textoBotao="Salvar nome"
          />
        </Bloco>

        <Bloco
          icone={<AtSign size={17} />}
          titulo="E-mail da conta"
          detalhe="É por ele que você entra e recupera o acesso."
        >
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

        {/* ── Aparência ─────────────────────────────────────────────── */}
        <Bloco icone={<Palette size={17} />} titulo="Cor de destaque" detalhe="Botões, menu ativo e foco.">
          <div className="config-cores">
            {acentos.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`config-cor ${acento.id === item.id ? "escolhida" : ""}`}
                style={{ background: item.cor }}
                onClick={() => escolherCor(item)}
                aria-pressed={acento.id === item.id}
                aria-label={item.nome}
                title={item.nome}
              >
                {acento.id === item.id && <Check size={14} />}
              </button>
            ))}
          </div>
          <p className="config-nota">
            Cada cor foi escolhida medindo o contraste do texto branco por cima dela, não pelo tom. Todas passam do
            mínimo de leitura.
          </p>
        </Bloco>

        <Bloco icone={<Languages size={17} />} titulo="Idioma" detalhe="Vale neste navegador.">
          <div className="btn-grupo">
            <button
              type="button"
              className={`config-opcao ${language === "pt" ? "ativa" : ""}`}
              onClick={() => setLanguage("pt")}
              aria-pressed={language === "pt"}
            >
              Português
            </button>
            <button
              type="button"
              className={`config-opcao ${language === "en" ? "ativa" : ""}`}
              onClick={() => setLanguage("en")}
              aria-pressed={language === "en"}
            >
              English
            </button>
          </div>
        </Bloco>

        {/* ── Dados ─────────────────────────────────────────────────── */}
        <Bloco icone={<Download size={17} />} titulo="Seus dados" detalhe="Uma cópia para guardar fora daqui.">
          <button type="button" className="quick-create" onClick={onBackup}>
            <Download size={15} /> Exportar o Hub
          </button>
          <p className="config-nota">
            Leva atividades, notas e progresso de cursos. Os anexos do Relatório têm cópia própria na sua conta e
            botão de baixar em cada arquivo.
          </p>
        </Bloco>
      </div>

      {/*
        O tema claro não está aqui, e dizer por quê é melhor que deixar a pessoa
        procurando um interruptor que não existe.
      */}
      <p className="config-rodape">
        Tema claro ainda não: o CSS do Hub tem cerca de 500 cores escritas direto na regra contra 19 em variável, e um
        tema claro exigiria reescrever quase todas. Meio feito ficaria pior que não ter — texto escuro sobre caixa
        escura em metade das telas. É um trabalho próprio, e me peça quando quiser que eu encare.
      </p>
    </section>
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
  return (
    <article className="config-bloco">
      <header>
        <span className="config-icone">{icone}</span>
        <div>
          <strong>{titulo}</strong>
          <small>{detalhe}</small>
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
  const [valor, setValor] = useState(valorInicial);
  const [estado, setEstado] = useState("");
  const [salvando, setSalvando] = useState(false);

  // O valor de fora manda quando a sessão termina de carregar.
  useEffect(() => { setValor(valorInicial); }, [valorInicial]);

  const mudou = valor.trim() !== valorInicial.trim();

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const erro = validar(valor);
    if (erro) { setEstado(erro); return; }
    setSalvando(true);
    setEstado("");
    try {
      await aoSalvar(valor.trim());
      setEstado(aviso ?? "Salvo.");
    } catch (erro) {
      setEstado(erro instanceof Error ? erro.message : "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <label>
        {rotulo}
        <input type={tipo} value={valor} onChange={(evento) => setValor(evento.target.value)} disabled={salvando} />
      </label>
      <button type="submit" className="quick-create" disabled={salvando || !mudou}>
        {salvando ? "Salvando…" : textoBotao}
      </button>
      <p role="status" className="config-estado">{estado}</p>
    </form>
  );
}

function CampoSenha({ aoSalvar }: { aoSalvar: (valor: string) => Promise<void> }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [estado, setEstado] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const erro = validarSenha(senha, confirmacao);
    if (erro) { setEstado(erro); return; }
    setSalvando(true);
    setEstado("");
    try {
      await aoSalvar(senha);
      // A senha nova não fica no campo depois de salva.
      setSenha("");
      setConfirmacao("");
      setEstado("Senha alterada.");
    } catch (erro) {
      setEstado(erro instanceof Error ? erro.message : "Não consegui alterar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <label>
        Nova senha
        <input
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          disabled={salvando}
        />
      </label>
      <label>
        Confirmar
        <input
          type="password"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(evento) => setConfirmacao(evento.target.value)}
          disabled={salvando}
        />
      </label>
      <button type="submit" className="quick-create" disabled={salvando || !senha || !confirmacao}>
        {salvando ? "Alterando…" : "Salvar nova senha"}
      </button>
      <p role="status" className="config-estado">{estado}</p>
    </form>
  );
}
