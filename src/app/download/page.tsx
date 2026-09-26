import { Download } from "@/components/Download";

export const metadata = {
  title: "Baixar para Windows · ARTX Hub",
  description: "Instale o ARTX Hub no Windows e acesse o mesmo espaço privado do site com sua conta.",
};

// O conteúdo mora num componente de cliente para seguir o idioma escolhido no
// Hub; a página fica no servidor só para declarar o título.
export default function DownloadPage() {
  return <Download />;
}
