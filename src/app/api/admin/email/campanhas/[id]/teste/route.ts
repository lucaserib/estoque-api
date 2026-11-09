import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, ipDoAdmin } from "@/modules/admin/auditoria";
import { enviarTesteDeCampanha } from "@/modules/email/campanhas";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const { id } = await params;
    const campanha = await prisma.campanha.findUnique({ where: { id } });
    if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    const resultado = await enviarTesteDeCampanha(campanha, admin);
    await auditar({ adminEmail: admin.email, acao: "CAMPANHA_TESTE_ENVIADO", alvoTipo: "CAMPANHA", alvoId: id, depois: resultado, ip: ipDoAdmin(request.headers) });
    return NextResponse.json({ resultado, para: admin.email });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao enviar o teste");
  }
}
