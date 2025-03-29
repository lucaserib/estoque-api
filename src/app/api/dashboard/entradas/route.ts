import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);

    const period = searchParams.get("period") || "hoje"; // padrão: hoje
    const customStartDate = searchParams.get("startDate");
    const customEndDate = searchParams.get("endDate");

    const now = new Date();
    let startDate, endDate, groupBy;

    // Se temos datas customizadas, usamos elas
    if (period === "custom" && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);

      // Determinar o agrupamento baseado na diferença de dias
      const diffDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays <= 1) {
        groupBy = "hour";
      } else if (diffDays <= 31) {
        groupBy = "day";
      } else if (diffDays <= 90) {
        groupBy = "week";
      } else {
        groupBy = "month";
      }
    } else {
      // Configurações padrão para períodos pré-definidos
      switch (period) {
        case "hoje":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          endDate = new Date();
          groupBy = "hour"; // Agrupa por hora
          break;
        case "semanal":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay()); // Início da semana
          endDate = new Date();
          groupBy = "day"; // Agrupa por dia
          break;
        case "mensal":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date();
          groupBy = "week"; // Agrupa por semana
          break;
        case "tres-meses":
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 2);
          startDate.setDate(1);
          endDate = new Date();
          groupBy = "month"; // Agrupa por mês
          break;
        default:
          return NextResponse.json(
            { error: "Período inválido" },
            { status: 400 }
          );
      }
    }

    const compras = await prisma.pedidoProduto.findMany({
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
        pedido: {
          select: {
            dataConclusao: true,
          },
        },
      },
    });

    const groupedData: {
      [key: string]: { totalQuantidade: number; totalCusto: number };
    } = {};

    let totalQuantidade = 0;
    let totalCusto = 0;

    compras.forEach((compra) => {
      // Aplicar o multiplicador (valor padrão 1 se não existir)
      const multiplicador = compra.multiplicador || 1;
      // Calcular o valor total do item considerando quantidade e multiplicador
      totalQuantidade += compra.quantidade;
      totalCusto += compra.quantidade * compra.custo * multiplicador;

      let key = "";

      const data = compra.pedido.dataConclusao
        ? new Date(compra.pedido.dataConclusao)
        : new Date();
      switch (groupBy) {
        case "hour":
          key = `${data.getHours()}:00`;
          break;
        case "day":
          key = data.toLocaleDateString("pt-BR", { weekday: "short" });
          break;
        case "week":
          key = `Semana ${Math.ceil(data.getDate() / 7)}`;
          break;
        case "month":
          key = data.toLocaleDateString("pt-BR", {
            month: "short",
            year: "2-digit",
          });
          break;
      }

      if (!groupedData[key]) {
        groupedData[key] = { totalQuantidade: 0, totalCusto: 0 };
      }
      groupedData[key].totalQuantidade += compra.quantidade;
      groupedData[key].totalCusto +=
        compra.quantidade * compra.custo * multiplicador;
    });

    const chartData = Object.keys(groupedData).map((key) => ({
      periodo: key,
      quantidade: groupedData[key].totalQuantidade,
      valor: groupedData[key].totalCusto,
    }));

    return NextResponse.json(
      {
        chart: chartData,
        totals: {
          quantidade: totalQuantidade,
          valor: totalCusto,
        },
        period: period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao buscar entradas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar entradas" },
      { status: 500 }
    );
  }
}
