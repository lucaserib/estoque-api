import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { listarTarefas } from "@/modules/operacao/consultas";
import { criarTarefaSchema, filtrosTarefasSchema } from "@/modules/operacao/dominio/esquemas";
import { criarTarefa } from "@/modules/operacao/tarefas";

export async function GET(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const filtros = filtrosTarefasSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return NextResponse.json(await listarTarefas(contexto, filtros));
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "listar tarefas");
  }
}

export async function POST(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const limite = await checkRateLimit("operacao-tarefa", contexto.userId, 120, 3600);
    if (!limite.allowed) return rateLimitResponse(limite);
    const entrada = criarTarefaSchema.parse(await request.json());
    const resultado = await criarTarefa(contexto, entrada);
    return NextResponse.json(resultado, { status: resultado.existente ? 200 : 201 });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "criar tarefa");
  }
}
