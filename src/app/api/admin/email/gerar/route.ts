import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { gerarRascunhoEmail } from "@/modules/email/gerarComIa";
import { IaIndisponivelError } from "@/modules/ia/erros";

export const maxDuration = 60;

const corpoSchema = z.object({
  briefing: z.string().trim().min(10, "Escreva um briefing um pouco maior.").max(2000),
  categoria: z.enum(["MARKETING", "CICLO_DE_VIDA", "TRANSACIONAL"]).default("MARKETING"),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const limite = await checkRateLimit("admin-gerar-email", admin.id, 30, 3600);
    if (!limite.allowed) return rateLimitResponse(limite);
    const lido = corpoSchema.safeParse(await request.json().catch(() => ({})));
    if (!lido.success) return NextResponse.json({ error: lido.error.issues[0].message }, { status: 400 });
    return NextResponse.json({ rascunho: await gerarRascunhoEmail(lido.data, admin) });
  } catch (error) {
    if (error instanceof IaIndisponivelError) return NextResponse.json({ error: error.message, codigo: error.codigo }, { status: 503 });
    return respostaErroAdmin(error, "Erro ao gerar o rascunho");
  }
}
