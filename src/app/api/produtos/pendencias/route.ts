import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { withCache, createCacheKey } from "@/lib/cache";
import { calcularTodasPendencias } from "@/services/pendenciasService";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const codigoFiltro = searchParams.get("codigo");
    const produtoIdFiltro = searchParams.get("produtoId");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      2000,
      Math.max(1, Number(searchParams.get("pageSize")) || 50)
    );

    const todos = await withCache(
      createCacheKey("pendencias", user.contaId),
      () => calcularTodasPendencias(user.contaId),
      "pendencias"
    );

    if (produtoIdFiltro) {
      const item = todos.find((p) => p.produtoId === produtoIdFiltro);
      return NextResponse.json({
        pendencias: item?.pendencias ?? [],
      });
    }

    const porCodigo: Record<
      string,
      { quantidade: number; valorEstoqueAfetado: number }
    > = {};

    for (const item of todos) {
      for (const pendencia of item.pendencias) {
        if (!porCodigo[pendencia.codigo]) {
          porCodigo[pendencia.codigo] = {
            quantidade: 0,
            valorEstoqueAfetado: 0,
          };
        }
        porCodigo[pendencia.codigo].quantidade += 1;
        if (item.custoMedio != null) {
          porCodigo[pendencia.codigo].valorEstoqueAfetado +=
            item.estoqueTotal * item.custoMedio;
        }
      }
    }

    const itensFiltrados = codigoFiltro
      ? todos.filter((item) =>
          item.pendencias.some((p) => p.codigo === codigoFiltro)
        )
      : todos.filter((item) => item.pendencias.length > 0);

    const total = itensFiltrados.length;
    const inicio = (page - 1) * pageSize;
    const pagina = itensFiltrados
      .slice(inicio, inicio + pageSize)
      .map((item) => ({
        produtoId: item.produtoId,
        nome: item.nome,
        sku: item.sku,
        pendencias: item.pendencias,
      }));

    return NextResponse.json({
      porCodigo,
      total,
      page,
      pageSize,
      itens: pagina,
    });
  } catch (error) {
    console.error("Erro ao calcular pendências:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
