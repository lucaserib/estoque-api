import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { listarFeedbackNegativo } from "@/modules/admin/feedbackIa";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const pagina = Math.max(1, Number(request.nextUrl.searchParams.get("pagina")) || 1);
    return NextResponse.json(await listarFeedbackNegativo(pagina));
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar feedback da IA");
  }
}
