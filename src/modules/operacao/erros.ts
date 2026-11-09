import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ErroOperacao extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 422,
    readonly codigo: string,
    mensagem: string
  ) {
    super(mensagem);
    this.name = "ErroOperacao";
  }
}

export const naoEncontrada = (oQue = "Tarefa") => new ErroOperacao(404, "NAO_ENCONTRADA", `${oQue} não encontrada.`);
export const semPermissaoOperacao = (mensagem: string) => new ErroOperacao(403, "SEM_PERMISSAO", mensagem);
export const regraOperacao = (mensagem: string) => new ErroOperacao(422, "REGRA", mensagem);
export const conflitoVersao = () =>
  new ErroOperacao(409, "CONFLITO", "Outra pessoa alterou esta tarefa agora há pouco. Recarregue para ver a versão atual.");

export function respostaErroOperacao(error: unknown, contexto: string): NextResponse {
  if (error instanceof ErroOperacao) {
    return NextResponse.json({ error: error.message, code: error.codigo }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Dados inválidos.", code: "DADOS_INVALIDOS" }, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Corpo da requisição inválido.", code: "DADOS_INVALIDOS" }, { status: 400 });
  }
  console.error(`[OPERACAO] ${contexto}:`, error);
  return NextResponse.json({ error: "Não foi possível concluir agora. Tente de novo.", code: "ERRO_INTERNO" }, { status: 500 });
}
