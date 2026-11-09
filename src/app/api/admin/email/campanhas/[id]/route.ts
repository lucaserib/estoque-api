import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, ipDoAdmin } from "@/modules/admin/auditoria";
import { dadosCampanhaParaSalvar, metricasDaCampanha } from "@/modules/email/campanhas";
import { campanhaSchema } from "@/modules/email/campanhaSchema";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdminPlataforma(request);
    const campanha = await prisma.campanha.findUnique({ where: { id: (await params).id } });
    if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    return NextResponse.json({ campanha: { ...campanha, metricas: await metricasDaCampanha(campanha) } });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao abrir a campanha");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const { id } = await params;
    const antes = await prisma.campanha.findUnique({ where: { id } });
    if (!antes) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    if (antes.status !== "RASCUNHO") return NextResponse.json({ error: "Só dá para editar rascunhos." }, { status: 409 });
    const lido = campanhaSchema.safeParse(await request.json().catch(() => ({})));
    if (!lido.success) return NextResponse.json({ error: lido.error.issues[0].message }, { status: 400 });
    const depois = await prisma.campanha.update({ where: { id }, data: { ...dadosCampanhaParaSalvar(lido.data), atualizadaPor: admin.email } });
    await auditar({ adminEmail: admin.email, acao: "CAMPANHA_ALTERADA", alvoTipo: "CAMPANHA", alvoId: id, antes, depois, ip: ipDoAdmin(request.headers) });
    return NextResponse.json({ campanha: depois });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao salvar a campanha");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const { id } = await params;
    const antes = await prisma.campanha.findUnique({ where: { id } });
    if (!antes) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    if (antes.status !== "RASCUNHO") return NextResponse.json({ error: "Só dá para apagar rascunhos. Cancele a campanha." }, { status: 409 });
    await prisma.campanha.delete({ where: { id } });
    await auditar({ adminEmail: admin.email, acao: "CAMPANHA_APAGADA", alvoTipo: "CAMPANHA", alvoId: id, antes, ip: ipDoAdmin(request.headers) });
    return NextResponse.json({ apagada: true });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao apagar a campanha");
  }
}
