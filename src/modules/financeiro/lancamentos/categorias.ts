import { GrupoDre } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { seedPlanoContasPadrao } from "./planoContasPadrao";

export async function listarCategorias(userId: string, incluirInativas = false) {
  await seedPlanoContasPadrao(userId);
  return prisma.categoriaFinanceira.findMany({
    where: { userId, ...(incluirInativas ? {} : { ativo: true }) },
    orderBy: { ordem: "asc" },
  });
}

export interface DadosCategoria {
  nome: string;
  grupoDre: GrupoDre;
  paiId?: string | null;
  ordem?: number;
}

export async function criarCategoria(userId: string, dados: DadosCategoria) {
  return prisma.categoriaFinanceira.create({
    data: {
      userId,
      nome: dados.nome,
      grupoDre: dados.grupoDre,
      paiId: dados.paiId ?? null,
      ordem: dados.ordem ?? 0,
      sistema: false,
    },
  });
}

export class CategoriaNaoEncontradaError extends Error {
  constructor() {
    super("Categoria não encontrada");
    this.name = "CategoriaNaoEncontradaError";
  }
}

export class CategoriaSistemaNaoPodeSerExcluidaError extends Error {
  constructor() {
    super("Categorias do sistema não podem ser excluídas, só desativadas");
    this.name = "CategoriaSistemaNaoPodeSerExcluidaError";
  }
}

export async function atualizarCategoria(
  userId: string,
  id: string,
  dados: Partial<Pick<DadosCategoria, "nome" | "ordem">> & { ativo?: boolean }
) {
  const categoria = await prisma.categoriaFinanceira.findFirst({ where: { id, userId } });
  if (!categoria) throw new CategoriaNaoEncontradaError();
  return prisma.categoriaFinanceira.update({ where: { id }, data: dados });
}

export async function excluirCategoria(userId: string, id: string): Promise<void> {
  const categoria = await prisma.categoriaFinanceira.findFirst({ where: { id, userId } });
  if (!categoria) throw new CategoriaNaoEncontradaError();
  if (categoria.sistema) throw new CategoriaSistemaNaoPodeSerExcluidaError();
  await prisma.categoriaFinanceira.delete({ where: { id } });
}
