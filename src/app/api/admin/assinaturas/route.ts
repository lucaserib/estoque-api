import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { assinaturasPorStatus } from "@/modules/admin/pagamentos";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    return NextResponse.json({ assinaturas: await assinaturasPorStatus() });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar assinaturas");
  }
}
