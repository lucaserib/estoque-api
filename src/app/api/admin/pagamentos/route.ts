import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { listarPagamentos, paraCsv, type FiltrosPagamentos } from "@/modules/admin/pagamentos";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const p = request.nextUrl.searchParams;
    const filtros: FiltrosPagamentos = {
      tipo: (p.get("tipo") as FiltrosPagamentos["tipo"]) || null,
      status: p.get("status"),
      contaId: p.get("contaId"),
      de: p.get("de") ? new Date(p.get("de")!) : null,
      ate: p.get("ate") ? new Date(p.get("ate")!) : null,
    };
    const pagamentos = await listarPagamentos(filtros, p.get("formato") === "csv" ? 10000 : 500);

    if (p.get("formato") === "csv") {
      const csv = paraCsv(
        ["mp_payment_id", "conta", "loja", "tipo", "valor", "status", "metodo", "aprovado_em", "criado_em"],
        pagamentos.map((x) => [
          x.mpPaymentId,
          x.emailConta,
          x.loja,
          x.tipo,
          (x.valorCentavos / 100).toFixed(2).replace(".", ","),
          x.status,
          x.metodo,
          x.aprovadoEm,
          x.createdAt,
        ])
      );
      return new NextResponse(`﻿${csv}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pagamentos-skubo-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }
    return NextResponse.json({ pagamentos });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar pagamentos");
  }
}
