import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { quadroSchema } from "@/modules/operacao/dominio/esquemas";
import { criarQuadro, listarQuadros } from "@/modules/operacao/quadros";

export async function GET(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const arquivados = request.nextUrl.searchParams.get("arquivados") === "1";
    return NextResponse.json({ quadros: await listarQuadros(contexto, arquivados) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "listar quadros");
  }
}

export async function POST(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const dados = quadroSchema.parse(await request.json());
    return NextResponse.json({ quadro: await criarQuadro(contexto, dados) }, { status: 201 });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "criar quadro");
  }
}
