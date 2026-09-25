import { PrismaClient } from "@prisma/client";

// Em dev o Next recarrega os módulos a cada edição; sem esse cache global cada
// hot-reload abre uma conexão nova e estoura o limite do banco.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
