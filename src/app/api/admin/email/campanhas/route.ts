import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, ipDoAdmin } from "@/modules/admin/auditoria";
import { dadosCampanhaParaSalvar, metricasDaCampanha } from "@/modules/email/campanhas";
import { campanhaSchema } from "@/modules/email/campanhaSchema";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const campanhas = await prisma.campanha.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    const comMetricas = await Promise.all(campanhas.map(async (c) => ({ ...c, metricas: await metricasDaCampanha(c) })));
    return NextResponse.json({ campanhas: comMetricas });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar campanhas");
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const lido = campanhaSchema.safeParse(await request.json().catch(() => ({})));
    if (!lido.success) return NextResponse.json({ error: lido.error.issues[0].message }, { status: 400 });
    const campanha = await prisma.campanha.create({ data: { ...dadosCampanhaParaSalvar(lido.data), criadaPor: admin.email } });
    await auditar({ adminEmail: admin.email, acao: "CAMPANHA_CRIADA", alvoTipo: "CAMPANHA", alvoId: campanha.id, depois: campanha, ip: ipDoAdmin(request.headers) });
    return NextResponse.json({ campanha }, { status: 201 });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao criar a campanha");
  }
}
