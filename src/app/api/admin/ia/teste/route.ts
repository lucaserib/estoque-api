import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { diagnosticarConexaoIa } from "@/modules/ia/diagnosticoConexao";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    return NextResponse.json(await diagnosticarConexaoIa());
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao testar a conexão com a IA");
  }
}
