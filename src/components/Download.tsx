"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, ShieldCheck } from "lucide-react";

import { useI18n } from "./I18n";

/** A página de download do aplicativo, no idioma escolhido no Hub. */
export function Download() {
  const { t } = useI18n();
  return <main className="download-page">
    <nav><Link href="/" className="brand"><img className="brand-logo" src="/brand/artx-hub.svg" alt="" /><strong>ARTX Hub</strong></Link><Link href="/">{t("Abrir o Hub")} <ArrowUpRight size={16} /></Link></nav>
    <section className="download-hero">
      <p className="eyebrow">{t("SEU ESPAÇO, TAMBÉM NO COMPUTADOR")}</p>
      <h1>{t("O mesmo Hub.")}<br />{t("Uma janela só sua.")}</h1>
      <p>{t("Seu canal, seus estudos e seus planos. Instale o aplicativo e entre com a mesma conta que você usa no site.")}</p>
      <a className="primary download-action" href="https://github.com/Kauadsouza/ARTX-Hub/releases/latest"><ArrowDownToLine size={19} /> {t("Baixar para Windows")}</a>
      <small>{t("Windows 10 ou 11 · 64 bits · Conexão com a internet")}</small>
    </section>
    <section className="download-grid" aria-label={t("Como funciona")}>
      <article><span>01</span><h2>{t("Baixe e instale")}</h2><p>{t("Na página oficial do GitHub, escolha o arquivo")} <strong>ARTX-Hub-Setup</strong> {t("com a extensão")} <strong>.exe</strong>{t(". O instalador cria o atalho no computador.")}</p></article>
      <article><span>02</span><h2>{t("Entre na sua conta")}</h2><p>{t("Use seu login atual. Instalar o aplicativo não libera acesso às contas de outras pessoas. Novas contas continuam sujeitas à aprovação.")}</p></article>
      <article><span>03</span><h2>{t("Continue de onde parou")}</h2><p>{t("Os dados sincronizados com sua conta ficam disponíveis no site e no aplicativo. Confira o estado de sincronização em cada sistema antes de trocar de computador.")}</p></article>
    </section>
    <section className="download-note"><ShieldCheck size={24} /><div><h2>{t("Seu acesso continua privado")}</h2><p>{t("O instalador é público; seus dados exigem autenticação. Ele não contém suas senhas ou seus arquivos.")}</p><p>{t("Esta versão ainda não possui assinatura digital de editor. Confira a origem e os arquivos de verificação no GitHub. Você também pode continuar usando o site.")}</p></div></section>
    <footer><Link href="/">{t("Voltar ao Hub")}</Link><a href="https://github.com/Kauadsouza/ARTX-Hub/blob/main/docs/RECOVERY.md">{t("Recuperar acesso em outro PC")} <ArrowUpRight size={14} /></a></footer>
  </main>;
}
