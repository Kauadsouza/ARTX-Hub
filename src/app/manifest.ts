import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.CONDOR_LOCAL_BUILD === "1" ? "/hub" : "";
  return {
    name: "ARTX Hub",
    short_name: "ARTX Hub",
    description: "Centro pessoal de projetos, ideias e progresso.",
    start_url: `${basePath}/`,
    display: "standalone",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    icons: [{ src: `${basePath}/icon.svg`, sizes: "any", type: "image/svg+xml" }],
  };
}
