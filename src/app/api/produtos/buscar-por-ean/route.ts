import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/produtos/buscar-por-ean?ean=7891234567890
 * Busca um produto do usuário pelo código EAN.
 * Resposta: { produto: {...} | null }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const eanParam = searchParams.get("ean");

    if (!eanParam) {
      return NextResponse.json(
        { error: "EAN não fornecido" },
        { status: 400 }
      );
    }

    // EAN é BigInt no banco; validar que o parâmetro é numérico
    let ean: bigint;
    try {
      ean = BigInt(eanParam.trim());
    } catch {
      return NextResponse.json({ produto: null });
    }

    const produto = await prisma.produto.findFirst({
      where: { userId: user.id, ean },
      include: { estoques: { select: { quantidade: true } } },
    });

    if (!produto) {
      return NextResponse.json({ produto: null });
    }

    const quantidadeDisponivel = produto.estoques.reduce(
      (sum, e) => sum + e.quantidade,
      0
    );

    return NextResponse.json({
      produto: {
        id: produto.id,
        nome: produto.nome,
        sku: produto.sku,
        ean: produto.ean?.toString(),
        preco: produto.custoMedio ?? 0,
        quantidadeDisponivel,
        unidade: "un",
      },
    });
  } catch (error) {
    console.error("[BUSCAR_POR_EAN] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao buscar produto por EAN" },
      { status: 500 }
    );
  }
}
