import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { listarContasAdmin } from "@/modules/admin/metricas";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const busca = new URL(request.url).searchParams.get("busca");
    return NextResponse.json({ contas: await listarContasAdmin(busca) });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar contas");
  }
}
