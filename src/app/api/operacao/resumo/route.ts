import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { resumoOperacao } from "@/modules/operacao/consultas";

export async function GET(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    return NextResponse.json(await resumoOperacao(contexto));
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "resumo");
  }
}
