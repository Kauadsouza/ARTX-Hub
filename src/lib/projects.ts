import { BrainCircuit, Film, Globe2, GraduationCap, type LucideIcon } from "lucide-react";

export type Project = {
  slug: "site" | "videos" | "sat" | "condor";
  name: string;
  description: string;
  status: string;
  color: string;
  icon: LucideIcon;
  url?: string;
  mode: "external" | "overview";
};

export const projects: Project[] = [
  {
    slug: "site",
    name: "KauaArtx Site",
    description: "Sua presença pública, blog e jornada documentada.",
    status: "Em evolução",
    color: "green",
    icon: Globe2,
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://kauaartx.vercel.app",
    mode: "external",
  },
  {
    slug: "videos",
    name: "Sistema de Vídeos",
    description: "Ideias, roteiros, gravação, edição e publicação.",
    status: "Projeto principal",
    color: "violet",
    icon: Film,
    url: process.env.NEXT_PUBLIC_VIDEOS_URL,
    mode: "external",
  },
  {
    slug: "sat",
    name: "SAT & Inglês",
    description: "Simulados adaptativos e rotina de preparação.",
    status: "Em estudo",
    color: "blue",
    icon: GraduationCap,
    url: process.env.NEXT_PUBLIC_SAT_URL,
    mode: "external",
  },
  {
    slug: "condor",
    name: "Condor",
    description: "Seu assistente local e centro de automações no PC.",
    status: "Local no PC",
    color: "orange",
    icon: BrainCircuit,
    mode: "overview",
  },
];

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}
