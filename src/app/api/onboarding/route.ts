import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { calcularEtapas } from "@/modules/onboarding/etapas";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    return NextResponse.json(await calcularEtapas(user.contaId), {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Erro ao calcular etapas do onboarding:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
