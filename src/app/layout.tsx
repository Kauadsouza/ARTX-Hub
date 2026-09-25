import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./jade.css";
import { I18nProvider } from "@/components/I18n";
import { scriptDoTema } from "@/lib/preferencias";

const basePath = process.env.HUB_LOCAL_BUILD === "1" ? "/hub" : "";

export const metadata: Metadata = {
  title: "ARTX Hub",
  description: "O centro pessoal de projetos do Kauã.",
  manifest: `${basePath}/manifest.webmanifest`,
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  appleWebApp: { capable: true, title: "ARTX Hub", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // `suppressHydrationWarning` só no <html>: o script abaixo escreve o tema nele
    // antes do React chegar, e a diferença é proposital, não um erro.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Antes de qualquer pintura, senão o tema claro abre com um clarão escuro. */}
        <script dangerouslySetInnerHTML={{ __html: scriptDoTema }} />
      </head>
      <body><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
