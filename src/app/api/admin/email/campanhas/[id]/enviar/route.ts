import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";
import { enfileirarProximoLote, resolverPublico } from "@/modules/email/campanhas";

const corpoSchema = z.object({ agendarPara: z.string().datetime().nullish(), motivo: z.string().optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const { id } = await params;
    const corpo = corpoSchema.safeParse(await request.json().catch(() => ({})));
    if (!corpo.success) return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    const motivo = exigirMotivo(corpo.data.motivo);
    const campanha = await prisma.campanha.findUnique({ where: { id } });
    if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    if (campanha.status !== "RASCUNHO") return NextResponse.json({ error: "Esta campanha já foi agendada ou enviada." }, { status: 409 });

    const publico = await resolverPublico(campanha.segmento, campanha.categoria === "CICLO_DE_VIDA" ? "CICLO_DE_VIDA" : "MARKETING");
    if (publico.length === 0) return NextResponse.json({ error: "O público desta campanha está vazio." }, { status: 409 });

    const agendada = corpo.data.agendarPara ? new Date(corpo.data.agendarPara) : null;
    const agora = new Date();
    const atualizada = await prisma.campanha.update({
      where: { id },
      data:
        agendada && agendada.getTime() > agora.getTime()
          ? { status: "AGENDADA", agendadaPara: agendada, publicoTotal: publico.length }
          : { status: "ENVIANDO", iniciadaEm: agora, publicoTotal: publico.length },
    });
    if (atualizada.status === "ENVIANDO") await enfileirarProximoLote(atualizada, agora);
    await auditar({
      adminEmail: admin.email,
      acao: atualizada.status === "AGENDADA" ? "CAMPANHA_AGENDADA" : "CAMPANHA_ENVIADA",
      alvoTipo: "CAMPANHA",
      alvoId: id,
      depois: { status: atualizada.status, publico: publico.length, agendadaPara: atualizada.agendadaPara },
      motivo,
      ip: ipDoAdmin(request.headers),
    });
    return NextResponse.json({ status: atualizada.status, publico: publico.length });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao enviar a campanha");
  }
}
