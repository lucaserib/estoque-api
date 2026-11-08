import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { calcularMetricasPlataforma } from "@/modules/admin/metricas";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    return NextResponse.json(await calcularMetricasPlataforma());
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao calcular métricas");
  }
}
