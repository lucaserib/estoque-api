import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { calcularMetricasPlataforma } from "@/modules/admin/metricas";
import { calcularMetricasComerciais } from "@/modules/admin/comercial";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const [plataforma, comercial] = await Promise.all([calcularMetricasPlataforma(), calcularMetricasComerciais()]);
    return NextResponse.json({ ...plataforma, comercial });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao calcular métricas");
  }
}
