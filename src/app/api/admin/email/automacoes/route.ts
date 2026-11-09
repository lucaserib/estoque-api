import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { AUTOMACOES_PADRAO, VARIAVEIS_AUTOMACAO, listarAutomacoes } from "@/modules/email/automacoes";
import { AUTOMACOES_POR_TEMPO } from "@/modules/email/cicloDeVida";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const automacoes = await listarAutomacoes();
    return NextResponse.json({
      automacoes: automacoes.map((a) => ({
        ...a,
        porTempo: AUTOMACOES_POR_TEMPO.includes(a.chave),
        padrao: AUTOMACOES_PADRAO.find((p) => p.chave === a.chave) ?? null,
      })),
      variaveis: VARIAVEIS_AUTOMACAO,
    });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar automações");
  }
}
