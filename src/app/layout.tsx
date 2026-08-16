import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./condor.css";

const basePath = process.env.CONDOR_LOCAL_BUILD === "1" ? "/hub" : "";

export const metadata: Metadata = {
  title: "ARTX Hub",
  description: "O centro pessoal de projetos do Kauã.",
  manifest: `${basePath}/manifest.webmanifest`,
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  appleWebApp: { capable: true, title: "ARTX Hub", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0b1020", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
