import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { apagarConversa, obterConversa, renomearConversa } from "@/modules/ia/conversas";
import { respostaErroRotaIa } from "@/modules/ia/respostas";

type Contexto = { params: Promise<{ id: string }> };

const NAO_ENCONTRADA = { error: "Conversa não encontrada" };

export async function GET(request: NextRequest, { params }: Contexto) {
  try {
    const user = await verifyUserAtivo(request);
    const { id } = await params;
    const conversa = await obterConversa({ id: user.id, contaId: user.contaId }, id);
    return conversa ? NextResponse.json(conversa) : NextResponse.json(NAO_ENCONTRADA, { status: 404 });
  } catch (error) {
    return respostaErroRotaIa(error, "Falha ao abrir conversa");
  }
}

const renomearSchema = z.object({ titulo: z.string().trim().min(1, "Informe um título.").max(80) });

export async function PATCH(request: NextRequest, { params }: Contexto) {
  try {
    const user = await verifyUserAtivo(request);
    const { id } = await params;
    const corpo = renomearSchema.safeParse(await request.json().catch(() => null));
    if (!corpo.success) return NextResponse.json({ error: corpo.error.issues[0].message }, { status: 400 });
    const ok = await renomearConversa({ id: user.id, contaId: user.contaId }, id, corpo.data.titulo);
    return ok ? NextResponse.json({ id, titulo: corpo.data.titulo }) : NextResponse.json(NAO_ENCONTRADA, { status: 404 });
  } catch (error) {
    return respostaErroRotaIa(error, "Falha ao renomear conversa");
  }
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  try {
    const user = await verifyUserAtivo(request);
    const { id } = await params;
    const ok = await apagarConversa({ id: user.id, contaId: user.contaId }, id);
    return ok ? NextResponse.json({ apagada: true }) : NextResponse.json(NAO_ENCONTRADA, { status: 404 });
  } catch (error) {
    return respostaErroRotaIa(error, "Falha ao apagar conversa");
  }
}
