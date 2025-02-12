import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);

    // Garantir que as datas recebidas sejam válidas
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Converter para objetos Date, garantindo que sejam válidos
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date("2000-01-01");
    const endDate = endDateParam ? new Date(endDateParam) : new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
    }

    // Definir período anterior para comparação
    const previousStartDate = new Date(startDate);
    const previousEndDate = new Date(startDate);
    previousStartDate.setDate(
      previousStartDate.getDate() -
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Buscar total de ENTRADAS (compras feitas)
    const entradas = await prisma.pedidoProduto.aggregate({
      where: {
        pedido: {
          userId: user.id,
          dataConclusao: { gte: startDate, lte: endDate },
        },
      },
      _sum: { custo: true },
    });

    // Buscar total de SAÍDAS (vendas feitas)
    const saidas = await prisma.detalhesSaida.aggregate({
      where: {
        saida: {
          userId: user.id,
          data: { gte: startDate, lte: endDate },
        },
      },
      _sum: { quantidade: true },
    });

    // Buscar custo total das saídas (custo médio dos produtos vendidos)
    const custoSaidas = await prisma.detalhesSaida.findMany({
      where: {
        saida: {
          userId: user.id,
          data: { gte: startDate, lte: endDate },
        },
      },
      select: {
        quantidade: true,
        produto: { select: { custoMedio: true } },
      },
    });

    // Somar o custo total das saídas corretamente
    const totalCustoSaidas = custoSaidas.reduce(
      (total, item) =>
        total + (item.produto?.custoMedio ?? 0) * item.quantidade,
      0
    );

    // Buscar saídas no período ANTERIOR para comparação
    const saidasAnterior = await prisma.detalhesSaida.aggregate({
      where: {
        saida: {
          userId: user.id,
          data: { gte: previousStartDate, lte: previousEndDate },
        },
      },
      _sum: { quantidade: true },
    });

    const totalEntradas = entradas._sum.custo ?? 0;
    const totalSaidas = saidas._sum.quantidade ?? 0;
    const totalSaidasAnterior = saidasAnterior._sum.quantidade ?? 0;

    // Cálculo da variação percentual das saídas
    const variacaoSaidas =
      totalSaidasAnterior > 0
        ? ((totalSaidas - totalSaidasAnterior) / totalSaidasAnterior) * 100
        : totalSaidas > 0
        ? 100
        : 0;

    return NextResponse.json(
      {
        entradas: totalEntradas,
        saidas: totalSaidas,
        custoSaidas: totalCustoSaidas.toFixed(2),
        variacaoSaidas: variacaoSaidas.toFixed(2),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao buscar fluxo financeiro:", error);
    return NextResponse.json(
      { error: "Erro ao buscar fluxo financeiro" },
      { status: 500 }
    );
  }
}
