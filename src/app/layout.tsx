import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARTX Hub",
  description: "O centro pessoal de projetos do Kauã.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ARTX Hub", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0b1020", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
