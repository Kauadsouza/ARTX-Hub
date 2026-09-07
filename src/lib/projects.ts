import { BrainCircuit, Film, Globe2, GraduationCap, type LucideIcon } from "lucide-react";

export type Project = {
  slug: "site" | "videos" | "sat" | "university" | "condor";
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
    name: "Site KauaArtx",
    description: "Sua presença pública, blog e jornada documentada.",
    status: "Em evolução",
    color: "green",
    icon: Globe2,
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://kauaartx.vercel.app",
    mode: "external",
  },
  {
    slug: "videos",
    name: "KauaArtx Video Studio",
    description: "Ideias, roteiros, gravação, edição e publicação.",
    status: "Projeto principal",
    color: "violet",
    icon: Film,
    url: process.env.NEXT_PUBLIC_VIDEOS_URL,
    mode: "external",
  },
  {
    slug: "sat",
    name: "SAT & English Learning",
    description: "Cursos gratuitos, conversação e preparação SAT, ACT e TOEFL.",
    status: "Em estudo",
    color: "blue",
    icon: GraduationCap,
    url: process.env.NEXT_PUBLIC_SAT_URL,
    mode: "external",
  },
  {
    slug: "university",
    name: "University Path",
    description: "Quiz e roteiro de candidatura ao Reino Unido, adaptados à sua formação.",
    status: "Novo projeto",
    color: "green",
    icon: GraduationCap,
    url: "https://university-path-six.vercel.app",
    mode: "external",
  },
  {
    slug: "condor",
    name: "Condor AI",
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
