import { verifyUser } from "@/helpers/verifyUser";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "2000-01-01";
    const endDate = searchParams.get("endDate") || new Date().toISOString();

    const produtosMaisVendidos = await prisma.detalhesSaida.groupBy({
      by: ["produtoId"],
      where: {
        saida: {
          userId: user.id,
          data: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      },
      _sum: { quantidade: true },
      orderBy: {
        _sum: { quantidade: "desc" },
      },
      take: 3,
    });

    const produtos = await prisma.produto.findMany({
      where: { id: { in: produtosMaisVendidos.map((p) => p.produtoId) } },
      select: { id: true, nome: true, sku: true },
    });

    const resultado = produtosMaisVendidos.map((item) => {
      const produto = produtos.find((p) => p.id === item.produtoId);
      return {
        nome: produto?.nome || "Desconhecido",
        sku: produto?.sku || "N/A",
        quantidade: item._sum.quantidade || 0,
      };
    });

    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar top produtos vendidos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar top produtos vendidos" },
      { status: 500 }
    );
  }
}
