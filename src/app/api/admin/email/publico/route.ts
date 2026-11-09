import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { resolverPublico } from "@/modules/email/campanhas";

const corpoSchema = z.object({ segmento: z.record(z.unknown()).default({}), categoria: z.enum(["MARKETING", "CICLO_DE_VIDA"]) });

export async function POST(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const lido = corpoSchema.safeParse(await request.json().catch(() => ({})));
    if (!lido.success) return NextResponse.json({ error: "Segmento inválido" }, { status: 400 });
    const publico = await resolverPublico(lido.data.segmento, lido.data.categoria);
    return NextResponse.json({ total: publico.length, amostra: publico.slice(0, 5).map((p) => p.email) });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao calcular o público");
  }
}
