import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { calcularReposicaoConta, SugestaoReposicao } from "@/services/reposicaoService";

/**
 * POST /api/replenishment/gerar-pedidos
 * Agrupa as sugestões de compra (reposicaoService, Ciclo 6 Fase 7) por
 * fornecedor principal e cria um rascunho de PedidoCompra (status
 * "pendente") por fornecedor. Itens sem fornecedor principal são
 * ignorados e reportados em itensIgnoradosSemFornecedor.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "PEDIDOS_COMPRA_EDITAR");

    const { sugestoes } = await calcularReposicaoConta(user.contaId);

    const precisaComprar = sugestoes.filter(
      (s) => s.quantidadeSugeridaCompraUnidades > 0
    );
    const candidatos = precisaComprar.filter((s) => s.fornecedorPrincipalId);
    const itensIgnoradosSemFornecedor =
      precisaComprar.length - candidatos.length;

    if (candidatos.length === 0) {
      return NextResponse.json({
        pedidosCriados: 0,
        itensIgnoradosSemFornecedor,
        pedidos: [],
      });
    }

    const produtoFornecedores = await prisma.produtoFornecedor.findMany({
      where: {
        produtoId: { in: candidatos.map((c) => c.produtoId) },
        principal: true,
      },
      select: {
        produtoId: true,
        preco: true,
        precoUnitario: true,
        multiplicador: true,
      },
    });
    const precoPorProduto = new Map(
      produtoFornecedores.map((pf) => [pf.produtoId, pf])
    );

    const porFornecedor = new Map<string, SugestaoReposicao[]>();
    for (const candidato of candidatos) {
      const lista = porFornecedor.get(candidato.fornecedorPrincipalId!) ?? [];
      lista.push(candidato);
      porFornecedor.set(candidato.fornecedorPrincipalId!, lista);
    }

    const pedidosCriados: Array<{
      id: number;
      fornecedorId: string;
      fornecedorNome: string | null;
      itens: number;
    }> = [];

    for (const [fornecedorId, itens] of porFornecedor) {
      const pedido = await prisma.pedidoCompra.create({
        data: {
          userId: user.contaId,
          fornecedorId,
          status: "pendente",
          comentarios:
            "Rascunho gerado automaticamente pela sugestão de reposição.",
          produtos: {
            create: itens.map((item) => {
              const fornecedorProduto = precoPorProduto.get(item.produtoId);
              const multiplicador = Math.max(
                1,
                Math.round(fornecedorProduto?.multiplicador ?? 1)
              );
              const custoPorCaixa = fornecedorProduto?.precoUnitario
                ? Math.round(fornecedorProduto.precoUnitario * multiplicador)
                : fornecedorProduto?.preco ?? item.custoMedio ?? 0;

              return {
                produtoId: item.produtoId,
                quantidade: Math.max(1, item.quantidadeSugeridaCompraCaixas),
                custo: Math.max(0, Math.round(custoPorCaixa)),
                multiplicador,
              };
            }),
          },
        },
        select: { id: true, fornecedorId: true },
      });

      pedidosCriados.push({
        id: pedido.id,
        fornecedorId: pedido.fornecedorId,
        fornecedorNome: itens[0].fornecedorPrincipalNome,
        itens: itens.length,
      });
    }

    return NextResponse.json({
      pedidosCriados: pedidosCriados.length,
      itensIgnoradosSemFornecedor,
      pedidos: pedidosCriados,
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("[GERAR_PEDIDOS] Erro ao gerar pedidos de compra:", error);
    return NextResponse.json(
      { error: "Erro ao gerar pedidos de compra" },
      { status: 500 }
    );
  }
}
