import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { registrarFeedback } from "@/modules/ia/conversas";
import { respostaErroRotaIa } from "@/modules/ia/respostas";

const corpoSchema = z.object({
  util: z.boolean(),
  comentario: z.string().max(1000).nullish(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyUserAtivo(request);
    const { id } = await params;
    const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
    if (!corpo.success) return NextResponse.json({ error: "Informe util: true ou false" }, { status: 400 });
    const ok = await registrarFeedback({ id: user.id, contaId: user.contaId }, id, corpo.data.util, corpo.data.comentario ?? null);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
  } catch (error) {
    return respostaErroRotaIa(error, "Falha ao registrar feedback");
  }
}
