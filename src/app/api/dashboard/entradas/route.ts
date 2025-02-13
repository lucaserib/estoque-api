import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);

    const period = searchParams.get("period") || "hoje"; // padrão: hoje
    const now = new Date();
    let startDate, endDate, groupBy;

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
        pedido: {
          select: {
            dataConclusao: true,
          },
        },
      },
    });

    // Agrupar dados conforme o período selecionado
    const groupedData: {
      [key: string]: { totalQuantidade: number; totalCusto: number };
    } = {};

    compras.forEach((compra) => {
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
      groupedData[key].totalCusto += compra.custo;
    });

    const finalData = Object.keys(groupedData).map((key) => ({
      periodo: key,
      quantidade: groupedData[key].totalQuantidade,
      valor: groupedData[key].totalCusto,
    }));

    return NextResponse.json(finalData, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar entradas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar entradas" },
      { status: 500 }
    );
  }
}
