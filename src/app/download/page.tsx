import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Baixar para Windows · ARTX Hub",
  description: "Instale o ARTX Hub no Windows e acesse o mesmo espaço privado do site com sua conta.",
};

export default function DownloadPage() {
  return <main className="download-page">
    <nav><Link href="/" className="brand"><img className="brand-logo" src="/brand/artx-hub.svg" alt="" /><strong>ARTX Hub</strong></Link><Link href="/">Abrir o Hub <ArrowUpRight size={16} /></Link></nav>
    <section className="download-hero">
      <p className="eyebrow">SEU ESPAÇO, TAMBÉM NO COMPUTADOR</p>
      <h1>O mesmo Hub.<br />Uma janela só sua.</h1>
      <p>Seu canal, seus estudos e seus planos. Instale o aplicativo e entre com a mesma conta que você usa no site.</p>
      <a className="primary download-action" href="https://github.com/Kauadsouza/ARTX-Hub/releases/latest"><ArrowDownToLine size={19} /> Baixar para Windows</a>
      <small>Windows 10 ou 11 · 64 bits · Conexão com a internet</small>
    </section>
    <section className="download-grid" aria-label="Como funciona">
      <article><span>01</span><h2>Baixe e instale</h2><p>Na página oficial do GitHub, escolha o arquivo <strong>ARTX-Hub-Setup</strong> com a extensão <strong>.exe</strong>. O instalador cria o atalho no computador.</p></article>
      <article><span>02</span><h2>Entre na sua conta</h2><p>Use seu login atual. Instalar o aplicativo não libera acesso às contas de outras pessoas. Novas contas continuam sujeitas à aprovação.</p></article>
      <article><span>03</span><h2>Continue de onde parou</h2><p>Os dados sincronizados com sua conta ficam disponíveis no site e no aplicativo. Confira o estado de sincronização em cada sistema antes de trocar de computador.</p></article>
    </section>
    <section className="download-note"><ShieldCheck size={24} /><div><h2>Seu acesso continua privado</h2><p>O instalador é público; seus dados exigem autenticação. Ele não contém suas senhas ou seus arquivos.</p><p>Esta versão ainda não possui assinatura digital de editor. Confira a origem e os arquivos de verificação no GitHub. Você também pode continuar usando o site.</p></div></section>
    <footer><Link href="/">Voltar ao Hub</Link><a href="https://github.com/Kauadsouza/ARTX-Hub/blob/main/docs/RECOVERY.md">Recuperar acesso em outro PC <ArrowUpRight size={14} /></a></footer>
  </main>;
}
