import { verifyUser } from "@/helpers/verifyUser";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    console.log("[valor-estoque] Iniciando requisição");
    const user = await verifyUser(request);
    console.log("[valor-estoque] Usuário verificado:", user.id);

    // Usar uma consulta agregada para melhorar a performance
    const result = await prisma.$queryRaw`
      SELECT 
        SUM(e.quantidade * COALESCE(p."custoMedio", 0)) as "valorTotal",
        SUM(e.quantidade) as "quantidadeTotal"
      FROM "Estoque" e
      JOIN "Produto" p ON e."produtoId" = p.id
      JOIN "Armazem" a ON e."armazemId" = a.id
      WHERE a."userId" = ${user.id}
    `;

    const queryTime = Date.now() - startTime;
    console.log(`[valor-estoque] Consulta concluída em ${queryTime}ms`);

    const response =
      Array.isArray(result) && result.length > 0
        ? result[0]
        : { valorTotal: 0, quantidadeTotal: 0 };
    const valorTotal = Number(response.valorTotal) || 0;
    const quantidadeTotal = Number(response.quantidadeTotal) || 0;

    console.log(
      `[valor-estoque] Respondendo com valorTotal: ${valorTotal}, quantidadeTotal: ${quantidadeTotal} (tempo total: ${
        Date.now() - startTime
      }ms)`
    );

    return NextResponse.json(
      {
        valorTotal,
        quantidadeTotal,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`[valor-estoque] Erro após ${errorTime}ms:`, error);

    return NextResponse.json(
      { error: "Erro ao buscar valor total do estoque" },
      { status: 500 }
    );
  }
}
