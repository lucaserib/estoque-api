import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import {
  alterarCategoriaEmLote,
  excluirPrevistosEmLote,
  marcarComoPagoEmLote,
} from "@/modules/financeiro/lancamentos/servico";

interface RequestBody {
  acao?: "marcar_pago" | "alterar_categoria" | "excluir_previstos";
  ids?: string[];
  categoriaId?: string;
  dataPagamento?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json();
    if (!body.acao || !body.ids?.length) {
      return NextResponse.json({ error: "acao e ids são obrigatórios" }, { status: 400 });
    }

    if (body.acao === "marcar_pago") {
      const resultado = await marcarComoPagoEmLote(
        user.contaId,
        body.ids,
        body.dataPagamento ? new Date(body.dataPagamento) : undefined
      );
      return NextResponse.json(resultado);
    }

    if (body.acao === "alterar_categoria") {
      if (!body.categoriaId) {
        return NextResponse.json({ error: "categoriaId é obrigatório" }, { status: 400 });
      }
      const resultado = await alterarCategoriaEmLote(user.contaId, body.ids, body.categoriaId);
      return NextResponse.json(resultado);
    }

    if (body.acao === "excluir_previstos") {
      const resultado = await excluirPrevistosEmLote(user.contaId, body.ids);
      return NextResponse.json(resultado);
    }

    return NextResponse.json({ error: "acao desconhecida" }, { status: 400 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro na ação em lote de lançamentos:", error);
    return NextResponse.json({ error: "Erro na ação em lote" }, { status: 500 });
  }
}
