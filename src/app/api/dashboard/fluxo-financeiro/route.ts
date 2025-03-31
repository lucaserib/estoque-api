import { verifyUser } from "@/helpers/verifyUser";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);

    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date("2000-01-01");
    const endDate = endDateParam ? new Date(endDateParam) : new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
    }

    const previousStartDate = new Date(startDate);
    const previousEndDate = new Date(startDate);
    previousStartDate.setDate(
      previousStartDate.getDate() -
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const produtos = await prisma.pedidoProduto.findMany({
      where: {
        pedido: {
          userId: user.id,
          dataConclusao: { gte: startDate, lte: endDate },
        },
      },
      select: {
        quantidade: true,
        custo: true,
        multiplicador: true,
      },
    });

    const totalEntradas = produtos.reduce((total, produto) => {
      const multiplicador = produto.multiplicador || 1;
      return total + produto.quantidade * produto.custo * multiplicador;
    }, 0);

    const saidas = await prisma.detalhesSaida.aggregate({
      where: {
        saida: {
          userId: user.id,
          data: { gte: startDate, lte: endDate },
        },
      },
      _sum: { quantidade: true },
    });

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

    const totalCustoSaidas = custoSaidas.reduce(
      (total, item) =>
        total + (item.produto?.custoMedio ?? 0) * item.quantidade,
      0
    );

    const saidasAnterior = await prisma.detalhesSaida.aggregate({
      where: {
        saida: {
          userId: user.id,
          data: { gte: previousStartDate, lte: previousEndDate },
        },
      },
      _sum: { quantidade: true },
    });

    const totalSaidas = saidas._sum.quantidade ?? 0;
    const totalSaidasAnterior = saidasAnterior._sum.quantidade ?? 0;

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
