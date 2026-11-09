import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { filtrosNotasSchema, notaSchema } from "@/modules/operacao/dominio/esquemas";
import { criarNota, listarNotas } from "@/modules/operacao/notas";

export async function GET(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const filtros = filtrosNotasSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return NextResponse.json({ notas: await listarNotas(contexto, filtros) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "listar notas");
  }
}

export async function POST(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const limite = await checkRateLimit("operacao-nota", contexto.userId, 120, 3600);
    if (!limite.allowed) return rateLimitResponse(limite);
    const dados = notaSchema.parse(await request.json());
    return NextResponse.json({ nota: await criarNota(contexto, dados) }, { status: 201 });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "criar nota");
  }
}
