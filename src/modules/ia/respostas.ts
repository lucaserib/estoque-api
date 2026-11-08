import { NextResponse } from "next/server";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { IaIndisponivelError, statusHttpDoErroIa } from "./erros";

export function respostaErroRotaIa(error: unknown, contexto: string): NextResponse {
  const permissao = permissaoErrorResponse(error);
  if (permissao) return permissao;
  if (error instanceof IaIndisponivelError) {
    return NextResponse.json({ error: error.message, codigo: error.codigo }, { status: statusHttpDoErroIa(error.codigo) });
  }
  if (error instanceof Error && /não autorizado|Usuário não encontrado/i.test(error.message)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  console.error(`[IA] ${contexto}`, { erro: error instanceof Error ? error.name : "desconhecido" });
  return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}

export const CABECALHOS_SSE = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  Connection: "keep-alive",
} as const;
