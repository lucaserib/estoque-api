import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { metricasCreditosIa } from "@/modules/admin/creditosAdmin";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    return NextResponse.json(await metricasCreditosIa());
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao calcular os créditos de IA");
  }
}
