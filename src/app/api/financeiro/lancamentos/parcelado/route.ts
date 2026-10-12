import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import {
  criarCompraParcelada,
  type DadosCompraParcelada,
} from "@/modules/financeiro/lancamentos/parcelamento";

interface RequestBody extends Omit<DadosCompraParcelada, "competencia" | "primeiroVencimento"> {
  competencia: string;
  primeiroVencimento: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json();
    if (
      !body.descricao ||
      !body.valorTotal ||
      !body.categoriaId ||
      !body.competencia ||
      !body.primeiroVencimento ||
      !body.numeroDeParcelas
    ) {
      return NextResponse.json(
        {
          error:
            "descricao, valorTotal, categoriaId, competencia, primeiroVencimento e numeroDeParcelas são obrigatórios",
        },
        { status: 400 }
      );
    }

    const resultado = await criarCompraParcelada(user.contaId, user.id, {
      ...body,
      competencia: new Date(body.competencia),
      primeiroVencimento: new Date(body.primeiroVencimento),
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao criar compra parcelada:", error);
    return NextResponse.json({ error: "Erro ao criar compra parcelada" }, { status: 500 });
  }
}
