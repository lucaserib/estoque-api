import { NextRequest, NextResponse } from "next/server";
import type { StatusIndicacao } from "@prisma/client";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { painelIndicacoesAdmin } from "@/modules/admin/indicacoesAdmin";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const status = (request.nextUrl.searchParams.get("status") as StatusIndicacao | null) || null;
    return NextResponse.json(await painelIndicacoesAdmin(status));
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar indicações");
  }
}
