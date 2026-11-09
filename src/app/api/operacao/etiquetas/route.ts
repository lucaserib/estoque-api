import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { etiquetaSchema } from "@/modules/operacao/dominio/esquemas";
import { criarEtiqueta, listarEtiquetas } from "@/modules/operacao/quadros";

export async function GET(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    return NextResponse.json({ etiquetas: await listarEtiquetas(contexto) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "listar etiquetas");
  }
}

export async function POST(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const dados = etiquetaSchema.parse(await request.json());
    return NextResponse.json({ etiqueta: await criarEtiqueta(contexto, dados) }, { status: 201 });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "criar etiqueta");
  }
}
