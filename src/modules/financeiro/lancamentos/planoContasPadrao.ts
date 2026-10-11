import { prisma } from "@/lib/prisma";
import { GrupoDre } from "@prisma/client";

interface CategoriaPadrao {
  nome: string;
  grupoDre: GrupoDre;
  ordem: number;
}

/**
 * Lista fixa definida em PROMPT-CICLO-7-FINANCEIRO.md (seção "Plano de contas padrão").
 * A ordem aqui é a ordem de exibição padrão nas telas do financeiro.
 */
const PLANO_CONTAS_PADRAO: CategoriaPadrao[] = [
  { nome: "Receitas de vendas", grupoDre: GrupoDre.RECEITA_BRUTA, ordem: 10 },
  { nome: "Cancelamentos e devoluções", grupoDre: GrupoDre.DEDUCAO_RECEITA, ordem: 20 },
  { nome: "Descontos", grupoDre: GrupoDre.DEDUCAO_RECEITA, ordem: 30 },
  { nome: "Impostos sobre vendas (DAS/ICMS)", grupoDre: GrupoDre.IMPOSTO_VENDA, ordem: 40 },
  { nome: "Tarifas de marketplace", grupoDre: GrupoDre.CUSTO_VARIAVEL, ordem: 50 },
  { nome: "Frete de vendas", grupoDre: GrupoDre.CUSTO_VARIAVEL, ordem: 60 },
  { nome: "Publicidade marketplace", grupoDre: GrupoDre.CUSTO_VARIAVEL, ordem: 70 },
  { nome: "Armazenagem Full", grupoDre: GrupoDre.CUSTO_VARIAVEL, ordem: 80 },
  { nome: "Custo da mercadoria vendida", grupoDre: GrupoDre.CMV, ordem: 90 },
  // Não está na lista original da Fase 1 — adicionada na Fase 5 porque o
  // "gerar conta a pagar" de um PedidoCompra precisa de uma categoria que
  // nunca entra na DRE (o CMV já é reconhecido na venda, não na compra).
  { nome: "Compra de mercadoria (estoque)", grupoDre: GrupoDre.CMV, ordem: 95 },
  { nome: "Pessoal", grupoDre: GrupoDre.DESPESA_OPERACIONAL, ordem: 100 },
  { nome: "Ocupação", grupoDre: GrupoDre.DESPESA_OPERACIONAL, ordem: 110 },
  { nome: "Software e assinaturas", grupoDre: GrupoDre.DESPESA_OPERACIONAL, ordem: 120 },
  { nome: "Contabilidade e jurídico", grupoDre: GrupoDre.DESPESA_OPERACIONAL, ordem: 130 },
  { nome: "Marketing externo", grupoDre: GrupoDre.DESPESA_OPERACIONAL, ordem: 140 },
  { nome: "Embalagens e insumos", grupoDre: GrupoDre.DESPESA_OPERACIONAL, ordem: 150 },
  { nome: "Logística própria", grupoDre: GrupoDre.DESPESA_OPERACIONAL, ordem: 160 },
  { nome: "Administrativas", grupoDre: GrupoDre.DESPESA_OPERACIONAL, ordem: 170 },
  { nome: "Juros e tarifas financeiras", grupoDre: GrupoDre.RESULTADO_FINANCEIRO, ordem: 180 },
  { nome: "Rendimentos", grupoDre: GrupoDre.RESULTADO_FINANCEIRO, ordem: 190 },
  { nome: "Outras", grupoDre: GrupoDre.NAO_OPERACIONAL, ordem: 200 },
];

export interface ResultadoSeedPlanoContas {
  criadas: number;
  existentes: number;
}

/**
 * Idempotente: pode ser chamada em todo acesso à aba Financeiro sem duplicar
 * categorias. Só cria as que faltam (comparação por nome, sem pai, por conta).
 */
export async function seedPlanoContasPadrao(
  userId: string
): Promise<ResultadoSeedPlanoContas> {
  const existentesNoBanco = await prisma.categoriaFinanceira.findMany({
    where: { userId, paiId: null, nome: { in: PLANO_CONTAS_PADRAO.map((c) => c.nome) } },
    select: { nome: true },
  });
  const nomesExistentes = new Set(existentesNoBanco.map((c) => c.nome));

  const faltantes = PLANO_CONTAS_PADRAO.filter((c) => !nomesExistentes.has(c.nome));

  if (faltantes.length > 0) {
    await prisma.categoriaFinanceira.createMany({
      data: faltantes.map((categoria) => ({
        userId,
        nome: categoria.nome,
        grupoDre: categoria.grupoDre,
        ordem: categoria.ordem,
        sistema: true,
      })),
      skipDuplicates: true,
    });
  }

  return {
    criadas: faltantes.length,
    existentes: nomesExistentes.size,
  };
}
