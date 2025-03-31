import { verifyUser } from "@/helpers/verifyUser";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    console.log("[estoque-seguranca] Iniciando requisição");
    const user = await verifyUser(request);
    console.log("[estoque-seguranca] Usuário verificado:", user.id);

    // Otimizar consulta para limitar os campos retornados
    const produtosCriticos = await prisma.estoque.findMany({
      where: {
        armazem: { userId: user.id },
        quantidade: { lte: prisma.estoque.fields.estoqueSeguranca },
      },
      select: {
        quantidade: true,
        estoqueSeguranca: true,
        produto: {
          select: {
            id: true,
            nome: true,
            sku: true,
          },
        },
        armazem: {
          select: {
            nome: true,
          },
        },
      },
      take: 50, // Limitar para melhorar performance
    });

    const queryTime = Date.now() - startTime;
    console.log(
      `[estoque-seguranca] Consulta concluída em ${queryTime}ms, produtos críticos encontrados: ${produtosCriticos.length}`
    );

    const response = produtosCriticos.map((item) => ({
      id: item.produto.id,
      nome: item.produto.nome,
      sku: item.produto.sku,
      quantidade: item.quantidade,
      estoqueSeguranca: item.estoqueSeguranca ?? 0,
      armazem: item.armazem.nome,
    }));

    console.log(
      `[estoque-seguranca] Respondendo com ${
        response.length
      } produtos críticos (tempo total: ${Date.now() - startTime}ms)`
    );
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`[estoque-seguranca] Erro após ${errorTime}ms:`, error);

    return NextResponse.json(
      { error: "Erro ao buscar produtos no estoque de segurança" },
      { status: 500 }
    );
  }
}
