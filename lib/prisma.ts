import { PrismaClient } from "@prisma/client";

// Adicionar logs mais detalhados para debug no ambiente de produção
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: "query", emit: "event" },
      { level: "error", emit: "stdout" },
      { level: "info", emit: "stdout" },
      { level: "warn", emit: "stdout" },
    ],
  });
};

// Implementação recomendada para Next.js em ambientes serverless
// ver https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Adicionar listeners para os eventos de query para diagnóstico em produção
if (process.env.NODE_ENV === "production") {
  prisma.$on("query", (e) => {
    console.log("Prisma Query:", {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
      timestamp: new Date().toISOString(),
    });
  });
}
